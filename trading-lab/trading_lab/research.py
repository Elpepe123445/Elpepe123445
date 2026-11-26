"""Ejecuta la investigación completa: backtests, validación fuera de muestra y comparación."""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone

from . import evaluation as ev
from . import indicators as ind
from . import strategies
from .backtest import buy_and_hold, optimize_and_validate, split_index
from .config import ROOT, Config
from .data import load_history

log = logging.getLogger(__name__)
REPORT_PATH = ROOT / "reports" / "backtest_latest.json"


def _curve(eq, step="W-FRI"):
    w = eq.resample(step).last().dropna()
    return {"dates": [str(d.date()) for d in w.index], "values": [round(float(v), 2) for v in w.values]}


def run_research(cfg: Config, client, refresh: bool = False) -> dict:
    results, market = [], {}
    for sym in cfg.symbols:
        df = load_history(client, sym, cfg.data_start, refresh=refresh)
        if len(df) < 500:
            log.warning("%s: solo %d barras, se omite", sym, len(df))
            continue
        market[sym] = ind.price_volume_summary(df)
        cut = split_index(df.index, cfg.train_fraction)
        test_df = df[df.index >= cut]
        bh = buy_and_hold(test_df, **cfg.cost_model)
        for name, strat in strategies.STRATEGIES.items():
            r = optimize_and_validate(df, strat, cfg.strategy_grids.get(name, {}), cfg.train_fraction, cfg.cost_model)
            test_res = r.pop("_test_result")
            sig = strat.signals(df, r["best_params"])
            r.update(
                symbol=sym,
                split_date=str(cut.date()),
                periodic=ev.periodic_returns(test_res.equity),
                losing_trades=ev.losing_trades_analysis(test_res.trades),
                signal_quality_test=strategies.evaluate_signal_quality(test_df, sig.loc[test_df.index]),
                equity_curve=_curve(test_res.equity),
                benchmark_curve=_curve(bh.equity),
                drawdown_curve=_curve(test_res.equity / test_res.equity.cummax() - 1),
                recent_trades=[{k: (str(v.date()) if hasattr(v, "date") else (round(v, 2) if isinstance(v, float) else v))
                                for k, v in t.items()} for t in test_res.trades.tail(15).to_dict("records")],
            )
            results.append(r)
            log.info("%-20s %-5s train Sharpe %5.2f | test Sharpe %5.2f | B&H %5.2f | trades %d",
                     name, sym, r["train"]["sharpe"], r["test"]["sharpe"], r["benchmark_test"]["sharpe"], r["test"]["num_trades"])
    ranking = ev.rank_strategies(results)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config": {"symbols": cfg.symbols, "data_start": cfg.data_start, "train_fraction": cfg.train_fraction,
                   "cost_model": cfg.cost_model, "data_feed": "IEX (precios ajustados)",
                   "execution": "señal al cierre t, ejecución en la apertura t+1"},
        "sharpe_assumptions": "Retornos diarios, rf=0, anualizado con sqrt(252), asume retornos ~i.i.d.",
        "market": market,
        "ranking": ranking,
        "by_strategy": ev.aggregate_by(ranking, "strategy"),
        "by_asset": ev.aggregate_by(ranking, "symbol"),
        "global_warnings": ev.global_warnings(ranking),
        "results": results,
    }
    REPORT_PATH.parent.mkdir(exist_ok=True)
    REPORT_PATH.write_text(json.dumps(_clean(report), indent=1, default=str))
    return report


def _clean(o):
    """Convierte NaN/inf en null para producir JSON válido."""
    if isinstance(o, float):
        return None if math.isnan(o) or math.isinf(o) else o
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    return o
