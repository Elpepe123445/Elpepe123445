"""Recopilación de datos históricos diarios con caché local en CSV."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .config import ROOT

log = logging.getLogger(__name__)
CACHE_DIR = ROOT / "data"


def bars_to_frame(bars: list[dict]) -> pd.DataFrame:
    if not bars:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    df = pd.DataFrame(bars).rename(columns={"t": "time", "o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
    df["time"] = pd.to_datetime(df["time"], utc=True).dt.tz_convert("America/New_York").dt.normalize().dt.tz_localize(None)
    df = df.set_index("time")[["open", "high", "low", "close", "volume"]].astype(float)
    return df[~df.index.duplicated(keep="last")].sort_index()


def validate_bars(df: pd.DataFrame) -> list[str]:
    """Comprobaciones de calidad; devuelve advertencias."""
    warns = []
    if df.empty:
        return ["Sin datos"]
    if (df[["open", "high", "low", "close"]] <= 0).any().any():
        warns.append("Precios no positivos detectados")
    if (df["high"] < df[["open", "close"]].max(axis=1) - 1e-9).any():
        warns.append("Barras con high < max(open, close)")
    gaps = df.index.to_series().diff().dt.days
    if (gaps > 5).any():
        warns.append(f"{int((gaps > 5).sum())} huecos de más de 5 días en la serie")
    return warns


def load_history(client, symbol: str, start: str, refresh: bool = False) -> pd.DataFrame:
    CACHE_DIR.mkdir(exist_ok=True)
    path: Path = CACHE_DIR / f"{symbol}_1Day.csv"
    if path.exists() and not refresh:
        age_s = (datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)).total_seconds()
        cached = pd.read_csv(path, index_col=0, parse_dates=True)
        if age_s < 6 * 3600 and not cached.empty and cached.index.min() <= pd.Timestamp(start) + pd.Timedelta(days=7):
            return cached[cached.index >= pd.Timestamp(start)]
    log.info("Descargando barras diarias de %s desde %s (feed IEX)", symbol, start)
    # Excluimos la barra del día en curso: puede estar incompleta.
    end = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
    df = bars_to_frame(client.get_bars(symbol, start=start, end=end))
    df.to_csv(path)
    for w in validate_bars(df):
        log.warning("%s: %s", symbol, w)
    return df
