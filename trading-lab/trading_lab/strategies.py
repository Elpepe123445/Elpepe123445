"""Estrategias experimentales (solo largo / liquidez; sin cortos ni apalancamiento).

Cada estrategia transforma un DataFrame OHLCV en una serie de exposición objetivo
en {0, 1} calculada con la información disponible AL CIERRE de cada sesión.
El backtest ejecuta ese objetivo en la APERTURA de la sesión siguiente, de modo
que ninguna decisión usa datos que todavía no existían (sin look-ahead).

Las hipótesis son eso, hipótesis: el backtest sirve para intentar refutarlas.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from . import indicators as ind


@dataclass(frozen=True)
class Strategy:
    name: str
    hypothesis: str
    defaults: dict
    fn: Callable[[pd.DataFrame, dict], pd.Series]

    def signals(self, df: pd.DataFrame, params: dict | None = None) -> pd.Series:
        p = {**self.defaults, **(params or {})}
        s = self.fn(df, p).astype(float).fillna(0.0).clip(0, 1)
        return s.rename(self.name)


def _latch(entry: pd.Series, exit_: pd.Series) -> pd.Series:
    """Convierte señales de entrada/salida en una posición mantenida."""
    state = pd.Series(np.nan, index=entry.index)
    state[exit_.fillna(False)] = 0.0
    state[entry.fillna(False)] = 1.0
    return state.ffill().fillna(0.0)


def _ma_cross(df, p):
    c = df["close"]
    return (ind.sma(c, p["fast"]) > ind.sma(c, p["slow"])).astype(float)


def _rsi_mr(df, p):
    r = ind.rsi(df["close"], p["period"])
    entry = r < p["oversold"]
    if p.get("trend_filter", 0):
        # Solo compra caídas dentro de una tendencia de largo plazo alcista.
        entry &= df["close"] > ind.sma(df["close"], p["trend_filter"])
    return _latch(entry, r > p["exit_level"])


def _macd_trend(df, p):
    m = ind.macd(df["close"], p["fast"], p["slow"], p["signal"])
    cond = m["macd"] > m["signal"]
    if p.get("require_positive", 0):
        cond &= m["macd"] > 0
    return cond.astype(float)


def _momentum(df, p):
    c = df["close"]
    ret = c / c.shift(p["lookback"]) - 1
    return (ret > p["threshold"]).astype(float)


def _breakout(df, p):
    upper = df["high"].shift(1).rolling(p["entry_window"], min_periods=p["entry_window"]).max()
    lower = df["low"].shift(1).rolling(p["exit_window"], min_periods=p["exit_window"]).min()
    entry = df["close"] > upper
    if p.get("volume_confirm", 0):
        entry &= ind.volume_ratio(df["volume"], 20) > p["volume_confirm"]
    return _latch(entry, df["close"] < lower)


STRATEGIES: dict[str, Strategy] = {
    s.name: s
    for s in [
        Strategy(
            "ma_crossover",
            "Las tendencias persisten: cuando la media rápida supera a la lenta, el precio "
            "tiende a seguir subiendo durante un tiempo. Falla en mercados laterales (whipsaw).",
            {"fast": 20, "slow": 100},
            _ma_cross,
        ),
        Strategy(
            "rsi_mean_reversion",
            "Las caídas bruscas a corto plazo (RSI bajo) tienden a revertir parcialmente. "
            "Falla cuando la caída es el inicio de una tendencia bajista; el filtro de tendencia lo mitiga.",
            {"period": 14, "oversold": 30, "exit_level": 55, "trend_filter": 200},
            _rsi_mr,
        ),
        Strategy(
            "macd_trend",
            "El cruce de MACD sobre su señal indica aceleración del impulso alcista. "
            "Genera muchas señales falsas en rangos; reacciona con retraso.",
            {"fast": 12, "slow": 26, "signal": 9, "require_positive": 1},
            _macd_trend,
        ),
        Strategy(
            "momentum",
            "Activos con rentabilidad positiva en los últimos meses tienden a seguir rindiendo "
            "(efecto momentum de series temporales). Sufre en giros bruscos del mercado.",
            {"lookback": 126, "threshold": 0.0},
            _momentum,
        ),
        Strategy(
            "breakout",
            "Un cierre por encima del máximo de N sesiones (canal de Donchian) indica el inicio de "
            "un movimiento direccional. Muchas rupturas fallan; depende de pocas operaciones grandes.",
            {"entry_window": 55, "exit_window": 20, "volume_confirm": 0},
            _breakout,
        ),
    ]
}


def get(name: str) -> Strategy:
    if name not in STRATEGIES:
        raise KeyError(f"Estrategia desconocida: {name}. Disponibles: {list(STRATEGIES)}")
    return STRATEGIES[name]


def evaluate_signal_quality(df: pd.DataFrame, signal: pd.Series, horizons=(5, 10, 20)) -> dict:
    """Evaluación DIAGNÓSTICA de señales: mira retornos futuros tras cada entrada.

    Usa datos futuros a propósito para medir la señal a posteriori; nunca se usa para operar.
    """
    entries = signal.diff().fillna(signal) > 0
    out = {"entries": int(entries.sum())}
    c = df["close"]
    base = c.shift(-1)  # se entra en la sesión siguiente
    for h in horizons:
        fwd = (c.shift(-1 - h) / base - 1)[entries].dropna()
        uncond = (c.shift(-1 - h) / base - 1).dropna()
        out[f"fwd_{h}d"] = {
            "mean_pct": round(float(fwd.mean()) * 100, 3) if len(fwd) else None,
            "hit_rate_pct": round(float((fwd > 0).mean()) * 100, 1) if len(fwd) else None,
            "unconditional_mean_pct": round(float(uncond.mean()) * 100, 3) if len(uncond) else None,
            "n": int(len(fwd)),
        }
    return out
