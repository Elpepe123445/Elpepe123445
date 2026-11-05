"""Investigación de mercado: régimen, sectores, movimientos inusuales, macro, noticias y su reacción en precio."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from .. import indicators as ind
from ..data import load_history
from .store import IntelStore

log = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
SECTORS = {"XLK": "Tecnología", "XLF": "Financiero", "XLE": "Energía", "XLV": "Salud", "XLY": "Consumo discrecional",
           "XLP": "Consumo básico", "XLI": "Industrial", "XLU": "Utilities", "XLB": "Materiales", "XLRE": "Inmobiliario",
           "XLC": "Comunicaciones"}
FOLLOW_UP = {  # qué información adicional haría falta para valorar la importancia de cada tipo de evento
    "earnings": "Comparar con el consenso de analistas (no disponible en las fuentes actuales) y leer el anexo 99.1 del 8-K y la guía.",
    "guidance": "Ver magnitud del cambio frente a la guía anterior y la reacción del sector.",
    "m_and_a": "Confirmar en SEC (8-K 1.01/2.01), precio, prima, financiación y aprobaciones regulatorias pendientes.",
    "offering_dilution": "Tamaño de la emisión frente a la capitalización y uso de los fondos (folleto 424B en SEC).",
    "legal_regulatory": "Cuantía potencial frente a caja y beneficios; fase del proceso; comunicado oficial del organismo.",
    "accounting_bankruptcy": "Leer el 8-K original; impacto en covenants y liquidez. Riesgo alto: no basarse en titulares.",
    "central_bank": "Comparar con expectativas de tipos y el diferencial 2a/10a tras el anuncio.",
    "macro_data": "Comparar el dato con la publicación anterior en FRED y con la reacción de bonos y VIX.",
    "analyst_rating": "Opinión de un analista: ver historial del analista y si coincide con datos fundamentales.",
    "capital_return": "Tamaño de la recompra/dividendo respecto al flujo de caja libre.",
    "management": "Motivo de la salida y si coincide con otros eventos (resultados, investigaciones).",
}


def load_universe(client, symbols: list[str], start: str = "2018-01-01", refresh: bool = False) -> dict[str, pd.DataFrame]:
    """Barras diarias solo de sesiones CERRADAS según el calendario oficial de Alpaca."""
    from ..paper_trader import last_completed_session
    now_ny = datetime.now(NY)
    try:
        until = last_completed_session(client.get_calendar((now_ny.date() - timedelta(days=10)).isoformat(),
                                                           now_ny.date().isoformat()), now_ny)
    except Exception:
        until = (now_ny.date() - timedelta(days=1)).isoformat()  # sin calendario: conservador, hasta ayer
    out = {}
    for s in dict.fromkeys(symbols):
        try:
            df = load_history(client, s, start, refresh=refresh, until=until)
            if len(df) > 60:
                out[s] = df
        except Exception as e:
            log.warning("Sin barras para %s: %s", s, e)
    return out


def regime_series(spy: pd.DataFrame) -> pd.Series:
    """Régimen diario causal: tendencia (precio vs SMA200) × volatilidad (20d vs mediana de 1 año)."""
    c = spy["close"]
    up = c > ind.sma(c, 200)
    vol = ind.volatility(c)
    high = vol > vol.rolling(252, min_periods=120).median()
    lab = np.where(up, "alcista", "bajista")
    lab = pd.Series(lab, index=c.index) + np.where(high, "/vol_alta", "/vol_baja")
    return lab.where(ind.sma(c, 200).notna() & vol.notna())


def macro_summary(store: IntelStore) -> dict:
    def series(sid):
        return store.query("SELECT date,value FROM macro WHERE series=? ORDER BY date", (sid,))

    out, notes = {}, []
    for sid in ("CPIAUCSL", "CPILFESL"):
        s = series(sid)
        if len(s) > 13:
            yoy = (s[-1]["value"] / s[-13]["value"] - 1) * 100
            prev = (s[-2]["value"] / s[-14]["value"] - 1) * 100
            out[sid] = {"date": s[-1]["date"], "yoy_pct": round(yoy, 2), "prev_yoy_pct": round(prev, 2)}
    for sid in ("UNRATE", "DFF", "DGS10", "DGS2", "T10Y2Y", "VIXCLS", "BAMLH0A0HYM2"):
        s = series(sid)
        if s:
            ref = s[-22]["value"] if len(s) > 22 and sid not in ("UNRATE",) else (s[-2]["value"] if len(s) > 1 else None)
            out[sid] = {"date": s[-1]["date"], "value": s[-1]["value"], "change": round(s[-1]["value"] - ref, 2) if ref is not None else None}
    s = series("PAYEMS")
    if len(s) > 1:
        out["PAYEMS"] = {"date": s[-1]["date"], "monthly_change_k": round(s[-1]["value"] - s[-2]["value"], 0)}
    if "CPIAUCSL" in out:
        d = out["CPIAUCSL"]
        notes.append(f"Inflación general {d['yoy_pct']}% interanual ({'sube' if d['yoy_pct'] > d['prev_yoy_pct'] else 'baja'} vs {d['prev_yoy_pct']}%).")
    if "T10Y2Y" in out and out["T10Y2Y"]["value"] < 0:
        notes.append("Curva 10a-2a invertida: históricamente asociada a riesgo de recesión, con retrasos muy variables.")
    if "VIXCLS" in out:
        v = out["VIXCLS"]["value"]
        notes.append(f"VIX {v}: {'tensión elevada' if v > 25 else 'calma relativa' if v < 15 else 'nivel intermedio'}.")
    if "BAMLH0A0HYM2" in out and out["BAMLH0A0HYM2"]["change"] and out["BAMLH0A0HYM2"]["change"] > 0.5:
        notes.append("El diferencial high yield se amplió >0,5 pp en un mes: más aversión al riesgo crediticio.")
    return {"series": out, "notes": notes}


def _session_index(df: pd.DataFrame, ts: str) -> int | None:
    """Índice de la primera sesión en la que el mercado pudo reaccionar a una noticia publicada en ts."""
    t = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(NY)
    d = pd.Timestamp(t.date())
    if t.hour >= 16:  # después del cierre: reacciona la sesión siguiente
        d += pd.Timedelta(days=1)
    pos = df.index.searchsorted(d)
    return int(pos) if pos < len(df) else None


def reaction(item: dict, bars: dict[str, pd.DataFrame]) -> dict | None:
    """Reacción del precio y análisis de 'ya descontado' para una noticia con símbolo."""
    sym = next((s for s in (item.get("primary_symbols") or "").split(",") if s in bars), None)
    if not sym or "SPY" not in bars:
        return None
    df, spy = bars[sym], bars["SPY"]["close"]
    i = _session_index(df, item["published_at"])
    if i is None or i < 25:
        return {"symbol": sym, "status": "pendiente: aún no hay sesión posterior"}
    c = df["close"]
    sd = c.pct_change().iloc[i - 61:i - 1].std()
    pre = c.iloc[i - 1] / c.iloc[i - 4] - 1
    day = c.iloc[i] / c.iloc[i - 1] - 1
    spy_day = spy.reindex(df.index).iloc[i] / spy.reindex(df.index).iloc[i - 1] - 1
    out = {"symbol": sym, "session": str(df.index[i].date()), "pre3d_pct": round(pre * 100, 2),
           "pre3d_z": round(pre / (sd * np.sqrt(3)), 2) if sd else None, "reaction_pct": round(day * 100, 2),
           "excess_reaction_pct": round((day - spy_day) * 100, 2), "reaction_z": round(day / sd, 2) if sd else None}
    if i + 5 < len(df):
        spy5 = spy.reindex(df.index)
        out["excess_5d_pct"] = round(((c.iloc[i + 5] / c.iloc[i - 1]) - (spy5.iloc[i + 5] / spy5.iloc[i - 1])) * 100, 2)
    s = item.get("sentiment") or 0
    if out["pre3d_z"] is not None and abs(out["pre3d_z"]) > 2 and np.sign(pre) == np.sign(s) and s:
        out["assessment"] = "posiblemente ya descontada (fuerte movimiento previo en la misma dirección)"
    elif out["reaction_z"] is not None and abs(out["reaction_z"]) > 2:
        out["assessment"] = "noticia nueva con reacción significativa"
    else:
        out["assessment"] = "sin reacción significativa del precio"
    return out


def event_base_rates(store: IntelStore, bars: dict[str, pd.DataFrame], days: int = 365) -> dict:
    """Estudio de eventos: rendimiento en exceso a 5 sesiones tras cada tipo de evento (por signo de sentimiento)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = store.query("SELECT uid,primary_symbols,published_at,event_type,sentiment,credibility,cluster_id FROM items "
                       "WHERE published_at>=? AND primary_symbols!='' AND uid=cluster_id", (since,))
    acc: dict[str, list[float]] = {}
    for r in rows:
        rx = reaction(r, bars)
        if rx and "excess_5d_pct" in rx:
            sgn = "pos" if r["sentiment"] > 0.2 else "neg" if r["sentiment"] < -0.2 else "neu"
            acc.setdefault(f"{r['event_type']}|{sgn}", []).append(rx["excess_5d_pct"])
    return {k: {"n": len(v), "mean_excess_5d_pct": round(float(np.mean(v)), 2),
                "pct_positive": round(float(np.mean([x > 0 for x in v])) * 100, 1),
                "reliable": len(v) >= 30} for k, v in sorted(acc.items())}


def market_overview(bars: dict[str, pd.DataFrame], watchlist: list[str]) -> dict:
    snaps = {}
    for s, df in bars.items():
        if len(df) > 130:
            try:
                snaps[s] = ind.technical_snapshot(df)
            except Exception as e:
                log.warning("snapshot %s: %s", s, e)
    reg = regime_series(bars["SPY"]).dropna() if "SPY" in bars else pd.Series(dtype=object)
    sectors = sorted([{"etf": e, "sector": n, **{k: snaps[e][k] for k in ("ret_1d_pct", "ret_5d_pct", "ret_20d_pct", "volume_ratio20", "trend50")}}
                      for e, n in SECTORS.items() if e in snaps], key=lambda x: x["ret_20d_pct"], reverse=True)
    unusual = []
    for s in watchlist:
        sn = snaps.get(s)
        if not sn:
            continue
        why = []
        if abs(sn["ret_1d_z"]) >= 2.5:
            why.append(f"movimiento de {sn['ret_1d_pct']}% ({sn['ret_1d_z']} desv.)")
        if sn["volume_ratio20"] >= 2:
            why.append(f"volumen {sn['volume_ratio20']}× la media")
        if sn["trend_change_last_10d"]:
            why.append("cambio de tendencia en los últimos 10 días")
        if sn["bollinger_pct_b"] > 1 or sn["bollinger_pct_b"] < 0:
            why.append("fuera de las bandas de Bollinger")
        if why:
            unusual.append({"symbol": s, "reasons": why})
    breadth = [snaps[s]["above_sma50"] for s in watchlist if s in snaps]
    return {
        "as_of": str(bars["SPY"].index[-1].date()) if "SPY" in bars else None,
        "regime": reg.iloc[-1] if len(reg) else None,
        "regime_since": str(reg[reg != reg.iloc[-1]].index[-1].date()) if len(reg) and (reg != reg.iloc[-1]).any() else None,
        "indices": {s: snaps[s] for s in ("SPY", "QQQ", "IWM", "DIA") if s in snaps},
        "breadth_above_sma50_pct": round(float(np.mean(breadth)) * 100, 1) if breadth else None,
        "sectors": sectors, "unusual": unusual,
        "watchlist": {s: snaps[s] for s in watchlist if s in snaps},
    }


def important_news(store: IntelStore, bars: dict[str, pd.DataFrame], hours: int = 36, limit: int = 25) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = store.query("SELECT * FROM items WHERE published_at>=? AND uid=cluster_id AND "
                       "(impact='high' OR (impact='medium' AND credibility IN ('fact','reported'))) "
                       "ORDER BY CASE impact WHEN 'high' THEN 0 ELSE 1 END, published_at DESC LIMIT ?", (since, limit))
    out = []
    for r in rows:
        r["data"] = json.loads(r["data"] or "{}")
        r["reaction"] = reaction(r, bars)
        r["follow_up"] = FOLLOW_UP.get(r["event_type"], "")
        out.append(r)
    return out
