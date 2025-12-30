"""
player_pipeline.py
-------------------
Fetches league-wide player data from nba_api, computes per-category ratings and a
position-aware overall rating, and writes a compact JSON to public/data/players.json
for the frontend to consume.

Usage (from repo root):
  # 1) Install deps (prefer venv)
  pip install nba_api pandas numpy scipy tqdm requests

  # 2) Run the pipeline
  python data-pipelines/player_pipeline.py --season 2025-26 --season-type "Regular Season" --out public/data/players.json

Notes:
  - The nba_api servers rate-limit. This script throttles requests; adjust --sleep.
  - If some columns are missing in given endpoints (schema drift), the script will
    skip them gracefully. You can tweak column maps below.
  - The ratings formulas follow the specification shared in the app context.
"""


# -----------------------------
# Imports
# -----------------------------


from __future__ import annotations

import argparse
import json
import time
from typing import Dict, List

import numpy as np
import pandas as pd
from pipeline_utils import rating_1_99, rename_with_suffix, safe_float, safe_int, z_robust

try:
    from nba_api.stats.endpoints import (
        leaguedashplayerstats,
        leaguehustlestatsplayer,
        leaguedashptstats,
        leaguedashptdefend,
        playerindex,
    )
except Exception as e:
    raise SystemExit(
        "nba_api is required. Install with: pip install nba_api\n"
        f"Import error: {e}"
    )


# -----------------------------
# Helpers
# -----------------------------


def qualify(df: pd.DataFrame, min_minutes: float = 12.0, min_games: int = 5) -> pd.DataFrame:
    minutes = pd.to_numeric(df["MIN_PerGame"], errors="coerce")
    games = pd.to_numeric(df["GP"], errors="coerce")
    mask = minutes >= min_minutes
    if not games.isna().all():
        mask &= games >= min_games
    return df.loc[mask].copy()


# -----------------------------
# Fetch functions
# -----------------------------


def fetch_league(measure_type: str = "Base", per_mode: str = "Per100Possessions", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashplayerstats.LeagueDashPlayerStats(
        measure_type_detailed_defense=measure_type,
        per_mode_detailed=per_mode,
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_tracking(pt_measure_type: str = "Passing", player_or_team: str = "Player", per_mode: str = "PerGame", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashptstats.LeagueDashPtStats(
        pt_measure_type=pt_measure_type,
        player_or_team=player_or_team,
        per_mode_simple=per_mode,
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_hustle(per_mode: str = "Per36", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguehustlestatsplayer.LeagueHustleStatsPlayer(
        season=season,
        per_mode_time=per_mode,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_tracking_defense(per_mode: str = "PerGame", season: str = "2025-26", season_type: str = "Regular Season") -> pd.DataFrame:
    res = leaguedashptdefend.LeagueDashPtDefend(
        per_mode_simple=per_mode,
        season=season,
        season_type_all_star=season_type,
    )
    return res.get_data_frames()[0]


def fetch_player_index(season: str = "2025-26") -> pd.DataFrame:
    res = playerindex.PlayerIndex(
        season=season,
    )
    return res.get_data_frames()[0]


# -----------------------------
# Data retrieval pipeline
# -----------------------------


def build_dataset(season: str = "2025-26", season_type: str = "Regular Season", sleep_sec: float = 0.6) -> pd.DataFrame:
    # Base per-game
    # pd.set_option('display.max_columns', None)
    base_pg = fetch_league("Base", "PerGame", season, season_type)[["PLAYER_ID", "GP", "MIN", "FGM", "FGA", "FG_PCT", "FG3M", "FG3A", "FG3_PCT", "FTM", "FTA", "FT_PCT", "REB", "AST", "TOV", "STL", "BLK", "PTS", "PLUS_MINUS", "NBA_FANTASY_PTS"]]
    base_pg = rename_with_suffix(base_pg, "_PerGame", ["PLAYER_ID", "GP"])
    time.sleep(sleep_sec)

    # Advanced per-game (using Per100Possessions is redundant here; same as PerGame)
    adv_pg = fetch_league("Advanced", "PerGame", season, season_type)[["PLAYER_ID", "OFF_RATING", "DEF_RATING", "NET_RATING", "AST_PCT", "AST_TO", "OREB_PCT", "DREB_PCT", "TS_PCT", "USG_PCT", "PIE"]]
    adv_pg = rename_with_suffix(adv_pg, "_PerGame", ["PLAYER_ID"])
    time.sleep(sleep_sec)

    # Base per-100
    base_p100 = fetch_league("Base", "Per100Possessions", season, season_type)[["PLAYER_ID", "PTS", "PF"]]
    base_p100 = rename_with_suffix(base_p100, "_Per100Possessions", ["PLAYER_ID"])
    time.sleep(sleep_sec)

    # Hustle per-36
    hustle_p36 = fetch_hustle("Per36", season, season_type)[["PLAYER_ID", "CONTESTED_SHOTS", "DEFLECTIONS", "CHARGES_DRAWN", "SCREEN_ASSISTS", "LOOSE_BALLS_RECOVERED", "BOX_OUTS"]]
    hustle_p36 = rename_with_suffix(hustle_p36, "_Per36", ["PLAYER_ID"])
    time.sleep(sleep_sec)

    # Defense per-game (using Per100Possessions is redundant here; same as PerGame)
    defense_pg = fetch_league("Defense", "PerGame", season, season_type)[["PLAYER_ID", "PCT_STL", "PCT_BLK"]] # using Per100Possessions is redundant here; same as PerGame
    defense_pg = rename_with_suffix(defense_pg, "_PerGame", ["PLAYER_ID"])
    time.sleep(sleep_sec)

    # Defense tracking per-game
    defense_trk_pg = fetch_tracking_defense("PerGame", season, season_type)[["CLOSE_DEF_PERSON_ID", "PCT_PLUSMINUS"]] # lower PCT_PLUSMINUS is better (indicates defended fg% is less than normal fg%)
    defense_trk_pg = rename_with_suffix(defense_trk_pg, "_PerGame", ["CLOSE_DEF_PERSON_ID"])
    defense_trk_pg.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"}, inplace=True)
    time.sleep(sleep_sec)
    
    # Passing tracking per-game
    passing_trk_pg = fetch_tracking("Passing", "Player", "PerGame", season, season_type)[["PLAYER_ID", "POTENTIAL_AST"]] # may be a good idea to convert potential assists per-game to per-36; endpoint doesn't provide per-36 (or if per 100 possessions is possible, that's better)
    passing_trk_pg = rename_with_suffix(passing_trk_pg, "_PerGame", ["PLAYER_ID"])
    time.sleep(sleep_sec)

    # Player info
    player_info = fetch_player_index(season)[["PERSON_ID", "PLAYER_LAST_NAME", "PLAYER_FIRST_NAME", "TEAM_ID", "TEAM_CITY", "TEAM_NAME", "TEAM_ABBREVIATION", "JERSEY_NUMBER", "POSITION", "HEIGHT", "WEIGHT"]]
    player_info.rename(columns={"PERSON_ID": "PLAYER_ID"}, inplace=True)
    time.sleep(sleep_sec)

    # Merge all data on PLAYER_ID
    df = player_info.copy()
    for frame in (base_pg, adv_pg, base_p100, hustle_p36, defense_pg, defense_trk_pg, passing_trk_pg):
        df = df.merge(frame, on="PLAYER_ID", how="inner")

    return df


# -----------------------------
# Helpers
# -----------------------------


def z_group(s: pd.Series, groups: pd.Series, minutes: pd.Series | None = None) -> pd.Series:
    out = pd.Series(index=s.index, dtype=float)
    for g, idx in groups.groupby(groups).groups.items():
        out.loc[idx] = z_robust(s.loc[idx])
    if minutes is not None:
        w = pd.to_numeric(minutes, errors="coerce").fillna(0).clip(0, 24) / 24.0
        out = out * w  # shrink to 0 for low-minute players
    return out


# -----------------------------
# Ratings calculation
# -----------------------------


def compute_metrics(df: pd.DataFrame) -> pd.DataFrame:
    # Aux (position & minutes)
    pos = df["POSITION"].astype(str).str.upper().str[0]
    min_pg = pd.to_numeric(df.get("MIN_PerGame"), errors="coerce").fillna(0)
    is_g = pos.eq("G")
    is_f = pos.eq("F")

    # Scoring
    pts_p100 = pd.to_numeric(df["PTS_Per100Possessions"], errors="coerce")
    ts_pct = pd.to_numeric(df["TS_PCT_PerGame"], errors="coerce")
    usg_pct = pd.to_numeric(df["USG_PCT_PerGame"], errors="coerce")
    sco_z = (z_robust(pts_p100) * 0.50 + # consider league-wide Z-scores 
             z_robust(ts_pct) * 0.40 +
             z_robust(usg_pct) * 0.10)
    sco_z *= min_pg.clip(0, 24) / 24.0 # shrink for light minutes

    # Playmaking
    ast_pct = pd.to_numeric(df["AST_PCT_PerGame"], errors="coerce")
    ast_to = pd.to_numeric(df["AST_TO_PerGame"], errors="coerce")
    pot_ast = pd.to_numeric(df["POTENTIAL_AST_PerGame"], errors="coerce")
    ply_z = (z_group(ast_pct, pos, min_pg) * 0.50 + # role-sensitive; consider groupwise Z-scores
             z_robust(ast_to)              * 0.20 +
             z_group(pot_ast, pos, min_pg) * 0.30)

    # Rebounding
    dreb_pct = pd.to_numeric(df["DREB_PCT_PerGame"], errors="coerce")
    oreb_pct = pd.to_numeric(df["OREB_PCT_PerGame"], errors="coerce")
    box36 = pd.to_numeric(df["BOX_OUTS_Per36"], errors="coerce")
    reb_z = (z_group(dreb_pct, pos, min_pg) * 0.35 + 
             z_group(oreb_pct, pos, min_pg) * 0.55 +
             z_group(box36,   pos, min_pg)  * 0.10)

    # Defending
    stl_pct = pd.to_numeric(df["PCT_STL_PerGame"], errors="coerce")
    blk_pct = pd.to_numeric(df["PCT_BLK_PerGame"], errors="coerce")
    dfg_diff = pd.to_numeric(df["PCT_PLUSMINUS_PerGame"], errors="coerce") # lower = better
    pf_p100 = pd.to_numeric(df["PF_Per100Possessions"], errors="coerce") # lower = better
    z_stl = z_group(stl_pct, pos, min_pg)
    z_blk = z_group(blk_pct, pos, min_pg)
    stl_blk_z = np.where(is_g, z_stl * 0.20 + z_blk * 0.10, # weigh steals and blocks differently per-position
                np.where(is_f, z_stl * 0.15 + z_blk * 0.15,
                               z_stl * 0.10 + z_blk * 0.20))
    def_z = pd.Series(stl_blk_z, index=df.index) + (-z_robust(dfg_diff)) * 0.60 + (-z_robust(pf_p100)) * 0.10

    # Hustle
    scr36 = pd.to_numeric(df["SCREEN_ASSISTS_Per36"], errors="coerce")
    defl36 = pd.to_numeric(df["DEFLECTIONS_Per36"], errors="coerce")
    loose36 = pd.to_numeric(df["LOOSE_BALLS_RECOVERED_Per36"], errors="coerce")
    chg36 = pd.to_numeric(df["CHARGES_DRAWN_Per36"], errors="coerce")
    cont36 = pd.to_numeric(df["CONTESTED_SHOTS_Per36"], errors="coerce")
    guard_hst = pd.concat([z_group(defl36, pos, min_pg),
                           z_group(loose36, pos, min_pg),
                           z_group(chg36,  pos, min_pg),
                           z_group(cont36, pos, min_pg)], axis=1).mean(axis=1)
    big_hst   = pd.concat([z_group(scr36,  pos, min_pg), # only include screen assists for forwards & centers
                           z_group(defl36, pos, min_pg),
                           z_group(loose36,pos, min_pg),
                           z_group(chg36, pos, min_pg),
                           z_group(cont36,pos, min_pg)], axis=1).mean(axis=1)
    hst_z = np.where(is_g, guard_hst, big_hst)
    hst_z = pd.Series(hst_z, index=df.index)

    # Impact
    pie = pd.to_numeric(df["PIE_PerGame"], errors="coerce")
    net = pd.to_numeric(df["NET_RATING_PerGame"], errors="coerce")
    imp_z = z_robust(pie) * 0.50 + z_robust(net) * 0.50

    # Persist Z-scores
    df["SCO_Z"], df["PLY_Z"], df["REB_Z"], df["DEF_Z"], df["HST_Z"], df["IMP_Z"] = sco_z, ply_z, reb_z, def_z, hst_z, imp_z

    # 1–99 category ratings
    df["SCO_RTG"] = rating_1_99(df["SCO_Z"])
    df["PLY_RTG"] = rating_1_99(df["PLY_Z"])
    df["REB_RTG"] = rating_1_99(df["REB_Z"])
    df["DEF_RTG"] = rating_1_99(df["DEF_Z"])
    df["HST_RTG"] = rating_1_99(df["HST_Z"])
    df["IMP_RTG"] = rating_1_99(df["IMP_Z"])

    # Position-aware overall ratings (combine Z-scores, then 1–99)
    def total_z(w: dict[str, float]) -> pd.Series:
        return (df["SCO_Z"] * w["SCO"] + df["PLY_Z"] * w["PLY"] + df["REB_Z"] * w["REB"] +
                df["DEF_Z"] * w["DEF"] + df["HST_Z"] * w["HST"] + df["IMP_Z"] * w["IMP"])
    guard_z   = total_z({"SCO":0.28, "PLY":0.28, "REB":0.10, "DEF":0.18, "HST":0.10, "IMP":0.06})
    forward_z = total_z({"SCO":0.28, "PLY":0.18, "REB":0.18, "DEF":0.20, "HST":0.10, "IMP":0.06})
    center_z  = total_z({"SCO":0.24, "PLY":0.10, "REB":0.26, "DEF":0.24, "HST":0.10, "IMP":0.06})
    overall_z = np.where(is_g, guard_z, np.where(is_f, forward_z, center_z))
    df["OVERALL_Z"]   = pd.Series(overall_z, index=df.index)
    df["OVERALL_RTG"] = rating_1_99(df["OVERALL_Z"])

    print(df[["PLAYER_FIRST_NAME","PLAYER_LAST_NAME","POSITION","OVERALL_RTG"]].sort_values("OVERALL_RTG", ascending=False).head(25))
    return df


# -----------------------------
# Helpers
# -----------------------------


# -----------------------------
# Stats & ratings storage
# -----------------------------


def to_json_rows(df: pd.DataFrame) -> List[Dict]:
    rows: List[Dict] = []

    def pick_row(record: Dict, *cols: str):
        for col in cols:
            if col not in record:
                continue
            val = record[col]
            if pd.isna(val):
                continue
            return val
        return None

    for row in df.itertuples(index=False, name="PlayerRow"):
        record = row._asdict()
        player_id = record.get("PLAYER_ID")
        team_id = record.get("TEAM_ID")
        first = str(record.get("PLAYER_FIRST_NAME", "") or "").strip()
        last = str(record.get("PLAYER_LAST_NAME", "") or "").strip()
        display_name = (f"{first} {last}".strip()) or str(record.get("PLAYER_NAME") or "").strip() or "Unknown"
        position = (record.get("POSITION") or "").strip().upper() or "G"

        per_game_stats = {
            "gp": safe_int(record.get("GP")),
            "min": safe_float(pick_row(record, "MIN_PerGame", "MIN")),
            "pts": safe_float(pick_row(record, "PTS_PerGame", "PTS")),
            "ast": safe_float(pick_row(record, "AST_PerGame", "AST")),
            "reb": safe_float(pick_row(record, "REB_PerGame", "REB")),
            "stl": safe_float(pick_row(record, "STL_PerGame", "STL")),
            "blk": safe_float(pick_row(record, "BLK_PerGame", "BLK")),
            "fgm": safe_float(pick_row(record, "FGM_PerGame", "FGM")),
            "fga": safe_float(pick_row(record, "FGA_PerGame", "FGA")),
            "fgPct": safe_float(pick_row(record, "FG_PCT_PerGame", "FG_PCT")),
            "ftm": safe_float(pick_row(record, "FTM_PerGame", "FTM")),
            "fta": safe_float(pick_row(record, "FTA_PerGame", "FTA")),
            "ftPct": safe_float(pick_row(record, "FT_PCT_PerGame", "FT_PCT")),
            "fg3m": safe_float(pick_row(record, "FG3M_PerGame", "FG3M")),
            "fg3a": safe_float(pick_row(record, "FG3A_PerGame", "FG3A")),
            "fg3Pct": safe_float(pick_row(record, "FG3_PCT_PerGame", "FG3_PCT")),
            "tov": safe_float(pick_row(record, "TOV_PerGame", "TOV")),
            "plusMinus": safe_float(pick_row(record, "PLUS_MINUS_PerGame", "PLUS_MINUS")),
        }

        advanced_stats = {
            "nbaFantasyPoints": safe_float(pick_row(record, "NBA_FANTASY_PTS_PerGame", "NBA_FANTASY_PTS")),
            "offRating": safe_float(pick_row(record, "OFF_RATING_PerGame", "OFF_RATING")),
            "defRating": safe_float(pick_row(record, "DEF_RATING_PerGame", "DEF_RATING")),
            "netRating": safe_float(pick_row(record, "NET_RATING_PerGame", "NET_RATING")),
            "tsPct": safe_float(pick_row(record, "TS_PCT_PerGame", "TS_PCT")),
            "usgPct": safe_float(pick_row(record, "USG_PCT_PerGame", "USG_PCT")),
            "pie": safe_float(pick_row(record, "PIE_PerGame", "PIE")),
        }

        category_ratings = {
            "sco": safe_int(record.get("SCO_RTG")),
            "ply": safe_int(record.get("PLY_RTG")),
            "reb": safe_int(record.get("REB_RTG")),
            "def": safe_int(record.get("DEF_RTG")),
            "hst": safe_int(record.get("HST_RTG")),
            "imp": safe_int(record.get("IMP_RTG")),
        }

        rows.append(
            {
                "identity": {
                    "playerId": safe_int(player_id),
                    "firstName": first,
                    "lastName": last,
                    "name": display_name,
                    "teamId": safe_int(team_id),
                    "teamCity": str(record.get("TEAM_CITY") or ""),
                    "team": str(record.get("TEAM_NAME") or ""),
                    "teamAbbreviation": str(record.get("TEAM_ABBREVIATION") or ""),
                    "jersey": str(record.get("JERSEY_NUMBER") or ""),
                    "position": position,
                    "height": str(record.get("HEIGHT") or ""),
                    "weight": str(record.get("WEIGHT") or ""),
                },
                "ratings": {
                    "perCategory": category_ratings,
                    "overall": safe_int(record.get("OVERALL_RTG")),
                },
                "stats": {
                    "perGame": per_game_stats,
                    "advanced": advanced_stats,
                },
            }
        )
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--out", default="public/data/players.json")
    ap.add_argument("--sleep", type=float, default=0.01, help="seconds between requests")
    args = ap.parse_args()

    df = build_dataset(args.season, args.season_type, sleep_sec=args.sleep)
    df = qualify(df)
    df = compute_metrics(df)

    payload = {
        "season": args.season,
        "seasonType": args.season_type,
        "lastUpdated": pd.Timestamp.utcnow().isoformat(),
        "players": to_json_rows(df),
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Wrote {args.out} with {len(payload['players'])} players")


if __name__ == "__main__":
    main()
