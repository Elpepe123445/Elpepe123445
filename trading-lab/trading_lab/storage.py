"""Registro persistente (SQLite) de decisiones, órdenes, errores y equity."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import ROOT

DB_PATH = ROOT / "data" / "lab.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY, ts TEXT, strategy TEXT, symbol TEXT,
  signal_date TEXT, signal REAL, held_qty REAL, action TEXT, reason TEXT, price REAL, details TEXT);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, ts TEXT, client_order_id TEXT UNIQUE, strategy TEXT,
  symbol TEXT, side TEXT, qty REAL, status TEXT, alpaca_order_id TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS errors (id INTEGER PRIMARY KEY, ts TEXT, source TEXT, message TEXT);
CREATE TABLE IF NOT EXISTS equity (id INTEGER PRIMARY KEY, ts TEXT, equity REAL, cash REAL,
  long_market_value REAL, last_equity REAL);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path | str = DB_PATH):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def _ins(self, table: str, **row) -> None:
        cols = ",".join(row)
        self.conn.execute(f"INSERT INTO {table} (ts,{cols}) VALUES (?{',?' * len(row)})", (now(), *row.values()))
        self.conn.commit()

    def decision(self, strategy, symbol, signal_date, signal, held_qty, action, reason, price=None, details=None):
        self._ins("decisions", strategy=strategy, symbol=symbol, signal_date=signal_date, signal=signal,
                  held_qty=held_qty, action=action, reason=reason, price=price,
                  details=json.dumps(details or {}, default=str))

    def order(self, client_order_id, strategy, symbol, side, qty, status, alpaca_order_id=None, error=None):
        self.conn.execute(
            "INSERT INTO orders (ts,client_order_id,strategy,symbol,side,qty,status,alpaca_order_id,error) "
            "VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(client_order_id) DO UPDATE SET status=excluded.status, "
            "alpaca_order_id=COALESCE(excluded.alpaca_order_id, alpaca_order_id), error=excluded.error",
            (now(), client_order_id, strategy, symbol, side, qty, status, alpaca_order_id, error))
        self.conn.commit()

    def has_order(self, client_order_id: str) -> bool:
        r = self.conn.execute("SELECT status FROM orders WHERE client_order_id=?", (client_order_id,)).fetchone()
        return r is not None and r["status"] not in ("error_retryable",)

    def error(self, source: str, message: str):
        self._ins("errors", source=source, message=str(message)[:1000])

    def equity_snapshot(self, acct: dict):
        self._ins("equity", equity=float(acct["equity"]), cash=float(acct["cash"]),
                  long_market_value=float(acct.get("long_market_value", 0)), last_equity=float(acct["last_equity"]))

    def peak_equity(self) -> float | None:
        r = self.conn.execute("SELECT MAX(equity) m FROM equity").fetchone()
        return r["m"]

    def orders_today(self) -> int:
        today = datetime.now(timezone.utc).date().isoformat()
        r = self.conn.execute("SELECT COUNT(*) n FROM orders WHERE ts LIKE ? AND status NOT LIKE 'rejected%' "
                              "AND status NOT LIKE 'error%'", (today + "%",)).fetchone()
        return int(r["n"])

    def rows(self, table: str, limit: int = 200) -> list[dict]:
        assert table in ("decisions", "orders", "errors", "equity")
        return [dict(r) for r in self.conn.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT ?", (limit,))]
