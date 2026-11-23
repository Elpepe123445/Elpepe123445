"""Experimentos controlados de cambios de lógica (no de parámetros). Solo investigan: no operan ni promueven."""
from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from .. import strategies
from ..backtest import run_backtest
from .market import regime_series
from .store import JOURNAL, IntelStore, now, uid


def _sharpe(rets: pd.Series) -> float:
    rets = rets.dropna()
    return round(float(rets.mean() / rets.std() * math.sqrt(252)), 2) if len(rets) > 20 and rets.std() > 0 else 0.0


def _metrics(r) -> dict:
    eq = r.equity
    return {"sharpe": _sharpe(eq.pct_change()), "return_pct": round((eq.iloc[-1] / eq.iloc[0] - 1) * 100, 2),
            "max_dd_pct": round(float((eq / eq.cummax() - 1).min()) * 100, 2), "trades": int(r.metrics["num_trades"]),
            "exposure_pct": r.metrics.get("exposure_pct")}


def regime_filter_experiment(bars: dict, symbols: list[str], versions, cost: dict, train_fraction: float = 0.6,
                             test=126, train=504) -> dict:
    """Compara cada estrategia (parámetros en producción) con y sin filtro de régimen.

    Evalúa: (a) periodo de test fuera de muestra (último 40 %), (b) ventanas walk-forward de 6 meses
    (el filtro no tiene parámetros que ajustar, así que cada ventana es fuera de muestra), (c) por régimen."""
    spy = bars["SPY"]["close"]
    reg = regime_series(bars["SPY"])
    cost = {"commission": cost.get("commission", 0.0), "slippage_bps": cost.get("slippage_bps", 5.0)}
    out = {"generated_at": now(), "description": "Sin entradas nuevas con SPY < SMA200; salidas intactas", "strategies": {}}
    for name, strat in strategies.STRATEGIES.items():
        params = versions.production(name)["params"]
        per_sym = {}
        for sym in symbols:
            df = bars.get(sym)
            if df is None or len(df) < 900:
                continue
            base = strat.signals(df, params)
            filt = strategies.regime_filtered(base, spy)
            cut = df.index[int(len(df) * train_fraction)]
            te = df[df.index >= cut]
            a, b = run_backtest(te, base.loc[te.index], **cost), run_backtest(te, filt.loc[te.index], **cost)
            # ventanas walk-forward (desde que hay SMA200 de SPY)
            wins = []
            start = df.index.searchsorted(spy.index[200]) if len(spy) > 200 else 0
            for s in range(max(start, train), len(df) - test + 1, test):
                w = df.iloc[s:s + test]
                ra = run_backtest(w, base.loc[w.index], **cost).equity.pct_change().dropna()
                rb = run_backtest(w, filt.loc[w.index], **cost).equity.pct_change().dropna()
                wins.append((ra, rb))
            wf_a = pd.concat([x for x, _ in wins]) if wins else pd.Series(dtype=float)
            wf_b = pd.concat([y for _, y in wins]) if wins else pd.Series(dtype=float)
            # por régimen (serie completa)
            fa = run_backtest(df, base, **cost).equity.pct_change()
            fb = run_backtest(df, filt, **cost).equity.pct_change()
            rg = reg.reindex(df.index)
            by_reg = {}
            for lab in sorted(rg.dropna().unique()):
                m = rg == lab
                if m.sum() >= 40:
                    by_reg[lab] = {"days": int(m.sum()), "sharpe_base": _sharpe(fa[m]), "sharpe_filter": _sharpe(fb[m]),
                                   "ann_ret_base_pct": round(float(fa[m].mean() * 252 * 100), 1),
                                   "ann_ret_filter_pct": round(float(fb[m].mean() * 252 * 100), 1)}
            per_sym[sym] = {"test_base": _metrics(a), "test_filter": _metrics(b),
                            "wf_windows": len(wins), "wf_sharpe_base": _sharpe(wf_a), "wf_sharpe_filter": _sharpe(wf_b),
                            "by_regime": by_reg}
        if not per_sym:
            continue
        gains_t = [v["test_filter"]["sharpe"] - v["test_base"]["sharpe"] for v in per_sym.values()]
        gains_w = [v["wf_sharpe_filter"] - v["wf_sharpe_base"] for v in per_sym.values()]
        dd = [v["test_filter"]["max_dd_pct"] - v["test_base"]["max_dd_pct"] for v in per_sym.values()]
        out["strategies"][name] = {
            "params": params, "symbols": per_sym,
            "mean_test_sharpe_gain": round(float(np.mean(gains_t)), 2),
            "mean_wf_sharpe_gain": round(float(np.mean(gains_w)), 2),
            "wf_win_frac": round(float(np.mean([g > 0 for g in gains_w])), 2),
            "mean_test_dd_change_pct": round(float(np.mean(dd)), 2),
            "test_trades_base": int(sum(v["test_base"]["trades"] for v in per_sym.values())),
            "test_trades_filter": int(sum(v["test_filter"]["trades"] for v in per_sym.values())),
        }
    return out


def save(store: IntelStore, rep: dict, name: str) -> None:
    store.upsert("reports", {"rid": uid("exp", name, rep["generated_at"]), "date": rep["generated_at"][:10],
                             "kind": f"experiment:{name}", "created_at": now(), "markdown": "", "data": rep})
    if JOURNAL:
        d = JOURNAL / "experiments"
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}-{rep['generated_at'][:10]}.json").write_text(json.dumps(rep, indent=1, default=str))
