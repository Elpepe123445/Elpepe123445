"""Memoria persistente de investigación (SQLite + diario JSONL versionado en git)."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from ..config import ROOT

DB_PATH = ROOT / "data" / "intel.sqlite3"
JOURNAL = Path(os.environ.get("LAB_JOURNAL_DIR", ROOT / "journal")) / "intel"

TABLES = {
    "items": ("uid", "uid TEXT PRIMARY KEY, source TEXT, kind TEXT, published_at TEXT, fetched_at TEXT, symbols TEXT, "
              "title TEXT, summary TEXT, url TEXT, event_type TEXT, sentiment REAL, credibility TEXT, impact TEXT, "
              "cluster_id TEXT, priced_in TEXT, flags TEXT, data TEXT, primary_symbols TEXT"),
    "source_health": ("source", "source TEXT PRIMARY KEY, last_attempt TEXT, last_success TEXT, last_error TEXT, "
                      "consecutive_failures INTEGER, items_last INTEGER, freshness TEXT, status TEXT"),
    "macro": ("key", "key TEXT PRIMARY KEY, series TEXT, date TEXT, value REAL, fetched_at TEXT"),
    "fundamentals": ("symbol", "symbol TEXT PRIMARY KEY, as_of TEXT, filed TEXT, data TEXT"),
    "events": ("uid", "uid TEXT PRIMARY KEY, kind TEXT, date TEXT, title TEXT, source TEXT, url TEXT, data TEXT"),
    "predictions": ("pid", "pid TEXT PRIMARY KEY, created_at TEXT, model TEXT, model_version TEXT, symbol TEXT, "
                    "base_date TEXT, base_price REAL, horizon INTEGER, direction TEXT, prob_up REAL, features TEXT, "
                    "missing_info TEXT, regime TEXT, outcome_date TEXT, outcome_price REAL, outcome_return REAL, "
                    "excess_return REAL, correct INTEGER, evaluated_at TEXT, notes TEXT"),
    "reports": ("rid", "rid TEXT PRIMARY KEY, date TEXT, kind TEXT, created_at TEXT, markdown TEXT, data TEXT"),
    "strategy_versions": ("vid", "vid TEXT PRIMARY KEY, strategy TEXT, version INTEGER, params TEXT, status TEXT, "
                          "created_at TEXT, decided_at TEXT, evidence TEXT, reason TEXT"),
    "activity": ("aid", "aid TEXT PRIMARY KEY, job TEXT, started_at TEXT, finished_at TEXT, status TEXT, message TEXT"),
}
# Tablas que no se copian al diario (se pueden reconstruir desde las fuentes)
NOT_JOURNALED: set[str] = set()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def uid(*parts) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


class IntelStore:
    def __init__(self, path: Path | str = DB_PATH, journal: Path | str | None = JOURNAL):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        fresh = not Path(path).exists()
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        for t, (_, cols) in TABLES.items():
            self.conn.execute(f"CREATE TABLE IF NOT EXISTS {t} ({cols})")
        have = {r["name"] for r in self.conn.execute("PRAGMA table_info(items)")}
        if "primary_symbols" not in have:
            self.conn.execute("ALTER TABLE items ADD COLUMN primary_symbols TEXT")
        self.conn.commit()
        self.journal = Path(journal) if journal else None
        if self.journal:
            self.journal.mkdir(parents=True, exist_ok=True)
            if fresh:
                self._replay()

    def _replay(self):
        for t in TABLES:
            files = [self.journal / f"{t}.jsonl"] + sorted((self.journal / t).glob("*.jsonl.gz")) if (self.journal / t).exists() \
                else [self.journal / f"{t}.jsonl"]
            for p in files:
                if not p.exists():
                    continue
                text = gzip.open(p, "rt").read() if p.suffix == ".gz" else p.read_text()
                for line in text.splitlines():
                    if line.strip():
                        self.upsert(t, json.loads(line), journal=False, commit=False)
        self.conn.commit()

    def _journal_path(self, table: str, row: dict) -> Path:
        if table == "items":  # volumen alto: un fichero gzip por mes de publicación
            month = (row.get("published_at") or row.get("fetched_at") or now())[:7]
            if not row.get("published_at"):  # actualización parcial: mismo mes que la fila original
                r = self.get("items", row["uid"]) if row.get("uid") else None
                month = (r or {}).get("published_at", now())[:7]
            d = self.journal / "items"
            d.mkdir(exist_ok=True)
            return d / f"{month}.jsonl.gz"
        return self.journal / f"{table}.jsonl"

    def upsert(self, table: str, row: dict, journal: bool = True, commit: bool = True):
        assert table in TABLES
        row = {k: (json.dumps(v, default=str) if isinstance(v, (dict, list)) else v) for k, v in row.items()}
        pk = TABLES[table][0]
        cols = ",".join(row)
        sets = ",".join(f"{k}=excluded.{k}" for k in row if k != pk) or f"{pk}={pk}"
        self.conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))}) "
                          f"ON CONFLICT({pk}) DO UPDATE SET {sets}", tuple(row.values()))
        if commit:
            self.conn.commit()
        if journal and self.journal and table not in NOT_JOURNALED:
            p = self._journal_path(table, row)
            with (gzip.open(p, "at") if p.suffix == ".gz" else open(p, "a")) as f:
                f.write(json.dumps(row, default=str) + "\n")

    def exists(self, table: str, key: str) -> bool:
        pk = TABLES[table][0]
        return self.conn.execute(f"SELECT 1 FROM {table} WHERE {pk}=?", (key,)).fetchone() is not None

    def query(self, sql: str, args=()) -> list[dict]:
        return [dict(r) for r in self.conn.execute(sql, args)]

    def get(self, table: str, key: str) -> dict | None:
        pk = TABLES[table][0]
        r = self.conn.execute(f"SELECT * FROM {table} WHERE {pk}=?", (key,)).fetchone()
        return dict(r) if r else None

    def compact_journal(self):
        """Reescribe cada JSONL con una fila por clave (el diario solo crece por upserts)."""
        if not self.journal:
            return
        for t, (pk, _) in TABLES.items():
            if t in NOT_JOURNALED:
                continue
            rows = self.query(f"SELECT * FROM {t}")
            if t == "items":
                d = self.journal / "items"
                for f in d.glob("*.jsonl.gz"):
                    f.unlink()
                by_month: dict[str, list] = {}
                for r in rows:
                    by_month.setdefault((r["published_at"] or "")[:7] or "unknown", []).append(r)
                d.mkdir(exist_ok=True)
                for m, rs in by_month.items():
                    with gzip.open(d / f"{m}.jsonl.gz", "wt") as f:
                        for r in rs:
                            f.write(json.dumps(r, default=str) + "\n")
                (self.journal / "items.jsonl").unlink(missing_ok=True)
                continue
            with open(self.journal / f"{t}.jsonl", "w") as f:
                for r in rows:
                    f.write(json.dumps(r, default=str) + "\n")
