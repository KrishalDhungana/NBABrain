"""
team_pipeline.py
----------------
Fetch league-wide team data from nba_api, compute pillar ratings (Offense,
Defense, Pace/Pressure, Hustle, Clutch), and write a compact JSON to
public/data/teams.json. Elo is replayed from game logs so it can update after
every game. No aggregate “overall” rating is produced; the profile stays focused
on the requested pillars.

Where the data comes from (nba_api.stats.endpoints):
  - leaguedashteamstats: base box + advanced (OFF/DEF/NET RTG, TS_PCT, AST_TO, DREB_PCT, OREB_PCT, PACE).
  - leaguedashteamshotlocations: zone-level FGA to build shot profile (rim + threes share).
  - leaguehustlestatsteam: hustle actions (SCREEN_ASSISTS, DEFLECTIONS, etc.).
  - leaguedashteamclutch: clutch-only Net/Off/Def ratings, W_PCT, TS_PCT, TOV_PCT.
  - leaguedashptteamdefend (optional): opponent FG% differential (PCT_PLUS_MINUS).
  - leaguegamelog: team game logs used to replay Elo.

Usage (from repo root):
  pip install nba_api pandas numpy scipy tqdm requests
  python data-pipelines/team_pipeline.py --season 2025-26 --season-type "Regular Season" --out public/data/teams.json

Notes:
  - nba_api servers rate-limit; --sleep throttles between calls.
  - If an optional endpoint is missing (e.g., ptteamdefend), the script keeps going.
"""


# -----------------------------
# Imports
# -----------------------------

from __future__ import annotations

import argparse
import json
import time
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from elo import compute_elo_from_logs
from pipeline_utils import rating_1_99, rename_with_suffix, safe_float, safe_int, z_robust

try:
    from nba_api.stats.endpoints import (
        leaguestandingsv3,
        leaguedashteamstats,
        leaguehustlestatsteam,
        leaguedashteamshotlocations,
        leaguedashteamclutch,
        leaguedashptteamdefend,
    )
    from nba_api.stats.static import teams as static_teams
except Exception as e:
    raise SystemExit(
        "nba_api is required. Install with: pip install nba_api\n"
        f"Import error: {e}"
    )


# -----------------------------
# Fetch functions
# -----------------------------


def fetch_team(measure_type: str = "Base", per_mode: str = "PerGame", season: str = "2025-26", season_type: str = "Regular Season", rank: str = "N") -> pd.DataFrame:
    res = leaguedashteamstats.LeagueDashTeamStats(
        measure_type_detailed_defense=measure_type,
        per_mode_detailed=per_mode,
        season=season,
        season_type_all_star=season_type,
        rank=rank,
    )
    return res.get_data_frames()[0]


def fetch_shot_locations(season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashteamshotlocations.LeagueDashTeamShotLocations(
        season=season,
        season_type_all_star=season_type,
        # context_measure_simple="FGA",
    )
    return res.get_data_frames()[0]


def fetch_hustle(per_mode: str = "PerGame", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguehustlestatsteam.LeagueHustleStatsTeam(
        per_mode_time=per_mode,
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_clutch(measure_type: str = "Base", per_mode: str = "Per100Possessions", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashteamclutch.LeagueDashTeamClutch(
        measure_type_detailed_defense=measure_type,
        season=season,
        season_type_all_star=season_type,
        per_mode_detailed=per_mode,
    )
    return res.get_data_frames()[0]


def fetch_defense_tracking(per_mode: str = "PerGame", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashptteamdefend.LeagueDashPtTeamDefend(
        per_mode_simple=per_mode,
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_standings(season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguestandingsv3.LeagueStandingsV3(
        season=season, 
        season_type=season_type
    )
    return res.get_data_frames()[0]


# -----------------------------
# Data retrieval pipeline
# -----------------------------


def build_dataset(season: str = "2025-26", season_type: str = "Regular Season", sleep_sec: float = 0.6) -> pd.DataFrame:
    # Base per-game stats (points, plus/minus, paint points, etc.)
    base_df = fetch_team("Base", "PerGame", season, season_type, rank="Y")[["TEAM_ID", "TEAM_NAME", "PLUS_MINUS", "PLUS_MINUS_RANK", "FG_PCT", "FG_PCT_RANK", "FG3_PCT", "FG3_PCT_RANK", "FG3M", "FG3M_RANK", "FT_PCT", "FT_PCT_RANK", "TOV", "TOV_RANK"]]
    base_pg = rename_with_suffix(base_df, "_PerGame", ["TEAM_ID", "TEAM_NAME"])
    time.sleep(sleep_sec)

    # Misc per-game stats (points, plus/minus, paint points, etc.)
    misc_df = fetch_team("Misc", "PerGame", season, season_type)[["TEAM_ID", "PTS_OFF_TOV", "PTS_FB", "PTS_2ND_CHANCE", "PTS_PAINT", "OPP_PTS_PAINT"]]
    misc_pg = rename_with_suffix(misc_df, "_PerGame", ["TEAM_ID"])
    time.sleep(sleep_sec)

    # Advanced per-100 stats (Off/Def/Net Rating, TS%, AST/TO, OREB%, DREB%, Pace)
    adv_df = fetch_team("Advanced", "Per100Possessions", season, season_type, rank="Y")[["TEAM_ID", "OFF_RATING", "OFF_RATING_RANK", "DEF_RATING", "DEF_RATING_RANK", "NET_RATING", "NET_RATING_RANK", "TS_PCT", "AST_TO", "OREB_PCT", "DREB_PCT", "PACE"]]
    adv_p100 = rename_with_suffix(adv_df, "_Per100", ["TEAM_ID"])
    time.sleep(sleep_sec)

    # Shot profile (rim + threes share of attempts)
    shot_loc = fetch_shot_locations(season, season_type)
    shot_loc.columns = ["_".join([str(x) for x in tup if x not in (None, "")]) for tup in shot_loc.columns.values]
    shot_cols = ["Restricted Area_FGA", "In The Paint (Non-RA)_FGA", "Mid-Range_FGA", "Above the Break 3_FGA", "Corner 3_FGA"]
    rim3_cols = ["Restricted Area_FGA", "Above the Break 3_FGA", "Corner 3_FGA"]
    shot_loc["TOTAL_FGA"] = shot_loc[shot_cols].sum(axis=1)
    shot_loc["RIM_3_RATE"] = shot_loc[rim3_cols].sum(axis=1) / shot_loc["TOTAL_FGA"].replace(0, np.nan)
    shot_loc = shot_loc[["TEAM_ID", "RIM_3_RATE", "TOTAL_FGA"]]
    time.sleep(sleep_sec)

    # Hustle per-game
    hustle_df = fetch_hustle("PerGame", season, season_type)[["TEAM_ID", "CONTESTED_SHOTS", "DEFLECTIONS", "LOOSE_BALLS_RECOVERED", "CHARGES_DRAWN", "SCREEN_ASSISTS"]]
    hustle_pg = rename_with_suffix(hustle_df, "_PerGame", ["TEAM_ID"])
    time.sleep(sleep_sec)

    # Clutch per-100
    base_clutch_df = fetch_clutch("Base", "Per100Possessions", season, season_type)[["TEAM_ID", "W_PCT", "TOV"]]
    base_clutch_p100 = rename_with_suffix(base_clutch_df, "_Clutch", ["TEAM_ID"])
    time.sleep(sleep_sec)

    # Advanced clutch per-100
    adv_clutch_df = fetch_clutch("Advanced", "Per100Possessions", season, season_type)[["TEAM_ID", "NET_RATING", "TS_PCT"]]
    adv_clutch_p100 = rename_with_suffix(adv_clutch_df, "_Clutch", ["TEAM_ID"])
    time.sleep(sleep_sec)

    # Defense tracking (opponent FG% diff)
    defense_trk = fetch_defense_tracking("PerGame", season, season_type)[["TEAM_ID", "PCT_PLUSMINUS"]]
    time.sleep(sleep_sec)

    # Standings (conference + seed)
    standings_df = fetch_standings(season, season_type)[["TeamID", "Conference", "PlayoffRank", "Record"]].rename(columns={"TeamID": "TEAM_ID"})
    time.sleep(sleep_sec)

    # Merge everything on TEAM_ID
    df = base_pg.copy()
    for frame in (misc_pg, adv_p100, shot_loc, hustle_pg, base_clutch_p100, adv_clutch_p100, defense_trk, standings_df):
        df = df.merge(frame, on="TEAM_ID", how="left")

    # Filter for NBA teams only
    nba_id_to_abbr = {
        int(t.get("id")): t.get("abbreviation")
        for t in static_teams.get_teams()
    }
    allowed_ids = set(nba_id_to_abbr.keys())
    df = df[df["TEAM_ID"].isin(allowed_ids)].copy()
    df["TEAM_ABBREVIATION"] = df["TEAM_ID"].map(nba_id_to_abbr)

    return df


# -----------------------------
# Ratings calculation
# -----------------------------


def compute_metrics(df: pd.DataFrame) -> pd.DataFrame:
    # Offense
    off_rtg_raw = pd.to_numeric(df["OFF_RATING_Per100"], errors="coerce")
    ts_pct_raw = pd.to_numeric(df["TS_PCT_Per100"], errors="coerce")
    ast_to_raw = pd.to_numeric(df["AST_TO_Per100"], errors="coerce")
    rim3_raw = pd.to_numeric(df["RIM_3_RATE"], errors="coerce")
    offense_z = (
        z_robust(off_rtg_raw) * 0.40
        + z_robust(ts_pct_raw) * 0.40
        + z_robust(ast_to_raw) * 0.10
        + z_robust(rim3_raw) * 0.10
    )

    # Defense
    def_rtg_raw = pd.to_numeric(df["DEF_RATING_Per100"], errors="coerce")
    opp_fg_diff = pd.to_numeric(df["PCT_PLUSMINUS"], errors="coerce")
    dreb_pct_raw = pd.to_numeric(df["DREB_PCT_Per100"], errors="coerce")
    opp_paint_raw = pd.to_numeric(df["OPP_PTS_PAINT_PerGame"], errors="coerce")
    defense_z = (
        (-z_robust(def_rtg_raw)) * 0.40
        + (-z_robust(opp_fg_diff)) * 0.25
        + z_robust(dreb_pct_raw) * 0.20
        + (-z_robust(opp_paint_raw)) * 0.15
    )

    # Pace & Pressure
    pace_raw = pd.to_numeric(df["PACE_Per100"], errors="coerce")
    pts_off_tov_raw = pd.to_numeric(df["PTS_OFF_TOV_PerGame"], errors="coerce")
    pts_fb_raw = pd.to_numeric(df["PTS_FB_PerGame"], errors="coerce")
    pts_second_raw = pd.to_numeric(df["PTS_2ND_CHANCE_PerGame"], errors="coerce")
    oreb_pct_raw = pd.to_numeric(df["OREB_PCT_Per100"], errors="coerce")
    pace_z = (
        z_robust(pace_raw) * 0.30
        + z_robust(pts_off_tov_raw) * 0.15
        + z_robust(pts_fb_raw) * 0.20
        + z_robust(pts_second_raw) * 0.15
        + z_robust(oreb_pct_raw) * 0.20
    )

    # Hustle
    screen_assists_raw = pd.to_numeric(df["SCREEN_ASSISTS_PerGame"], errors="coerce")
    deflections_raw = pd.to_numeric(df["DEFLECTIONS_PerGame"], errors="coerce")
    loose_balls_raw = pd.to_numeric(df["LOOSE_BALLS_RECOVERED_PerGame"], errors="coerce")
    charges_raw = pd.to_numeric(df["CHARGES_DRAWN_PerGame"], errors="coerce")
    contested_raw = pd.to_numeric(df["CONTESTED_SHOTS_PerGame"], errors="coerce")
    hustle_z = pd.concat(
        [
            z_robust(screen_assists_raw),
            z_robust(deflections_raw),
            z_robust(loose_balls_raw),
            z_robust(charges_raw),
            z_robust(contested_raw),
        ],
        axis=1,
    ).mean(axis=1)

    # Clutch
    clutch_net_raw = pd.to_numeric(df["NET_RATING_Clutch"], errors="coerce")
    clutch_win_raw = pd.to_numeric(df["W_PCT_Clutch"], errors="coerce")
    clutch_ts_raw = pd.to_numeric(df["TS_PCT_Clutch"], errors="coerce")
    clutch_tov = pd.to_numeric(df["TOV_Clutch"], errors="coerce")
    clutch_z = (
        z_robust(clutch_net_raw) * 0.45
        + z_robust(clutch_win_raw) * 0.25
        + z_robust(clutch_ts_raw) * 0.15
        + (-z_robust(clutch_tov)) * 0.15
    )

    df["OFFENSE_Z"], df["DEFENSE_Z"], df["PACE_Z"], df["HUSTLE_Z"], df["CLUTCH_Z"] = (
        offense_z,
        defense_z,
        pace_z,
        hustle_z,
        clutch_z,
    )

    df["OFFENSE_RTG"] = rating_1_99(df["OFFENSE_Z"])
    df["DEFENSE_RTG"] = rating_1_99(df["DEFENSE_Z"])
    df["PACE_RTG"] = rating_1_99(df["PACE_Z"])
    df["HUSTLE_RTG"] = rating_1_99(df["HUSTLE_Z"])
    df["CLUTCH_RTG"] = rating_1_99(df["CLUTCH_Z"])

    name_col = "TEAM_NAME"
    print(df[[name_col, "OFFENSE_RTG", "DEFENSE_RTG", "CLUTCH_RTG"]].sort_values("OFFENSE_RTG", ascending=False).head(10))
    return df


# -----------------------------
# Stats & ratings storage
# -----------------------------


def to_json_rows(
    df: pd.DataFrame,
    elo_history: Optional[Dict[int, List[Dict[str, object]]]] | None = None,
    game_results: Optional[Dict[int, List[Dict[str, object]]]] | None = None,
) -> List[Dict]:
    rows: List[Dict] = []
    history_map = elo_history or {}
    results_map = game_results or {}

    for row in df.itertuples(index=False, name="TeamRow"):
        r = row._asdict()
        team_id = safe_int(r.get("TEAM_ID"))

        category_ratings = {
            "offense": safe_int(r.get("OFFENSE_RTG")),
            "defense": safe_int(r.get("DEFENSE_RTG")),
            "pacePressure": safe_int(r.get("PACE_RTG")),
            "hustle": safe_int(r.get("HUSTLE_RTG")),
            "clutch": safe_int(r.get("CLUTCH_RTG")),
        }

        team_stats = {
            "offRating": safe_float(r.get("OFF_RATING_Per100")),
            "offRatingRank": safe_int(r.get("OFF_RATING_RANK_Per100")),
            "defRating": safe_float(r.get("DEF_RATING_Per100")),
            "defRatingRank": safe_int(r.get("DEF_RATING_RANK_Per100")),
            "netRating": safe_float(r.get("NET_RATING_Per100")),
            "netRatingRank": safe_int(r.get("NET_RATING_RANK_Per100")),
            "threesPerGame": safe_float(r.get("FG3M_PerGame")),
            "threesPerGameRank": safe_int(r.get("FG3M_RANK_PerGame")),
            "turnoversPerGame": safe_float(r.get("TOV_PerGame")),
            "turnoversPerGameRank": safe_int(r.get("TOV_RANK_PerGame")),
            "plusMinus": safe_float(r.get("PLUS_MINUS_PerGame")),
            "plusMinusRank": safe_int(r.get("PLUS_MINUS_RANK_PerGame")),
            "fgPct": safe_float(r.get("FG_PCT_PerGame")),
            "fgPctRank": safe_int(r.get("FG_PCT_RANK_PerGame")),
            "fg3Pct": safe_float(r.get("FG3_PCT_PerGame")),
            "fg3PctRank": safe_int(r.get("FG3_PCT_RANK_PerGame")),
            "ftPct": safe_float(r.get("FT_PCT_PerGame")),
            "ftPctRank": safe_int(r.get("FT_PCT_RANK_PerGame")),
        }

        rows.append(
            {
                "teamId": team_id,
                "name": str(r.get("TEAM_NAME")),
                "abbreviation": str(r.get("TEAM_ABBREVIATION")),
                "conference": r.get("Conference"),
                "seed": safe_int(r.get("PlayoffRank")),
                "record": r.get("Record"),
                "categoryRatings": category_ratings,
                "teamStats": team_stats,
                "elo": {
                    "current": safe_float(r.get("ELO")),
                    "history": history_map.get(team_id, []),
                },
                "games": results_map.get(team_id, []),
            }
        )
    return rows


# -----------------------------
# Entrypoint
# -----------------------------


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--out", default="public/data/teams.json")
    ap.add_argument("--sleep", type=float, default=0.1, help="seconds between requests")
    args = ap.parse_args()

    df = build_dataset(args.season, args.season_type, sleep_sec=args.sleep)
    df = compute_metrics(df)
    allowed_ids = {int(t.get("id")) for t in static_teams.get_teams()}
    elo_map, elo_history, game_results = compute_elo_from_logs(args.season, args.season_type, allowed_ids=allowed_ids)
    df["ELO"] = df["TEAM_ID"].map(elo_map).fillna(1500.0)

    payload = {
        "season": args.season,
        "seasonType": args.season_type,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "teams": to_json_rows(df, elo_history, game_results),
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {args.out} with {len(payload['teams'])} teams")


if __name__ == "__main__":
    main()
