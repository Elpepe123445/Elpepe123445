"""Evaluación y comparación de resultados de estrategias."""
from __future__ import annotations

import pandas as pd


def periodic_returns(equity: pd.Series) -> dict:
    daily = equity.pct_change().dropna()
    weekly = equity.resample("W-FRI").last().pct_change().dropna()
    return {
        "daily": {"mean_pct": round(float(daily.mean()) * 100, 3), "pct_positive": round(float((daily > 0).mean()) * 100, 1),
                  "best_pct": round(float(daily.max()) * 100, 2), "worst_pct": round(float(daily.min()) * 100, 2)},
        "weekly": {"mean_pct": round(float(weekly.mean()) * 100, 3), "pct_positive": round(float((weekly > 0).mean()) * 100, 1),
                   "best_pct": round(float(weekly.max()) * 100, 2), "worst_pct": round(float(weekly.min()) * 100, 2),
                   "last_8": {str(k.date()): round(float(v) * 100, 2) for k, v in weekly.tail(8).items()}},
    }


def losing_trades_analysis(trades: pd.DataFrame) -> dict:
    if trades is None or trades.empty:
        return {"count": 0}
    losers = trades[trades.pnl <= 0]
    if losers.empty:
        return {"count": 0, "note": "Sin operaciones negativas en el período (posible muestra pequeña)."}
    winners = trades[trades.pnl > 0]
    # Racha máxima de pérdidas consecutivas
    streak = best = 0
    for p in trades.pnl:
        streak = streak + 1 if p <= 0 else 0
        best = max(best, streak)
    return {
        "count": int(len(losers)),
        "avg_loss_pct": round(float(losers.return_pct.mean()), 2),
        "worst_loss_pct": round(float(losers.return_pct.min()), 2),
        "avg_holding_days_losers": round(float(losers.holding_days.mean()), 1),
        "avg_holding_days_winners": round(float(winners.holding_days.mean()), 1) if len(winners) else None,
        "max_consecutive_losses": int(best),
        "loss_share_of_gross_pnl_pct": round(float(-losers.pnl.sum() / trades.pnl.abs().sum()) * 100, 1),
    }


def rank_strategies(results: list[dict]) -> list[dict]:
    """Ranking por Sharpe FUERA DE MUESTRA (test), nunca por el resultado de train.

    Un buen puesto aquí no implica rentabilidad futura: es una comparación sobre
    un período concreto, con costes estimados y sin impacto de mercado real.
    """
    rows = []
    for r in results:
        t, b = r["test"], r["benchmark_test"]
        rows.append({
            "strategy": r["strategy"], "symbol": r["symbol"],
            "test_sharpe": t["sharpe"], "test_return_pct": t["total_return_pct"],
            "test_max_dd_pct": t["max_drawdown_pct"], "test_trades": t["num_trades"],
            "benchmark_return_pct": b["total_return_pct"], "benchmark_sharpe": b["sharpe"],
            "beats_benchmark_risk_adj": t["sharpe"] > b["sharpe"],
            "train_sharpe": r["train"]["sharpe"], "n_warnings": len(r["warnings"]),
        })
    return sorted(rows, key=lambda x: x["test_sharpe"], reverse=True)


def aggregate_by(rows: list[dict], key: str) -> list[dict]:
    df = pd.DataFrame(rows)
    if df.empty:
        return []
    g = df.groupby(key).agg(avg_test_sharpe=("test_sharpe", "mean"), avg_test_return_pct=("test_return_pct", "mean"),
                            worst_dd_pct=("test_max_dd_pct", "min"), total_trades=("test_trades", "sum"),
                            beats_benchmark=("beats_benchmark_risk_adj", "sum"), n=("test_sharpe", "size"))
    return g.round(2).reset_index().sort_values("avg_test_sharpe", ascending=False).to_dict("records")


def global_warnings(rows: list[dict]) -> list[str]:
    w = ["Los resultados son de una simulación histórica con datos IEX; no garantizan rentabilidad futura."]
    if rows and sum(r["beats_benchmark_risk_adj"] for r in rows) / len(rows) < 0.5:
        w.append("La mayoría de las combinaciones estrategia/activo NO superan a comprar y mantener "
                 "ajustado por riesgo en el período de test.")
    if rows and sum(r["test_trades"] for r in rows) / len(rows) < 30:
        w.append("Media de operaciones por estrategia en test < 30: pocas observaciones para conclusiones.")
    return w
