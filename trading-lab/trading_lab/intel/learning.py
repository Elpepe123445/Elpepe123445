"""Aprendizaje estadístico controlado (memoria externa + optimización + evaluación). No modifica ningún modelo de IA.

Flujo de un cambio de parámetros:
  1. Walk-forward en varios activos: el procedimiento adaptativo debe batir a los parámetros en producción
     FUERA DE MUESTRA, con suficientes operaciones y en la mayoría de activos.
  2. Si lo cumple, la versión candidata entra en 'shadow': genera predicciones registradas en paralelo, sin operar.
  3. Tras >= SHADOW_MIN predicciones evaluadas, si no es peor que la versión en producción → 'ready'.
  4. Promoción a producción: manual (`python -m trading_lab promote <vid>`) salvo que intel.auto_promote=true.
  Todas las versiones se conservan y se puede revertir (`python -m trading_lab revert <estrategia>`).
Este módulo SOLO puede cambiar parámetros de estrategias dentro de PARAM_BOUNDS. No tiene acceso a los límites de riesgo.
"""
from __future__ import annotations

import json
import math
from collections import Counter

import numpy as np
import pandas as pd

from .. import strategies
from ..backtest import _valid, param_grid, run_backtest
from .market import regime_series
from .store import IntelStore, now, uid

PARAM_BOUNDS = {
    "ma_crossover": {"fast": (5, 100), "slow": (20, 300)},
    "rsi_mean_reversion": {"period": (2, 30), "oversold": (5, 45), "exit_level": (40, 80), "trend_filter": (0, 300)},
    "macd_trend": {"fast": (3, 30), "slow": (10, 60), "signal": (3, 20), "require_positive": (0, 1)},
    "momentum": {"lookback": (20, 300), "threshold": (-0.1, 0.3)},
    "breakout": {"entry_window": (10, 250), "exit_window": (5, 120), "volume_confirm": (0, 5)},
}
CRITERIA = {"min_sharpe_gain": 0.15, "min_symbol_win_frac": 0.6, "min_oos_trades": 30, "min_param_stability": 0.4}
SHADOW_MIN, SHADOW_MAX = 20, 60


class ProtectedParameterError(ValueError):
    pass


def validate_params(strategy: str, params: dict) -> dict:
    bounds = PARAM_BOUNDS[strategy]
    for k, v in params.items():
        if k not in bounds:
            raise ProtectedParameterError(f"{strategy}: parámetro no permitido '{k}'")
        lo, hi = bounds[k]
        if not (lo <= v <= hi):
            raise ProtectedParameterError(f"{strategy}.{k}={v} fuera de rango [{lo}, {hi}]")
    if not _valid({**strategies.get(strategy).defaults, **params}):
        raise ProtectedParameterError(f"{strategy}: combinación incoherente {params}")
    return params


class Versions:
    def __init__(self, store: IntelStore, seed: dict[str, dict] | None = None):
        self.store = store
        for name, strat in strategies.STRATEGIES.items():
            if not self._by_status(name, "production"):
                p = {**strat.defaults, **(seed or {}).get(name, {})}
                self._insert(name, 1, p, "production", "versión inicial (config.json)")

    def _rows(self, strategy):
        return self.store.query("SELECT * FROM strategy_versions WHERE strategy=? ORDER BY version", (strategy,))

    def _by_status(self, strategy, status):
        return [r for r in self._rows(strategy) if r["status"] == status]

    def _insert(self, strategy, version, params, status, reason, evidence=None):
        validate_params(strategy, params)
        vid = uid("ver", strategy, version)
        self.store.upsert("strategy_versions", {"vid": vid, "strategy": strategy, "version": version, "params": params,
                                                "status": status, "created_at": now(), "reason": reason,
                                                "evidence": evidence or {}})
        return vid

    def production(self, strategy) -> dict:
        r = self._by_status(strategy, "production")[-1]
        return {"vid": r["vid"], "version": r["version"], "label": f"v{r['version']}", "params": json.loads(r["params"])}

    def active_params(self, strategy) -> dict:
        return self.production(strategy)["params"]

    def models_for(self, strategy) -> list[dict]:
        out = [self.production(strategy)]
        for r in self._by_status(strategy, "shadow") + self._by_status(strategy, "ready"):
            out.append({"vid": r["vid"], "version": r["version"], "label": f"v{r['version']}-shadow", "params": json.loads(r["params"])})
        return out

    def propose(self, strategy, params, evidence) -> str | None:
        prod = self.production(strategy)
        if params == prod["params"]:
            return None
        for r in self._by_status(strategy, "shadow") + self._by_status(strategy, "ready"):
            if json.loads(r["params"]) == params:
                return None  # ya está en prueba
            self._set(r["vid"], "rejected", "sustituida por una candidata más reciente")
        nxt = max(r["version"] for r in self._rows(strategy)) + 1
        return self._insert(strategy, nxt, params, "shadow", "candidata walk-forward", evidence)

    def _set(self, vid, status, reason):
        self.store.upsert("strategy_versions", {"vid": vid, "status": status, "decided_at": now(), "reason": reason})

    def promote(self, vid, reason="promoción tras walk-forward + shadow"):
        r = self.store.get("strategy_versions", vid)
        if not r or r["status"] not in ("ready", "shadow"):
            raise ValueError("Solo se puede promover una versión en 'ready' (o 'shadow' con aprobación manual)")
        cur = self.production(r["strategy"])
        self._set(cur["vid"], "retired", f"reemplazada por v{r['version']}")
        self._set(vid, "production", reason)

    def revert(self, strategy):
        retired = self._by_status(strategy, "retired")
        if not retired:
            raise ValueError("No hay versión anterior a la que volver")
        cur = self.production(strategy)
        self._set(cur["vid"], "rejected", "revertida manualmente")
        self._set(retired[-1]["vid"], "production", "restaurada por revert")


def _oos_metrics(rets: pd.Series, trades: int) -> dict:
    rets = rets.dropna()
    sh = float(rets.mean() / rets.std() * math.sqrt(252)) if rets.std() > 0 else 0.0
    return {"sharpe": round(sh, 2), "total_return_pct": round(float((1 + rets).prod() - 1) * 100, 2),
            "days": int(len(rets)), "trades": int(trades)}


def walk_forward(df, strategy, grid, prod_params, cost, train=504, test=126) -> dict:
    strat = strategies.get(strategy)
    combos = [p for p in param_grid(grid) if _valid({**strat.defaults, **p})] or [{}]
    sigs = {json.dumps(p, sort_keys=True): strat.signals(df, p) for p in combos}
    prod_sig = strat.signals(df, prod_params)
    wf_rets, prod_rets, chosen = [], [], []
    wf_tr = prod_tr = 0
    for s in range(0, len(df) - train - test + 1, test):
        tr, te = df.iloc[s:s + train], df.iloc[s + train:s + train + test]
        best = max(combos, key=lambda p: (lambda m: m["sharpe"] if m["num_trades"] >= 3 else -9)(
            run_backtest(tr, sigs[json.dumps(p, sort_keys=True)].loc[tr.index], **cost).metrics))
        chosen.append(best)
        r = run_backtest(te, sigs[json.dumps(best, sort_keys=True)].loc[te.index], **cost)
        wf_rets.append(r.equity.pct_change().dropna()); wf_tr += r.metrics["num_trades"]
        r2 = run_backtest(te, prod_sig.loc[te.index], **cost)
        prod_rets.append(r2.equity.pct_change().dropna()); prod_tr += r2.metrics["num_trades"]
    if not chosen:
        return {}
    return {"windows": len(chosen), "walk_forward": _oos_metrics(pd.concat(wf_rets), wf_tr),
            "production": _oos_metrics(pd.concat(prod_rets), prod_tr),
            "last_choice": {**strat.defaults, **chosen[-1]},
            "stability": round(Counter(json.dumps(c, sort_keys=True) for c in chosen).most_common(1)[0][1] / len(chosen), 2)}


def regime_performance(df, spy, strategy, params, cost) -> list[dict]:
    r = run_backtest(df, strategies.get(strategy).signals(df, params), **cost)
    rets = r.equity.pct_change()
    bh = df["close"].pct_change()
    reg = regime_series(spy).reindex(df.index)
    out = []
    for lab in sorted(reg.dropna().unique()):
        m = reg == lab
        x, b = rets[m].dropna(), bh[m].dropna()
        if len(x) < 40:
            continue
        out.append({"regime": lab, "days": int(len(x)),
                    "ann_return_pct": round(float(x.mean() * 252 * 100), 1),
                    "sharpe": round(float(x.mean() / x.std() * math.sqrt(252)), 2) if x.std() > 0 else 0.0,
                    "bh_ann_return_pct": round(float(b.mean() * 252 * 100), 1)})
    return out


def run_learning(store: IntelStore, versions: Versions, bars: dict, symbols: list[str], grids: dict, cost: dict,
                 auto_promote: bool = False) -> dict:
    report = {"generated_at": now(), "criteria": CRITERIA, "strategies": {}}
    cost = {"commission": cost.get("commission", 0.0), "slippage_bps": cost.get("slippage_bps", 5.0)}
    for name in strategies.STRATEGIES:
        prod = versions.production(name)
        per_sym, choices = {}, []
        for sym in symbols:
            df = bars.get(sym)
            if df is None or len(df) < 900:
                continue
            wf = walk_forward(df, name, grids.get(name, {}), prod["params"], cost)
            if wf:
                per_sym[sym] = wf
                choices.append(json.dumps(wf["last_choice"], sort_keys=True))
        if not per_sym:
            continue
        gains = [v["walk_forward"]["sharpe"] - v["production"]["sharpe"] for v in per_sym.values()]
        cand, freq = Counter(choices).most_common(1)[0]
        summary = {
            "production": prod, "symbols": per_sym,
            "mean_sharpe_gain": round(float(np.mean(gains)), 2),
            "symbol_win_frac": round(float(np.mean([g > 0 for g in gains])), 2),
            "oos_trades": int(sum(v["walk_forward"]["trades"] for v in per_sym.values())),
            "candidate": json.loads(cand), "candidate_consensus": round(freq / len(choices), 2),
            "regimes": regime_performance(bars.get(symbols[0]), bars["SPY"], name, prod["params"], cost) if "SPY" in bars and symbols[0] in bars else [],
        }
        ok = (summary["mean_sharpe_gain"] >= CRITERIA["min_sharpe_gain"]
              and summary["symbol_win_frac"] >= CRITERIA["min_symbol_win_frac"]
              and summary["oos_trades"] >= CRITERIA["min_oos_trades"]
              and summary["candidate_consensus"] >= CRITERIA["min_param_stability"])
        summary["decision"] = "sin cambios: no supera los criterios fuera de muestra"
        if ok:
            vid = versions.propose(name, summary["candidate"], {k: summary[k] for k in
                                   ("mean_sharpe_gain", "symbol_win_frac", "oos_trades", "candidate_consensus")})
            summary["decision"] = f"candidata enviada a shadow ({vid})" if vid else "candidata ya en prueba o igual a producción"
        summary["shadow"] = _review_shadow(store, versions, name, auto_promote)
        report["strategies"][name] = summary
    store.upsert("reports", {"rid": uid("learning", report["generated_at"][:10]), "date": report["generated_at"][:10],
                             "kind": "learning", "created_at": now(), "markdown": "", "data": report})
    return report


def _review_shadow(store: IntelStore, versions: Versions, name: str, auto_promote: bool) -> list[dict]:
    prod = versions.production(name)
    out = []
    for r in versions._by_status(name, "shadow") + versions._by_status(name, "ready"):
        lab = f"v{r['version']}-shadow"
        s = store.query("SELECT AVG(excess_return) e, AVG(correct) h, COUNT(*) n FROM predictions WHERE model=? AND "
                        "model_version=? AND evaluated_at IS NOT NULL AND created_at>=?", (f"strategy:{name}", lab, r["created_at"]))[0]
        p = store.query("SELECT AVG(excess_return) e, AVG(correct) h, COUNT(*) n FROM predictions WHERE model=? AND "
                        "model_version=? AND evaluated_at IS NOT NULL AND created_at>=?", (f"strategy:{name}", prod["label"], r["created_at"]))[0]
        st = {"vid": r["vid"], "version": r["version"], "shadow": s, "production": p, "status": r["status"]}
        if (s["n"] or 0) >= SHADOW_MIN and p["n"]:
            if (s["e"] or 0) >= (p["e"] or 0) and (s["h"] or 0) >= (p["h"] or 0):
                versions._set(r["vid"], "ready", "shadow no peor que producción")
                st["status"] = "ready"
                if auto_promote:
                    versions.promote(r["vid"], "auto-promoción (intel.auto_promote=true)")
                    st["status"] = "production"
            elif s["n"] >= SHADOW_MAX:
                versions._set(r["vid"], "rejected", "shadow peor que producción")
                st["status"] = "rejected"
        out.append(st)
    return out
