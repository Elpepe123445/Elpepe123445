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


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, n)
    sd = close.rolling(n, min_periods=n).std()
    up, lo = mid + k * sd, mid - k * sd
    return pd.DataFrame({"mid": mid, "upper": up, "lower": lo, "pct_b": (close - lo) / (up - lo)})


def rolling_vwap(df: pd.DataFrame, n: int = 20) -> pd.Series:
    """VWAP de n sesiones con el VWAP diario de cada vela (campo 'vw' de Alpaca) o, si falta, el precio típico.

    Con barras diarias no es el VWAP intradía clásico: es un precio medio ponderado por volumen de n días.
    """
    px = df["vwap"] if "vwap" in df else (df["high"] + df["low"] + df["close"]) / 3
    pv = (px * df["volume"]).rolling(n, min_periods=n).sum()
    return pv / df["volume"].rolling(n, min_periods=n).sum()


def support_resistance(df: pd.DataFrame, lookback: int = 120, window: int = 5, tol: float = 0.015) -> dict:
    """Niveles a partir de máximos/mínimos locales agrupados (tolerancia relativa). Descriptivo, no predictivo."""
    d = df.tail(lookback)
    hi, lo = d["high"], d["low"]
    piv_h = hi[(hi == hi.rolling(2 * window + 1, center=True).max())].dropna()
    piv_l = lo[(lo == lo.rolling(2 * window + 1, center=True).min())].dropna()
    levels: list[list[float]] = []
    for v in sorted(list(piv_h.values) + list(piv_l.values)):
        if levels and abs(v / np.mean(levels[-1]) - 1) <= tol:
            levels[-1].append(v)
        else:
            levels.append([v])
    price = float(df["close"].iloc[-1])
    lv = [(round(float(np.mean(g)), 2), len(g)) for g in levels]
    sup = [x for x in lv if x[0] < price]
    res = [x for x in lv if x[0] > price]
    return {"support": max(sup)[0] if sup else None, "support_touches": max(sup)[1] if sup else 0,
            "resistance": min(res)[0] if res else None, "resistance_touches": min(res)[1] if res else 0}


def technical_snapshot(df: pd.DataFrame) -> dict:
    c = df["close"]
    m = macd(c)
    bb = bollinger(c)
    vw = rolling_vwap(df)
    sr = support_resistance(df)
    vol = volatility(c)
    vol_pct = float((vol.rank(pct=True)).iloc[-1]) if vol.notna().sum() > 60 else None
    return {
        "close": round(float(c.iloc[-1]), 2),
        "ret_1d_pct": round(float(c.iloc[-1] / c.iloc[-2] - 1) * 100, 2),
        "ret_5d_pct": round(float(c.iloc[-1] / c.iloc[-6] - 1) * 100, 2),
        "ret_20d_pct": round(float(c.iloc[-1] / c.iloc[-21] - 1) * 100, 2),
        "ret_1d_z": round(float((c.pct_change().iloc[-1]) / c.pct_change().tail(61).head(60).std()), 2),
        "rsi14": round(float(rsi(c).iloc[-1]), 1),
        "macd_hist": round(float(m["hist"].iloc[-1]), 3),
        "macd_above_signal": bool(m["macd"].iloc[-1] > m["signal"].iloc[-1]),
        "above_sma50": bool(c.iloc[-1] > sma(c, 50).iloc[-1]),
        "above_sma200": bool(c.iloc[-1] > sma(c, 200).iloc[-1]) if len(c) >= 200 else None,
        "trend50": int(trend(c).iloc[-1]),
        "trend_change_last_10d": bool(trend_changes(c).tail(10).any()),
        "bollinger_pct_b": round(float(bb["pct_b"].iloc[-1]), 2),
        "vs_vwap20_pct": round(float(c.iloc[-1] / vw.iloc[-1] - 1) * 100, 2),
        "volume_ratio20": round(float(volume_ratio(df["volume"]).iloc[-1]), 2),
        "vol20_ann_pct": round(float(vol.iloc[-1]) * 100, 1),
        "vol_percentile_1y": round(vol_pct, 2) if vol_pct is not None else None,
        "momentum_126d_pct": round(float(c.iloc[-1] / c.iloc[-127] - 1) * 100, 1) if len(c) > 127 else None,
        **sr,
    }
