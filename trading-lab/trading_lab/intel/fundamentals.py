"""Análisis fundamental a partir de los datos XBRL oficiales de SEC EDGAR (companyfacts)."""
from __future__ import annotations

from datetime import date, timedelta

from . import http
from .sources import _ticker_map
from .store import IntelStore, now

TAGS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "RevenuesNetOfInterestExpense", "SalesRevenueNet"],
    "net_income": ["NetIncomeLoss"],
    "op_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "eps_diluted": ["EarningsPerShareDiluted"],
    "liabilities": ["Liabilities"],
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "long_term_debt": ["LongTermDebtNoncurrent", "LongTermDebt"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue"],
}
def _d(x):
    return date.fromisoformat(x)


def _series(facts: dict, names: list[str]):
    """Usa la etiqueta con el dato más reciente. Devuelve (trimestres {fin: (valor, filed)}, instantáneos {fin: ...}).

    Trabaja con fechas reales de inicio/fin (válido para años fiscales no naturales). El trimestre que solo aparece
    dentro del informe anual (10-K) se deriva como anual menos los tres trimestres contenidos en él.
    """
    best = None
    for n in names:
        f = facts.get(n)
        if not f:
            continue
        units = f["units"].get("USD") or f["units"].get("USD/shares") or next(iter(f["units"].values()))
        last_end = max(x["end"] for x in units)
        if best is None or last_end > best[0]:
            best = (last_end, units)
    if not best:
        return {}, {}
    q, inst, ann, ytd = {}, {}, {}, {}
    for x in best[1]:
        if "start" in x:
            days = (_d(x["end"]) - _d(x["start"])).days
            if 80 <= days <= 100:
                q[x["end"]] = (x["val"], x["filed"], x["start"])
            elif 350 <= days <= 380:
                ann[x["end"]] = (x["val"], x["filed"], x["start"])
            if days >= 80:
                ytd.setdefault(x["start"], {})[x["end"]] = (x["val"], x["filed"])
        else:
            inst[x["end"]] = (x["val"], x["filed"])
    # Partidas acumuladas del ejercicio (p. ej. flujo de caja): trimestre = acumulado_n - acumulado_{n-1}
    for st, by_end in ytd.items():
        ends = sorted(by_end)
        for prev, cur in zip(ends, ends[1:]):
            if cur not in q and 80 <= (_d(cur) - _d(prev)).days <= 100:
                q[cur] = (by_end[cur][0] - by_end[prev][0], by_end[cur][1], prev)
        if ends and ends[0] not in q and 80 <= (_d(ends[0]) - _d(st)).days <= 100:
            q[ends[0]] = (by_end[ends[0]][0], by_end[ends[0]][1], st)
    for end, (v, fd, st) in ann.items():
        if end in q:
            continue
        inside = [k for k, (_, _, s0) in q.items() if s0 >= st and k < end]
        if len(inside) == 3:
            q[end] = (v - sum(q[k][0] for k in inside), fd, (_d(max(inside)) + timedelta(days=1)).isoformat())
    return {k: (v[0], v[1]) for k, v in q.items()}, inst


def _ttm(q: dict):
    ends = sorted(q)[-4:]
    if len(ends) < 4 or (_d(ends[-1]) - _d(ends[0])).days > 300:
        return None  # faltan trimestres consecutivos
    return sum(q[e][0] for e in ends)


def _year_ago(q: dict, end: str):
    target = _d(end) - timedelta(days=364)
    cands = [k for k in q if abs((_d(k) - target).days) <= 20]
    return q[cands[0]][0] if cands else None


def compute(facts: dict, price: float | None) -> dict:
    g = facts.get("us-gaap", {})
    out, missing = {}, []
    s = {name: _series(g, tags) for name, tags in TAGS.items()}
    rev_q = s["revenue"][0]
    if not rev_q:
        return {"available": False, "missing": ["ingresos"]}
    last = max(rev_q)
    out["last_quarter_end"] = last
    out["filed"] = rev_q[last][1]
    for name in ("revenue", "net_income", "op_cash_flow", "capex", "eps_diluted"):
        q = s[name][0]
        out[f"{name}_ttm"] = _ttm(q) if q and max(q) == last else None
        if q and last in q:
            prev = _year_ago(q, last)
            if prev:
                out[f"{name}_yoy_pct"] = round((q[last][0] / prev - 1) * 100, 1)
        if out[f"{name}_ttm"] is None:
            missing.append(name)
    for name in ("liabilities", "equity", "long_term_debt", "cash"):
        inst = s[name][1]
        out[name] = inst[max(inst)][0] if inst else None
    r, ni = out.get("revenue_ttm"), out.get("net_income_ttm")
    out["net_margin_pct"] = round(ni / r * 100, 1) if r and ni is not None else None
    if out.get("op_cash_flow_ttm") is not None and out.get("capex_ttm") is not None:
        out["free_cash_flow_ttm"] = out["op_cash_flow_ttm"] - out["capex_ttm"]
    out["debt_to_equity"] = round(out["long_term_debt"] / out["equity"], 2) if out.get("long_term_debt") and out.get("equity") and out["equity"] > 0 else None
    out["liabilities_to_equity"] = round(out["liabilities"] / out["equity"], 2) if out.get("liabilities") and out.get("equity") and out["equity"] > 0 else None
    eps = out.get("eps_diluted_ttm")
    out["pe_ttm"] = round(price / eps, 1) if price and eps and eps > 0 else None
    out["price_used"] = price
    out["available"] = True
    out["missing"] = missing
    return out


def score(f: dict) -> tuple[float, list[str]]:
    """Puntuación fundamental en [-1, 1] con su explicación. Heurística, no una valoración."""
    if not f or not f.get("available"):
        return 0.0, ["sin datos fundamentales"]
    pts, why = [], []
    if (g := f.get("revenue_yoy_pct")) is not None:
        pts.append(1 if g > 10 else 0.5 if g > 3 else -0.5 if g < 0 else 0); why.append(f"ingresos {g:+.1f}% interanual")
    if (g := f.get("net_income_yoy_pct")) is not None:
        pts.append(0.5 if g > 10 else -0.5 if g < -10 else 0); why.append(f"beneficio {g:+.1f}% interanual")
    if (m := f.get("net_margin_pct")) is not None:
        pts.append(0.5 if m > 15 else -0.5 if m < 0 else 0); why.append(f"margen neto {m}%")
    if (d := f.get("debt_to_equity")) is not None:
        pts.append(-0.5 if d > 2 else 0.25 if d < 0.5 else 0); why.append(f"deuda LP/patrimonio {d}")
    if f.get("free_cash_flow_ttm") is not None:
        pts.append(0.25 if f["free_cash_flow_ttm"] > 0 else -0.5); why.append("FCF positivo" if f["free_cash_flow_ttm"] > 0 else "FCF negativo")
    if (pe := f.get("pe_ttm")) is not None:
        pts.append(-0.5 if pe > 60 else 0.25 if pe < 15 else 0); why.append(f"PER {pe}")
    return (round(max(-1, min(1, sum(pts) / max(len(pts), 1) * 1.5)), 2), why)


def refresh(store: IntelStore, symbols: list[str], prices: dict[str, float]) -> int:
    from .sources import _guard
    def run():
        tmap = _ticker_map()
        n = 0
        for sym in symbols:
            cik = tmap.get(sym)
            if not cik:
                continue
            facts = http.get_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")["facts"]
            f = compute(facts, prices.get(sym))
            store.upsert("fundamentals", {"symbol": sym, "as_of": now(), "filed": f.get("filed"), "data": f})
            n += 1
        return n, "por publicación de 10-Q/10-K"
    return _guard(store, "sec_fundamentals", run)
