"""Motor de backtesting diario, solo largo, sin apalancamiento.

Reglas de ejecución (anti look-ahead):
  * La señal se calcula con datos hasta el CIERRE de la sesión t.
  * La orden se ejecuta a la APERTURA de la sesión t+1, con slippage adverso.
  * Comisión fija por operación (Alpaca no cobra comisión en acciones; por defecto
    se modela 0 $ más slippage, pero es configurable para ser conservador).

Supuestos del Sharpe ratio:
  * Retornos diarios del equity, tipo libre de riesgo configurable (0 por defecto),
    anualizado con sqrt(252). Asume retornos aproximadamente i.i.d.; con colas gruesas
    o autocorrelación el Sharpe sobreestima o subestima el riesgo real.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .strategies import Strategy

TRADING_DAYS = 252
MIN_TRADES_FOR_CONFIDENCE = 30


@dataclass
class BacktestResult:
    equity: pd.Series
    trades: pd.DataFrame
    metrics: dict
    params: dict = field(default_factory=dict)


def run_backtest(df: pd.DataFrame, target: pd.Series, capital: float = 10_000.0,
                 commission: float = 0.0, slippage_bps: float = 5.0) -> BacktestResult:
    df = df.loc[target.index.min():target.index.max()]
    target = target.reindex(df.index).fillna(0.0)
    o, c = df["open"].to_numpy(), df["close"].to_numpy()
    tgt = target.to_numpy()
    slip = slippage_bps / 10_000
    cash, shares = capital, 0.0
    equity = np.empty(len(df))
    trades, entry, costs = [], None, 0.0
    for i in range(len(df)):
        desired = tgt[i - 1] if i > 0 else 0.0  # decisión del cierre anterior
        if desired >= 0.5 and shares == 0 and cash > commission:
            px = o[i] * (1 + slip)
            shares = (cash - commission) / px
            costs += commission + shares * o[i] * slip
            entry = {"entry_date": df.index[i], "entry_price": px, "cost_basis": cash}
            cash = 0.0
        elif desired < 0.5 and shares > 0:
            px = o[i] * (1 - slip)
            proceeds = shares * px - commission
            costs += commission + shares * o[i] * slip
            trades.append({**entry, "exit_date": df.index[i], "exit_price": px,
                           "pnl": proceeds - entry["cost_basis"],
                           "return_pct": (proceeds / entry["cost_basis"] - 1) * 100})
            cash, shares, entry = proceeds, 0.0, None
        equity[i] = cash + shares * c[i]
    if entry is not None:  # posición abierta al final: se valora a mercado, se marca como abierta
        val = shares * c[-1] * (1 - slip) - commission
        trades.append({**entry, "exit_date": df.index[-1], "exit_price": c[-1], "pnl": val - entry["cost_basis"],
                       "return_pct": (val / entry["cost_basis"] - 1) * 100, "open": True})
    eq = pd.Series(equity, index=df.index, name="equity")
    tr = pd.DataFrame(trades)
    if not tr.empty:
        tr["holding_days"] = (pd.to_datetime(tr["exit_date"]) - pd.to_datetime(tr["entry_date"])).dt.days
    exposure = float((target.shift(1).fillna(0) > 0.5).mean())
    return BacktestResult(eq, tr, compute_metrics(eq, tr, costs, exposure))


def compute_metrics(eq: pd.Series, trades: pd.DataFrame, costs: float = 0.0,
                    exposure: float | None = None, rf_annual: float = 0.0) -> dict:
    rets = eq.pct_change().dropna()
    years = max(len(eq) / TRADING_DAYS, 1e-9)
    total = eq.iloc[-1] / eq.iloc[0] - 1
    dd = eq / eq.cummax() - 1
    excess = rets - rf_annual / TRADING_DAYS
    sharpe = float(excess.mean() / excess.std() * math.sqrt(TRADING_DAYS)) if excess.std() > 0 else 0.0
    m = {
        "start": str(eq.index[0].date()), "end": str(eq.index[-1].date()), "days": int(len(eq)),
        "total_return_pct": round(total * 100, 2),
        "cagr_pct": round(((1 + total) ** (1 / years) - 1) * 100, 2) if total > -1 else -100.0,
        "max_drawdown_pct": round(float(dd.min()) * 100, 2),
        "sharpe": round(sharpe, 2),
        "volatility_ann_pct": round(float(rets.std() * math.sqrt(TRADING_DAYS)) * 100, 2),
        "costs": round(costs, 2),
    }
    if exposure is not None:
        m["exposure_pct"] = round(exposure * 100, 1)
    n = len(trades)
    m["num_trades"] = n
    if n:
        wins, losses = trades.loc[trades.pnl > 0, "pnl"], trades.loc[trades.pnl <= 0, "pnl"]
        m["win_rate_pct"] = round(len(wins) / n * 100, 1)
        m["profit_factor"] = round(float(wins.sum() / -losses.sum()), 2) if losses.sum() < 0 else None
        m["avg_trade_pct"] = round(float(trades.return_pct.mean()), 2)
    else:
        m.update(win_rate_pct=None, profit_factor=None, avg_trade_pct=None)
    return m


def buy_and_hold(df: pd.DataFrame, capital=10_000.0, commission=0.0, slippage_bps=5.0) -> BacktestResult:
    """Referencia pasiva: compra en la primera apertura y mantiene."""
    tgt = pd.Series(1.0, index=df.index)
    return run_backtest(df, tgt, capital, commission, slippage_bps)


def split_index(index: pd.DatetimeIndex, train_fraction: float) -> pd.Timestamp:
    return index[int(len(index) * train_fraction)]


def param_grid(grid: dict) -> list[dict]:
    if not grid:
        return [{}]
    keys = list(grid)
    return [dict(zip(keys, vals)) for vals in itertools.product(*(grid[k] for k in keys))]


def _valid(params: dict) -> bool:
    for a, b in (("fast", "slow"), ("exit_window", "entry_window"), ("oversold", "exit_level")):
        if a in params and b in params and params[a] >= params[b]:
            return False
    return True


def optimize_and_validate(df: pd.DataFrame, strategy: Strategy, grid: dict, train_fraction: float,
                          cost: dict, capital: float = 10_000.0, min_train_trades: int = 5) -> dict:
    """Optimiza en TRAIN, evalúa una sola vez en TEST (out-of-sample) y diagnostica sobreajuste."""
    cut = split_index(df.index, train_fraction)
    train_df, test_df = df[df.index < cut], df[df.index >= cut]
    combos = [p for p in param_grid(grid) if _valid({**strategy.defaults, **p})] or [{}]
    scored = []
    for p in combos:
        sig = strategy.signals(df, p)  # señales causales sobre la serie completa
        r = run_backtest(train_df, sig.loc[train_df.index], capital, **_c(cost))
        scored.append((p, r.metrics))
    eligible = [s for s in scored if s[1]["num_trades"] >= min_train_trades] or scored
    best_p, best_train = max(eligible, key=lambda s: s[1]["sharpe"])
    sig = strategy.signals(df, best_p)
    test = run_backtest(test_df, sig.loc[test_df.index], capital, **_c(cost))
    default_test = run_backtest(test_df, strategy.signals(df).loc[test_df.index], capital, **_c(cost))
    bh_train = buy_and_hold(train_df, capital, **_c(cost)).metrics
    bh_test = buy_and_hold(test_df, capital, **_c(cost)).metrics
    train_sharpes = [s[1]["sharpe"] for s in scored]
    return {
        "strategy": strategy.name,
        "hypothesis": strategy.hypothesis,
        "best_params": {**strategy.defaults, **best_p},
        "combos_tested": len(combos),
        "train": best_train, "test": test.metrics,
        "test_default_params": default_test.metrics,
        "benchmark_train": bh_train, "benchmark_test": bh_test,
        "train_sharpe_dispersion": {
            "median": round(float(np.median(train_sharpes)), 2),
            "pct_combos_positive": round(float(np.mean([s > 0 for s in train_sharpes])) * 100, 1),
        },
        "warnings": overfitting_warnings(best_train, test.metrics, len(combos), train_sharpes),
        "_test_result": test,
    }


def _c(cost: dict) -> dict:
    return {"commission": cost.get("commission", 0.0), "slippage_bps": cost.get("slippage_bps", 5.0)}


def overfitting_warnings(train: dict, test: dict, n_combos: int, train_sharpes: list[float]) -> list[str]:
    w = []
    if test["num_trades"] < MIN_TRADES_FOR_CONFIDENCE:
        w.append(f"Solo {test['num_trades']} operaciones en test (<{MIN_TRADES_FOR_CONFIDENCE}): "
                 "resultado estadísticamente poco fiable.")
    if test["days"] < TRADING_DAYS:
        w.append("El período de test es inferior a un año.")
    if train["sharpe"] > 0.5 and test["sharpe"] < 0:
        w.append("SOBREAJUSTE PROBABLE: Sharpe positivo en train y negativo en test.")
    elif train["sharpe"] > 0 and test["sharpe"] < 0.5 * train["sharpe"]:
        w.append(f"Degradación fuerte fuera de muestra (Sharpe {train['sharpe']} → {test['sharpe']}).")
    if n_combos > 20:
        w.append(f"Se probaron {n_combos} combinaciones: el mejor resultado de train está inflado "
                 "por selección (multiple testing).")
    if train_sharpes and np.mean([s > 0 for s in train_sharpes]) < 0.5:
        w.append("Menos de la mitad de los parámetros probados son rentables en train: "
                 "el resultado depende mucho de la elección de parámetros.")
    return w
