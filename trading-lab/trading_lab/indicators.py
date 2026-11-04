"""Indicadores técnicos. Todos son causales: el valor en t usa solo datos hasta t.

Un indicador describe el pasado; no garantiza ninguna predicción.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    """RSI de Wilder."""
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    rs = gain / loss.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    return out.where(loss != 0, 100.0).where(gain.notna())


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "signal": sig, "hist": line - sig})


def volatility(close: pd.Series, n: int = 20, annualize: bool = True) -> pd.Series:
    """Desviación típica de los retornos logarítmicos (anualizada con 252 sesiones)."""
    v = np.log(close).diff().rolling(n, min_periods=n).std()
    return v * np.sqrt(252) if annualize else v


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    prev = df["close"].shift(1)
    tr = pd.concat([df["high"] - df["low"], (df["high"] - prev).abs(), (df["low"] - prev).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def volume_ratio(volume: pd.Series, n: int = 20) -> pd.Series:
    """Volumen actual / media de las n sesiones anteriores."""
    return volume / volume.shift(1).rolling(n, min_periods=n).mean()


def trend(close: pd.Series, n: int = 50) -> pd.Series:
    """+1 alcista, -1 bajista, 0 indefinido: precio frente a SMA y pendiente de la SMA."""
    m = sma(close, n)
    slope = m.diff(5)
    up = (close > m) & (slope > 0)
    down = (close < m) & (slope < 0)
    out = pd.Series(0, index=close.index, dtype=float)
    out[up] = 1
    out[down] = -1
    return out.where(m.notna())


def trend_changes(close: pd.Series, n: int = 50) -> pd.Series:
    """Marca las fechas donde el régimen de tendencia cambia de signo (ignora el 0)."""
    t = trend(close, n).replace(0, np.nan).ffill()
    return (t != t.shift(1)) & t.shift(1).notna()


def price_volume_summary(df: pd.DataFrame) -> dict:
    c = df["close"]
    r = c.pct_change()
    last = df.index[-1]
    return {
        "last_date": str(last.date()),
        "last_close": round(float(c.iloc[-1]), 2),
        "ret_1m_pct": round(float(c.iloc[-1] / c.iloc[-22] - 1) * 100, 2) if len(c) > 22 else None,
        "ret_3m_pct": round(float(c.iloc[-1] / c.iloc[-64] - 1) * 100, 2) if len(c) > 64 else None,
        "vol_20d_ann_pct": round(float(volatility(c).iloc[-1]) * 100, 2) if len(c) > 21 else None,
        "rsi_14": round(float(rsi(c).iloc[-1]), 1) if len(c) > 15 else None,
        "trend_50": int(trend(c).iloc[-1]) if len(c) > 56 else None,
        "volume_ratio_20": round(float(volume_ratio(df["volume"]).iloc[-1]), 2) if len(c) > 21 else None,
        "worst_day_pct": round(float(r.min()) * 100, 2),
    }
