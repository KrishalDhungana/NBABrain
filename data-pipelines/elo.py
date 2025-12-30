from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set

import numpy as np
import pandas as pd
from pipeline_utils import safe_float, safe_int

try:
    from nba_api.stats.endpoints import leaguegamelog
except Exception as e:
    raise SystemExit(
        "nba_api is required. Install with: pip install nba_api\n"
        f"Import error: {e}"
    )


def fetch_team_game_logs(season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    """
    Team game logs (each game appears twice, once per team) used for Elo updates.

    LeagueGameLog with player_or_team_abbreviation="T" returns every matchup in a
    single request, including TEAM_ID, GAME_ID, GAME_DATE, MATCHUP (home/away), WL,
    and scoring fields. That keeps the Elo replay and downstream game history
    generation fast without per-team requests.
    """
    res = leaguegamelog.LeagueGameLog(
        player_or_team_abbreviation="T",
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def compute_elo_from_logs(
    season: str,
    season_type: str,
    allowed_ids: Optional[Iterable[int]] = None,
    base_elo: float = 1500.0,
    k: float = 20.0,
    home_adv: float = 70.0,
) -> tuple[Dict[int, float], Dict[int, List[Dict[str, object]]], Dict[int, List[Dict[str, object]]]]:
    """
    Replay the season chronologically from LeagueGameLog to update Elo after every game.

    - K controls volatility; 20 is moderate (tweak if Elo feels too sticky or too jumpy).
    - home_adv is a flat boost (in Elo points) for the home team expectation.
    - Margin of victory is used as a multiplier (log-scaled) to reward decisive wins.
    """
    allowed_set: Set[int] = {int(x) for x in allowed_ids} if allowed_ids else set()

    logs = fetch_team_game_logs(season, season_type)
    if logs.empty:
        return {}, {}, {}

    logs = logs.copy()
    if allowed_set and "TEAM_ID" in logs.columns:
        logs = logs[logs["TEAM_ID"].isin(allowed_set)]
    if "GAME_DATE" in logs.columns:
        logs["GAME_DATE"] = pd.to_datetime(logs["GAME_DATE"])
    logs = logs.sort_values(["GAME_DATE", "GAME_ID"])

    elo: Dict[int, float] = {}
    history: Dict[int, List[Dict[str, object]]] = {}
    results: Dict[int, List[Dict[str, object]]] = {}

    def normalize_date(value):
        try:
            return pd.to_datetime(value).date().isoformat()
        except Exception:
            return str(value)

    def get_elo(team_id: int) -> float:
        return elo.get(team_id, base_elo)

    def record_history(team_id: int, game_date, value: float):
        if team_id is None or pd.isna(team_id):
            return
        dt = normalize_date(game_date)
        arr = history.setdefault(int(team_id), [])
        arr.append({"date": dt, "elo": round(float(value), 1)})

    def get_pts(row: Dict) -> Optional[float]:
        for c in ("PTS", "PTS_TEAM", "PTS_GAME"):
            if c in row and not pd.isna(row[c]):
                return safe_float(row[c])
        return None

    def record_game(
        team_row: Dict,
        opp_row: Dict,
        was_home: bool,
        elo_before: float,
        elo_after: float,
        delta: float,
        game_id,
        game_date,
    ) -> None:
        team_id = safe_int(team_row.get("TEAM_ID"))
        opp_id = safe_int(opp_row.get("TEAM_ID"))
        team_pts = safe_int(get_pts(team_row))
        opp_pts = safe_int(get_pts(opp_row))
        if team_id is None or opp_id is None:
            return
        result = "T"
        margin = None
        if team_pts is not None and opp_pts is not None:
            margin = team_pts - opp_pts
            result = "W" if margin > 0 else "L" if margin < 0 else "T"

        payload = {
            "gameId": str(game_id),
            "date": normalize_date(game_date),
            "home": bool(was_home),
            "opponentTeamId": opp_id,
            "opponentTeamName": str(opp_row.get("TEAM_NAME") or ""),
            "opponentAbbreviation": str(opp_row.get("TEAM_ABBREVIATION") or ""),
            "teamScore": team_pts,
            "opponentScore": opp_pts,
            "margin": margin,
            "result": result,
            "eloBefore": round(float(elo_before), 1),
            "eloAfter": round(float(elo_after), 1),
            "eloChange": round(float(delta), 1),
        }
        arr = results.setdefault(team_id, [])
        arr.append(payload)

    for gid, game in logs.groupby("GAME_ID"):
        if len(game) < 2:
            continue  # need both teams to resolve Elo
        game_sorted = game.sort_values("TEAM_ID")
        is_away = game_sorted["MATCHUP"].astype(str).str.contains("@")
        # Prefer explicit home/away parsing; otherwise fall back to first/second rows
        if is_away.any() and (~is_away).any():
            home_row = game_sorted.loc[~is_away].iloc[0]
            away_row = game_sorted.loc[is_away].iloc[0]
        else:
            home_row = game_sorted.iloc[0]
            away_row = game_sorted.iloc[1]

        home_id, away_id = int(home_row["TEAM_ID"]), int(away_row["TEAM_ID"])
        home_pts, away_pts = get_pts(home_row), get_pts(away_row)
        if home_pts is None or away_pts is None:
            continue

        home_rating, away_rating = get_elo(home_id), get_elo(away_id)
        rating_diff = home_rating + home_adv - away_rating
        expect_home = 1.0 / (1.0 + 10 ** (-rating_diff / 400))
        margin = abs(home_pts - away_pts)
        mov_mult = np.log1p(margin) * (2.2 / ((abs(home_rating - away_rating) * 0.001) + 2.2))
        score_home = 1.0 if home_pts > away_pts else 0.0 if home_pts < away_pts else 0.5

        delta_home = k * mov_mult * (score_home - expect_home)
        home_new = home_rating + delta_home
        away_new = away_rating - delta_home

        elo[home_id] = home_new
        elo[away_id] = away_new

        game_date = home_row.get("GAME_DATE", away_row.get("GAME_DATE"))
        record_history(home_id, game_date, home_new)
        record_history(away_id, game_date, away_new)
        record_game(home_row, away_row, True, home_rating, home_new, delta_home, gid, game_date)
        record_game(away_row, home_row, False, away_rating, away_new, -delta_home, gid, game_date)

    for tid, hist in history.items():
        history[tid] = sorted(hist, key=lambda x: x["date"])
    for tid, games in results.items():
        results[tid] = sorted(games, key=lambda x: x.get("date", ""))

    return elo, history, results
