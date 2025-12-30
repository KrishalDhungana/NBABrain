from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd
from scipy.stats import rankdata


def rename_with_suffix(df: pd.DataFrame, suffix: str, preserve: Iterable[str] | None = None) -> pd.DataFrame:
    """Rename columns with a suffix while keeping identifier columns intact."""
    if not suffix:
        return df
    preserve_set = set(preserve or [])
    rename_map = {col: f"{col}{suffix}" for col in df.columns if col not in preserve_set}
    return df.rename(columns=rename_map)


def winsorize(s: pd.Series, lo: float = 0.02, hi: float = 0.98) -> pd.Series:
    """Trim outliers to reduce the impact of extreme values."""
    x = pd.to_numeric(s, errors="coerce")
    qlo, qhi = x.quantile(lo), x.quantile(hi)
    return x.clip(qlo, qhi)


def z_robust(s: pd.Series) -> pd.Series:
    """Compute a clipped Z-score with winsorization for stability."""
    x = winsorize(s)
    mu, sd = x.mean(), x.std(ddof=0)
    if not sd or np.isnan(sd):
        return pd.Series(0.0, index=s.index)
    return ((x - mu) / sd).clip(-3, 3)


def rating_1_99(s: pd.Series) -> pd.Series:
    """Map a series to 1–99 ratings based on rank percentile."""
    x = pd.to_numeric(s, errors="coerce")
    n_valid = int(x.notna().sum())
    if n_valid == 0:
        return pd.Series(np.nan, index=s.index)
    ranks = rankdata(x.dropna(), method="average")
    pct = (ranks - 0.5) / n_valid
    mapped = pd.Series(np.nan, index=s.index)
    mapped.loc[x.dropna().index] = np.round(1 + 98 * pct).astype(int)
    return mapped.clip(1, 99)


def safe_float(x):
    try:
        if x is None:
            return None
        val = float(x)
    except Exception:
        return None
    return None if np.isnan(val) else val


def safe_int(x):
    try:
        if x is None:
            return None
        val = float(x)
    except Exception:
        return None
    return None if np.isnan(val) else int(val)
