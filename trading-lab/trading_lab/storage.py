"""Registro persistente de decisiones, órdenes, errores y equity.

SQLite sirve las consultas del dashboard. Cada evento se copia además a un diario
JSONL (journal/), que se versiona en git: el contenedor es efímero y el
historial no debe perderse. Si la base de datos no existe, se reconstruye desde el diario.
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import ROOT

DB_PATH = ROOT / "data" / "lab.sqlite3"
JOURNAL_DIR = Path(os.environ.get("LAB_JOURNAL_DIR", ROOT / "journal"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY, ts TEXT, strategy TEXT, symbol TEXT,
  signal_date TEXT, signal REAL, held_qty REAL, action TEXT, reason TEXT, price REAL, details TEXT);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, ts TEXT, client_order_id TEXT UNIQUE, strategy TEXT,
  symbol TEXT, side TEXT, qty REAL, status TEXT, alpaca_order_id TEXT, error TEXT, ref_price REAL,
  reason TEXT, filled_qty REAL, filled_avg_price REAL, filled_at TEXT);
CREATE TABLE IF NOT EXISTS errors (id INTEGER PRIMARY KEY, ts TEXT, source TEXT, message TEXT);
CREATE TABLE IF NOT EXISTS equity (id INTEGER PRIMARY KEY, ts TEXT, equity REAL, cash REAL,
  long_market_value REAL, last_equity REAL);
"""
ORDER_COLS = ("ts", "client_order_id", "strategy", "symbol", "side", "qty", "status", "alpaca_order_id", "error",
              "ref_price", "reason", "filled_qty", "filled_avg_price", "filled_at")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path | str = DB_PATH, journal_dir: Path | str | None = JOURNAL_DIR):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        fresh = not Path(path).exists()
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self._migrate()
        self.journal = Path(journal_dir) if journal_dir else None
        if self.journal:
            self.journal.mkdir(parents=True, exist_ok=True)
            if fresh:
                self._replay()

    def _migrate(self):
        have = {r["name"] for r in self.conn.execute("PRAGMA table_info(orders)")}
        for col, typ in (("ref_price", "REAL"), ("reason", "TEXT"), ("filled_qty", "REAL"),
                         ("filled_avg_price", "REAL"), ("filled_at", "TEXT")):
            if col not in have:
                self.conn.execute(f"ALTER TABLE orders ADD COLUMN {col} {typ}")
        self.conn.commit()

    # ----------------------------------------------------------- diario
    def _log(self, table: str, row: dict):
        if self.journal:
            with open(self.journal / f"{table}.jsonl", "a") as f:
                f.write(json.dumps({"table": table, **row}, default=str) + "\n")

    def _replay(self):
        for table in ("decisions", "errors", "equity", "orders"):
            p = self.journal / f"{table}.jsonl"
            if not p.exists():
                continue
            for line in p.read_text().splitlines():
                row = json.loads(line); row.pop("table", None)
                if table == "orders":
                    self._upsert_order(row)
                else:
                    cols = ",".join(row)
                    self.conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))
        self.conn.commit()

    def _ins(self, table: str, **row) -> None:
        row = {"ts": now(), **row}
        cols = ",".join(row)
        self.conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))
        self.conn.commit()
        self._log(table, row)

    # ---------------------------------------------------------- eventos
    def decision(self, strategy, symbol, signal_date, signal, held_qty, action, reason, price=None, details=None):
        self._ins("decisions", strategy=strategy, symbol=symbol, signal_date=signal_date, signal=signal,
                  held_qty=held_qty, action=action, reason=reason, price=price,
                  details=json.dumps(details or {}, default=str))

    def _upsert_order(self, row: dict):
        row = {k: row.get(k) for k in ORDER_COLS}
        sets = ",".join(f"{k}=COALESCE(excluded.{k}, {k})" for k in ORDER_COLS if k not in ("client_order_id", "ts"))
        self.conn.execute(f"INSERT INTO orders ({','.join(ORDER_COLS)}) VALUES ({','.join('?' * len(ORDER_COLS))}) "
                          f"ON CONFLICT(client_order_id) DO UPDATE SET {sets}", tuple(row.values()))

    def order(self, client_order_id, strategy=None, symbol=None, side=None, qty=None, status=None,
              alpaca_order_id=None, error=None, **extra):
        row = {"ts": now(), "client_order_id": client_order_id, "strategy": strategy, "symbol": symbol, "side": side,
               "qty": qty, "status": status, "alpaca_order_id": alpaca_order_id, "error": error, **extra}
        self._upsert_order(row)
        self.conn.commit()
        self._log("orders", {k: v for k, v in row.items() if v is not None})

    def get_order(self, client_order_id: str) -> dict | None:
        r = self.conn.execute("SELECT * FROM orders WHERE client_order_id=?", (client_order_id,)).fetchone()
        return dict(r) if r else None

    def has_order(self, client_order_id: str) -> bool:
        r = self.get_order(client_order_id)
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
                              "AND status NOT LIKE 'error%' AND status NOT IN ('canceled','expired')",
                              (today + "%",)).fetchone()
        return int(r["n"])

    def last_stop(self, symbol: str) -> str | None:
        r = self.conn.execute("SELECT signal_date FROM decisions WHERE symbol=? AND action='sell_stop_loss' "
                              "ORDER BY id DESC LIMIT 1", (symbol,)).fetchone()
        return r["signal_date"] if r else None

    def open_lab_orders(self) -> list[dict]:
        return [dict(r) for r in self.conn.execute(
            "SELECT * FROM orders WHERE status NOT IN ('filled','canceled','expired','rejected','replaced') "
            "AND alpaca_order_id IS NOT NULL")]

    def rows(self, table: str, limit: int = 200) -> list[dict]:
        assert table in ("decisions", "orders", "errors", "equity")
        return [dict(r) for r in self.conn.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT ?", (limit,))]
