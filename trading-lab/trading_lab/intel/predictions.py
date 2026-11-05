"""Predicciones explícitas y su evaluación posterior frente a lo que realmente ocurrió.

Modelos registrados:
  * strategy:<nombre>  – cada estrategia en producción (y sus candidatas en 'shadow'): predice "up" si su señal es 1.
  * composite          – combinación técnica + fundamental + noticias con probabilidad. Las noticias pesan como
                         máximo un 20 % y nunca generan órdenes.
  * naive:always_up    – referencia ingenua: siempre "sube". Un modelo que no la supera no aporta información.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from .. import strategies
from . import fundamentals as fmod
from .market import regime_series
from .store import IntelStore, now, uid

MIN_EVAL_FOR_CONCLUSIONS = 30


def tech_score(sn: dict) -> tuple[float, list[str]]:
    pts, why = [], []
    pts.append(sn["trend50"]); why.append(f"tendencia50={sn['trend50']}")
    if sn.get("above_sma200") is not None:
        pts.append(1 if sn["above_sma200"] else -1); why.append("sobre SMA200" if sn["above_sma200"] else "bajo SMA200")
    pts.append(0.5 if sn["macd_above_signal"] else -0.5); why.append(f"MACD {'>' if sn['macd_above_signal'] else '<'} señal")
    if sn.get("momentum_126d_pct") is not None:
        pts.append(0.5 * np.sign(sn["momentum_126d_pct"])); why.append(f"momentum 6m {sn['momentum_126d_pct']}%")
    if sn["rsi14"] > 75:
        pts.append(-0.5); why.append(f"RSI sobrecompra {sn['rsi14']}")
    elif sn["rsi14"] < 25:
        pts.append(0.5); why.append(f"RSI sobreventa {sn['rsi14']}")
    return float(np.clip(np.mean(pts), -1, 1)), why


def news_score(store: IntelStore, symbol: str, as_of: str, days: int = 3) -> tuple[float | None, list[str]]:
    since = (datetime.fromisoformat(as_of) - timedelta(days=days)).isoformat()
    rows = store.query("SELECT sentiment,impact,credibility,event_type FROM items WHERE uid=cluster_id AND published_at>=? "
                       "AND published_at<=? AND (','||primary_symbols||',') LIKE ?", (since, as_of + "T23:59:59", f"%,{symbol},%"))
    w_imp = {"high": 1.0, "medium": 0.5, "low": 0.25}
    w_cred = {"fact": 1.0, "reported": 0.8, "opinion": 0.3, "rumor": 0.0}  # los rumores no puntúan
    num = den = 0.0
    for r in rows:
        w = w_imp.get(r["impact"], 0.25) * w_cred.get(r["credibility"], 0.5)
        num += w * r["sentiment"]; den += w
    if den == 0:
        return None, [f"sin noticias puntuables en {days} días"]
    return float(np.clip(num / den, -1, 1)), [f"{len(rows)} noticias, sentimiento ponderado {num / den:+.2f}"]


def _record(store, model, version, symbol, base_date, base_price, horizon, direction, prob, features, missing, regime):
    pid = uid(model, version, symbol, base_date, horizon)
    if store.exists("predictions", pid):
        return False
    store.upsert("predictions", {"pid": pid, "created_at": now(), "model": model, "model_version": version,
                                 "symbol": symbol, "base_date": base_date, "base_price": base_price, "horizon": horizon,
                                 "direction": direction, "prob_up": prob, "features": features,
                                 "missing_info": missing, "regime": regime}, commit=False)
    return True


def make_predictions(store: IntelStore, bars: dict[str, pd.DataFrame], symbols: list[str], versions, horizon: int = 5,
                     source_status: dict | None = None) -> int:
    reg = regime_series(bars["SPY"]) if "SPY" in bars else None
    down_sources = [s for s, st in (source_status or {}).items() if st not in ("ok",)]
    n = 0
    for sym in symbols:
        df = bars.get(sym)
        if df is None or len(df) < 260:
            continue
        base_date, price = str(df.index[-1].date()), float(df["close"].iloc[-1])
        regime = reg.get(df.index[-1]) if reg is not None else None
        regime = None if regime is None or (isinstance(regime, float) and np.isnan(regime)) else regime
        # 1) Estrategias (producción y candidatas en shadow)
        for name, strat in strategies.STRATEGIES.items():
            for v in versions.models_for(name):
                if float(strat.signals(df, v["params"]).iloc[-1]) >= 0.5:
                    n += _record(store, f"strategy:{name}", v["label"], sym, base_date, price, horizon, "up", None,
                                 {"params": v["params"]}, [], regime)
        # 2) Compuesto
        from .. import indicators as ind
        sn = ind.technical_snapshot(df)
        t, t_why = tech_score(sn)
        frow = store.get("fundamentals", sym)
        fdata = json.loads(frow["data"]) if frow else None
        f, f_why = fmod.score(fdata) if fdata else (None, ["sin fundamentales (ETF o sin datos SEC)"])
        ns, n_why = news_score(store, sym, base_date)
        parts = [(0.5, t)] + ([(0.3, f)] if f is not None else []) + ([(0.2, ns)] if ns is not None else [])
        total = sum(w * x for w, x in parts) / sum(w for w, _ in parts)
        prob = round(0.5 + 0.12 * total, 3)
        direction = "up" if prob >= 0.53 else "down" if prob <= 0.47 else "neutral"
        missing = ([] if f is not None else ["fundamentales"]) + ([] if ns is not None else ["noticias"]) + \
                  [f"fuente no disponible: {s}" for s in down_sources] + ["consenso de analistas (sin fuente)"]
        n += _record(store, "composite", "v1", sym, base_date, price, horizon, direction, prob,
                     {"tech": round(t, 2), "fund": f, "news": ns, "total": round(total, 3),
                      "why": t_why + f_why + n_why, "snapshot": sn}, missing, regime)
        # 3) Referencia ingenua: probabilidad histórica de subida a 'horizon' sesiones (2 años previos)
        r = (df["close"].shift(-horizon) / df["close"] - 1).iloc[-504 - horizon:-horizon]
        base = round(float((r > 0).mean()), 3) if len(r) > 100 else 0.5
        n += _record(store, "naive:always_up", "v1", sym, base_date, price, horizon, "up", base,
                     {"base_rate": base}, [], regime)
    store.conn.commit()
    return n


def evaluate(store: IntelStore, bars: dict[str, pd.DataFrame]) -> int:
    pend = store.query("SELECT * FROM predictions WHERE evaluated_at IS NULL")
    spy = bars.get("SPY")
    n = 0
    for p in pend:
        df = bars.get(p["symbol"])
        if df is None:
            continue
        idx = df.index.searchsorted(pd.Timestamp(p["base_date"]))
        if idx >= len(df) or str(df.index[idx].date()) != p["base_date"] or idx + p["horizon"] >= len(df):
            continue
        end = df.index[idx + p["horizon"]]
        ret = float(df["close"].iloc[idx + p["horizon"]] / p["base_price"] - 1)
        exc = None
        if spy is not None and pd.Timestamp(p["base_date"]) in spy.index and end in spy.index:
            exc = ret - float(spy["close"].loc[end] / spy["close"].loc[pd.Timestamp(p["base_date"])] - 1)
        if p["direction"] == "up":
            correct = ret > 0
        elif p["direction"] == "down":
            correct = ret < 0
        else:
            correct = exc is not None and abs(exc) < 0.01
        notes = []
        confident = p["prob_up"] is not None and abs(p["prob_up"] - 0.5) >= 0.05
        if not correct and (confident or p["model"].startswith("strategy:")):
            # ¿Qué información apareció después (no disponible al predecir) o se ignoró?
            later = store.query("SELECT event_type,impact,title FROM items WHERE uid=cluster_id AND published_at>? AND "
                                "published_at<=? AND (','||primary_symbols||',') LIKE ? AND impact='high'",
                                (p["base_date"] + "T23:59:59", str(end.date()) + "T23:59:59", f"%,{p['symbol']},%"))
            if later:
                notes.append(f"{len(later)} evento(s) de alto impacto posteriores: " + "; ".join(x["title"][:80] for x in later[:3]))
            reg = regime_series(bars["SPY"]) if "SPY" in bars else None
            if reg is not None and end in reg.index and reg.loc[end] != p["regime"]:
                notes.append(f"cambio de régimen: {p['regime']} → {reg.loc[end]}")
            if spy is not None and exc is not None and ret < 0 and exc > 0:
                notes.append("el activo bajó, pero menos que el mercado (fallo de dirección del mercado, no del activo)")
            miss = json.loads(p["missing_info"] or "[]")
            if miss:
                notes.append("faltaba: " + ", ".join(miss))
        store.upsert("predictions", {"pid": p["pid"], "outcome_date": str(end.date()),
                                     "outcome_price": float(df["close"].iloc[idx + p["horizon"]]),
                                     "outcome_return": round(ret, 5), "excess_return": round(exc, 5) if exc is not None else None,
                                     "correct": int(bool(correct)), "evaluated_at": now(), "notes": notes}, commit=False)
        n += 1
    store.conn.commit()
    return n


def stats(store: IntelStore) -> dict:
    rows = store.query("SELECT model,model_version,regime,direction,prob_up,outcome_return,excess_return,correct "
                       "FROM predictions WHERE evaluated_at IS NOT NULL")
    if not rows:
        return {"by_model": [], "by_regime": [], "note": "Aún no hay predicciones evaluadas (horizonte de 5 sesiones)."}
    df = pd.DataFrame(rows)
    df["label"] = df["model"] + "@" + df["model_version"]
    df["y"] = (df["outcome_return"] > 0).astype(float)
    df["brier"] = (df["prob_up"] - df["y"]) ** 2

    def agg(g):
        return pd.Series({"n": len(g), "hit_rate_pct": round(g["correct"].mean() * 100, 1),
                          "mean_return_pct": round(g["outcome_return"].mean() * 100, 3),
                          "mean_excess_pct": round(g["excess_return"].mean() * 100, 3) if g["excess_return"].notna().any() else None,
                          "brier": round(g["brier"].mean(), 4) if g["prob_up"].notna().any() else None,
                          "enough_data": len(g) >= MIN_EVAL_FOR_CONCLUSIONS})
    by_model = df.groupby("label").apply(agg, include_groups=False).reset_index().sort_values("mean_excess_pct", ascending=False)
    by_regime = df.groupby(["label", "regime"]).apply(agg, include_groups=False).reset_index()
    return {"by_model": by_model.to_dict("records"), "by_regime": by_regime.to_dict("records"),
            "evaluated": int(len(df)), "pending": store.query("SELECT COUNT(*) n FROM predictions WHERE evaluated_at IS NULL")[0]["n"]}
