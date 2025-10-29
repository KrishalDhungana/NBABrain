"""
Reusable data retrieval helpers for NBA data via nba_api.

Functions cover:
- Current season player stats (per game)
- Current season team stats (advanced: Off/Def/Net ratings, Pace, record)
- Today's games scoreboard + per-player box scores
- Season-to-date game summaries (home/away, score, date)

Notes:
- Uses requests-cache to reduce repeated calls / be gentle to stats.nba.com
- Includes simple retries for transient errors
"""

from __future__ import annotations

import os
import time
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd

try:
    import requests_cache  # type: ignore
except Exception:
    requests_cache = None  # type: ignore

from nba_api.stats.library.http import NBAStatsHTTP
from nba_api.stats.endpoints import (
    leaguedashplayerstats,
    teamdashboardbygeneralsplits,
    scoreboardv2,
    boxscoretraditionalv2,
    leaguegamelog,
)
from nba_api.stats.static import teams as static_teams


def init_caching(cache_name: str = "nba_cache", expire_after_seconds: int = 3600) -> None:
    """Attach a CachedSession to nba_api so repeated calls are cached.

    If requests-cache is not installed, this is a no-op.
    """
    if requests_cache is None:
        return
    session = requests_cache.CachedSession(cache_name, expire_after=expire_after_seconds)
    NBAStatsHTTP._session = session


def current_season_str(today: Optional[date] = None) -> str:
    """Return NBA season string like '2024-25'. Season rolls in October."""
    today = today or date.today()
    start_year = today.year if today.month >= 10 else today.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _retry_call(func, *args, retries: int = 3, delay: float = 1.0, **kwargs):
    last_exc = None
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            last_exc = e
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    if last_exc:
        raise last_exc


# 1) Current season stats for each player
def fetch_players_per_game(season: str, season_type: str = "Regular Season") -> pd.DataFrame:
    """Fetch per-game box stats for all players for a season."""
    resp = _retry_call(
        leaguedashplayerstats.LeagueDashPlayerStats,
        season=season,
        season_type_all_star=season_type,
        per_mode_detailed="PerGame",
        timeout=30,
    )
    df = resp.get_data_frames()[0]
    # Ensure predictable dtypes for common fields
    for col in ("PTS", "AST", "REB", "STL", "BLK", "FGA", "FGM", "FG_PCT", "FG3M", "FG3A", "FTM", "FTA", "MIN"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


# 2) Current season team stats (advanced)
def fetch_teams_advanced(season: str, season_type: str = "Regular Season") -> pd.DataFrame:
    """Fetch team advanced stats (OFF/DEF/NET RTG, Pace, record) via TeamDashboardByGeneralSplits.

    This endpoint returns a single row per team with OFF_RATING, DEF_RATING, NET_RATING, PACE, W, L, etc.
    """
    # Get teams (static)
    teams = static_teams.get_teams()
    rows: List[pd.DataFrame] = []
    for t in teams:
        team_id = t["id"]
        resp = _retry_call(
            teamdashboardbygeneralsplits.TeamDashboardByGeneralSplits,
            team_id=team_id,
            season=season,
            season_type_all_star=season_type,
            per_mode_detailed="PerGame",
            timeout=30,
        )
        df = resp.overall_team_dashboard.get_data_frame()
        # Attach extra identifiers
        df["TEAM_ID"] = team_id
        df["TEAM_ABBREVIATION"] = t["abbreviation"]
        df["TEAM_NAME"] = t["full_name"]
        rows.append(df)

    out = pd.concat(rows, ignore_index=True)
    # Select/rename to a friendly schema
    cols = [
        "TEAM_ID",
        "TEAM_ABBREVIATION",
        "TEAM_NAME",
        "W",
        "L",
        "W_PCT",
        "GP",
        "MIN",
        "OFF_RATING",
        "DEF_RATING",
        "NET_RATING",
        "PACE",
    ]
    return out[[c for c in cols if c in out.columns]].copy()


# 3) Box score stats for today's games
def fetch_scoreboard(game_date: Optional[date] = None) -> Tuple[pd.DataFrame, pd.DataFrame, List[str]]:
    """Return (game_header, line_score, game_ids) for a given date (defaults to today)."""
    d = game_date or date.today()
    datestr = d.strftime("%m/%d/%Y")
    resp = _retry_call(scoreboardv2.ScoreboardV2, game_date=datestr, timeout=30)
    game_header = resp.game_header.get_data_frame()
    line_score = resp.line_score.get_data_frame()
    game_ids = list(game_header["GAME_ID"].astype(str).unique())
    return game_header, line_score, game_ids


def fetch_boxscores_for_games(game_ids: List[str]) -> Dict[str, pd.DataFrame]:
    """Fetch player-level traditional box score for each game_id.

    Returns dict[game_id] -> DataFrame
    """
    out: Dict[str, pd.DataFrame] = {}
    for gid in game_ids:
        resp = _retry_call(boxscoretraditionalv2.BoxScoreTraditionalV2, game_id=gid, timeout=30)
        df = resp.player_stats.get_data_frame()
        out[gid] = df
    return out


# 4) General stats for every game in season
def fetch_season_games_summary(season: str, season_type: str = "Regular Season") -> pd.DataFrame:
    """Fetch season-to-date team game logs and roll up to one row per GAME_ID with
    home/away teams, scores, and date.

    Uses LeagueGameLog with player_or_team_abbreviation='T'. Each game appears twice (one per team).
    """
    resp = _retry_call(
        leaguegamelog.LeagueGameLog,
        season=season,
        season_type_all_star=season_type,
        player_or_team_abbreviation="T",
        timeout=30,
    )
    logs = resp.get_data_frames()[0]
    # Normalize types
    for col in ("PTS",):
        if col in logs.columns:
            logs[col] = pd.to_numeric(logs[col], errors="coerce")

    # Determine home/away from MATCHUP ("TEAM vs OPP" -> home, "TEAM @ OPP" -> away)
    logs["IS_HOME"] = logs["MATCHUP"].str.contains(" vs ")

    # Split into home and away rows then merge per GAME_ID
    home = logs[logs["IS_HOME"]].copy()
    away = logs[~logs["IS_HOME"]].copy()

    # Prepare columns
    home = home.rename(columns={
        "TEAM_NAME": "HOME_TEAM",
        "TEAM_ABBREVIATION": "HOME_ABBR",
        "PTS": "HOME_PTS",
        "GAME_DATE": "GAME_DATE",
        "GAME_ID": "GAME_ID",
    })
    away = away.rename(columns={
        "TEAM_NAME": "AWAY_TEAM",
        "TEAM_ABBREVIATION": "AWAY_ABBR",
        "PTS": "AWAY_PTS",
        "GAME_ID": "GAME_ID",
    })

    merged = pd.merge(
        home[["GAME_ID", "GAME_DATE", "HOME_TEAM", "HOME_ABBR", "HOME_PTS"]],
        away[["GAME_ID", "AWAY_TEAM", "AWAY_ABBR", "AWAY_PTS"]],
        on="GAME_ID",
        how="inner",
        validate="one_to_one",
    )

    # Coerce date
    try:
        merged["GAME_DATE"] = pd.to_datetime(merged["GAME_DATE"]).dt.date
    except Exception:
        pass

    return merged.sort_values(["GAME_DATE", "GAME_ID"]).reset_index(drop=True)


# Convenience: write outputs to data/
def ensure_data_dir(path: str = "data") -> str:
    os.makedirs(path, exist_ok=True)
    return path


def save_df(df: pd.DataFrame, base_name: str, folder: str = "data") -> Tuple[str, str]:
    ensure_data_dir(folder)
    csv_path = os.path.join(folder, f"{base_name}.csv")
    json_path = os.path.join(folder, f"{base_name}.json")
    df.to_csv(csv_path, index=False)
    df.to_json(json_path, orient="records")
    return csv_path, json_path


if __name__ == "__main__":
    # Example end-to-end run (safe to execute from notebook via !python notebooks/fetch_nba_data.py)
    init_caching()
    season = current_season_str()

    print(f"Season: {season}")

    print("Fetching player per-game stats…")
    players = fetch_players_per_game(season)
    save_df(players, f"players_per_game_{season}")

    print("Fetching team advanced stats…")
    teams_adv = fetch_teams_advanced(season)
    save_df(teams_adv, f"teams_advanced_{season}")

    print("Fetching today's scoreboard + box scores…")
    gh, ls, game_ids = fetch_scoreboard()
    save_df(gh, "scoreboard_games_today")
    save_df(ls, "scoreboard_linescore_today")
    boxes = fetch_boxscores_for_games(game_ids)
    for gid, df in boxes.items():
        save_df(df, f"boxscore_{gid}")

    print("Fetching season game summaries…")
    games = fetch_season_games_summary(season)
    save_df(games, f"season_games_{season}")

    print("Done.")

