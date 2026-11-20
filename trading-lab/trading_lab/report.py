"""Informe de sesión: operaciones, rechazos, capital, posiciones y oportunidades."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import strategies
from .config import Config
from .data import bars_to_frame
from .storage import JOURNAL_DIR, Store

NY = ZoneInfo("America/New_York")
REJECT_ACTIONS = ("rejected_by_risk", "rejected", "error_retryable", "blocked", "stale_data",
                  "duplicate_skipped", "cancel_oversize", "skip")


def _f(x):
    return None if x in (None, "") else float(x)


def position_rows(client, store: Store, cfg: Config) -> list[dict]:
    alloc = {a.symbol: a.strategy for a in cfg.allocations}
    rows = []
    for p in client.get_positions():
        sym = p["symbol"]
        buy = store.conn.execute(
            "SELECT * FROM orders WHERE symbol=? AND side='buy' AND filled_avg_price IS NOT NULL "
            "ORDER BY id DESC LIMIT 1", (sym,)).fetchone()
        qty, avg, cur = _f(p["qty"]), _f(p["avg_entry_price"]), _f(p["current_price"])
        row = {"symbol": sym, "strategy": alloc.get(sym, "(sin asignar)"), "qty": qty,
               "entry_price": avg, "current_price": cur, "market_value": _f(p["market_value"]),
               "unrealized_pl": _f(p["unrealized_pl"]), "unrealized_pl_pct": round(_f(p["unrealized_plpc"]) * 100, 2),
               "entry_reason": buy["reason"] if buy else None, "entry_time": buy["filled_at"] if buy else None,
               "commission": 0.0}
        if buy and buy["ref_price"]:
            diff = (buy["filled_avg_price"] - buy["ref_price"]) * buy["filled_qty"]
            row["fill_vs_signal_close_usd"] = round(diff, 2)
            row["fill_vs_signal_close_bps"] = round((buy["filled_avg_price"] / buy["ref_price"] - 1) * 1e4, 1)
            row["modeled_slippage_usd"] = round(buy["filled_avg_price"] * buy["filled_qty"] * cfg.slippage_bps / 1e4, 2)
        rows.append(row)
    return rows


def opportunity_scan(client, cfg: Config, last_session: str) -> list[dict]:
    """Señales actuales de TODAS las estrategias en TODOS los símbolos (informativo, no opera)."""
    out = []
    start = (datetime.now(timezone.utc) - timedelta(days=600)).strftime("%Y-%m-%d")
    for sym in cfg.symbols:
        df = bars_to_frame(client.get_bars(sym, start=start))
        df = df[df.index <= last_session]
        row = {"symbol": sym, "last_bar": str(df.index[-1].date()), "close": round(float(df.close.iloc[-1]), 2)}
        for name, s in strategies.STRATEGIES.items():
            row[name] = int(s.signals(df).iloc[-1])
        out.append(row)
    return out


def session_report(client, store: Store, cfg: Config, session_date: str | None = None) -> dict:
    acct = client.verify_paper()
    now_ny = datetime.now(NY)
    session_date = session_date or now_ny.date().isoformat()
    since = (datetime.fromisoformat(session_date) - timedelta(days=1)).isoformat()
    decisions = [dict(r) for r in store.conn.execute("SELECT * FROM decisions WHERE ts >= ? ORDER BY id", (since,))]
    orders = [dict(r) for r in store.conn.execute("SELECT * FROM orders WHERE ts >= ? ORDER BY id", (since,))]
    alp_orders = client.get_orders("all", 100)
    equity, last_eq = float(acct["equity"]), float(acct["last_equity"])
    rep = {
        "session_date": session_date, "generated_at": now_ny.isoformat(timespec="seconds"),
        "paper_verified": True, "account_prefix": acct["account_number"][:2],
        "capital": {"equity": equity, "cash": float(acct["cash"]), "long_market_value": float(acct["long_market_value"]),
                    "exposure_pct": round(float(acct["long_market_value"]) / equity * 100, 2),
                    "day_pl": round(equity - last_eq, 2), "day_pl_pct": round((equity / last_eq - 1) * 100, 3)},
        "positions": position_rows(client, store, cfg),
        "orders_submitted": [o for o in orders if o["status"] not in ("rejected", "error_retryable")],
        "orders_rejected": [o for o in orders if o["status"] in ("rejected", "error_retryable")],
        "decisions_not_executed": [d for d in decisions if d["action"] in REJECT_ACTIONS],
        "fills": [{k: o.get(k) for k in ("symbol", "side", "qty", "filled_qty", "filled_avg_price", "filled_at",
                                          "status", "client_order_id")}
                  for o in alp_orders if o.get("filled_at") and o["filled_at"][:10] >= session_date],
        "errors": [dict(r) for r in store.conn.execute("SELECT * FROM errors WHERE ts >= ?", (since,))],
        "costs_note": "Comisión 0 $ (supuesto: Alpaca no cobra comisión en acciones). Las tasas regulatorias de venta "
                      "no se simulan en paper. 'fill_vs_signal_close' incluye el gap nocturno, no solo deslizamiento.",
    }
    return rep


def to_markdown(rep: dict, scan: list[dict] | None = None) -> str:
    c = rep["capital"]
    L = [f"# Informe de sesión {rep['session_date']} (Paper Trading)", "",
         f"Generado {rep['generated_at']} · cuenta verificada como paper ({rep['account_prefix']}…)", "",
         "## Capital ficticio", "",
         f"| Equity | Efectivo | Invertido | Exposición | P/L del día |", "|---|---|---|---|---|",
         f"| {c['equity']:,.2f} $ | {c['cash']:,.2f} $ | {c['long_market_value']:,.2f} $ | {c['exposure_pct']}% | "
         f"{c['day_pl']:+,.2f} $ ({c['day_pl_pct']:+.3f}%) |", "", "## Posiciones abiertas", ""]
    if rep["positions"]:
        L += ["| Activo | Estrategia | Cant. | Entrada | Actual | P/L | Fill vs cierre señal | Motivo de entrada |",
              "|---|---|---|---|---|---|---|---|"]
        for p in rep["positions"]:
            fv = f"{p.get('fill_vs_signal_close_usd', '—')} $ ({p.get('fill_vs_signal_close_bps', '—')} pb)"
            L.append(f"| {p['symbol']} | {p['strategy']} | {p['qty']:g} | {p['entry_price']:.2f} | {p['current_price']:.2f} | "
                     f"{p['unrealized_pl']:+.2f} $ ({p['unrealized_pl_pct']:+.2f}%) | {fv} | {p['entry_reason'] or '—'} |")
    else:
        L.append("Sin posiciones abiertas.")
    L += ["", "## Ejecuciones (fills)", ""]
    L += [f"- {f['side']} {f['filled_qty']} {f['symbol']} a {float(f['filled_avg_price']):.2f} $ ({f['filled_at'][:19]})"
          for f in rep["fills"]] or ["Ninguna en esta sesión."]
    L += ["", "## Órdenes enviadas", ""]
    L += [f"- {o['side']} {o['qty']:g} {o['symbol']} · {o['status']} · {o['reason'] or ''}" for o in rep["orders_submitted"]] or ["Ninguna."]
    L += ["", "## Órdenes rechazadas", ""]
    L += [f"- {o['side']} {o['qty']:g} {o['symbol']} · {o['error']}" for o in rep["orders_rejected"]] or ["Ninguna."]
    L += ["", "## Decisiones no ejecutadas (riesgo, datos, duplicados, cancelaciones)", ""]
    L += [f"- {d['symbol']} · {d['strategy'] or '-'} · **{d['action']}** · {d['reason']}" for d in rep["decisions_not_executed"]] or ["Ninguna."]
    if rep["errors"]:
        L += ["", "## Errores", ""] + [f"- {e['ts']} {e['source']}: {e['message']}" for e in rep["errors"]]
    if scan:
        names = list(strategies.STRATEGIES)
        L += ["", "## Escaneo de oportunidades (informativo, no opera)", "",
              "| Activo | Cierre | " + " | ".join(names) + " |", "|---|---|" + "---|" * len(names)]
        L += [f"| {s['symbol']} | {s['close']} | " + " | ".join("●" if s[n] else "·" for n in names) + " |" for s in scan]
    L += ["", f"_{rep['costs_note']}_", "",
          "_Simulación con dinero ficticio. Un resultado de una sesión no indica rentabilidad futura._"]
    return "\n".join(L)


def write_report(client, store: Store, cfg: Config) -> tuple[dict, str]:
    rep = session_report(client, store, cfg)
    cal = client.get_calendar((datetime.now(NY).date() - timedelta(days=10)).isoformat(), datetime.now(NY).date().isoformat())
    from .paper_trader import last_completed_session
    scan = opportunity_scan(client, cfg, last_completed_session(cal, datetime.now(NY)))
    md = to_markdown(rep, scan)
    out = JOURNAL_DIR / "sessions"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{rep['session_date']}.md").write_text(md)
    (out / f"{rep['session_date']}.json").write_text(json.dumps({**rep, "scan": scan}, indent=1, default=str))
    return rep, md
