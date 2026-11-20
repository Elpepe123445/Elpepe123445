"""Tareas periódicas. Se ejecutan con `python -m trading_lab tick` (cron/GitHub Actions) o
`python -m trading_lab scheduler` (servicio persistente). El estado vive en la memoria, así que
una desconexión solo retrasa la tarea al siguiente tick."""
from __future__ import annotations

import json
import logging
import os
import time
import traceback
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

from ..alpaca_client import AlpacaPaperClient
from ..config import Config
from . import fundamentals, learning, market, predictions, report, sources
from .store import JOURNAL, IntelStore, now, uid

log = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
CRITICAL_SOURCES = {"alpaca_news", "fred", "sec_edgar"}


def _last_run(store, job):
    r = store.query("SELECT MAX(started_at) t FROM activity WHERE job=? AND status='ok'", (job,))[0]["t"]
    return datetime.fromisoformat(r) if r else None


def _hours_since(store, job, now_utc):
    t = _last_run(store, job)
    return (now_utc - t).total_seconds() / 3600 if t else 1e9


def _ran_today_after(store, job, now_ny, hour):
    t = _last_run(store, job)
    return t is not None and t.astimezone(NY).date() == now_ny.date() and t.astimezone(NY).hour >= hour


SCHEDULE = {  # nombre: función (store, now_utc, now_ny) -> ¿toca?
    "news": lambda s, u, n: (_hours_since(s, "news", u) >= (1 if n.weekday() < 5 and 7 <= n.hour <= 21 else 6)),
    "official": lambda s, u, n: _hours_since(s, "official", u) >= 3,
    "macro_calendar": lambda s, u, n: _hours_since(s, "macro_calendar", u) >= 20 and n.hour >= 9,
    "fundamentals": lambda s, u, n: _hours_since(s, "fundamentals", u) >= 20,
    "paper_session": lambda s, u, n: n.weekday() < 5 and (n.hour, n.minute) >= (16, 15) and not _ran_today_after(s, "paper_session", n, 16),
    "research": lambda s, u, n: (n.hour, n.minute) >= (16, 20) and not _ran_today_after(s, "research", n, 16),
    "learning": lambda s, u, n: n.weekday() >= 5 and _hours_since(s, "learning", u) >= 120,
}
ORDER = ["news", "official", "macro_calendar", "fundamentals", "paper_session", "research", "learning"]


class Lab:
    """Contexto compartido por las tareas."""

    def __init__(self, cfg: Config, store: IntelStore | None = None, client=None):
        self.cfg = cfg
        self.intel = cfg.intel
        self.store = store or IntelStore()
        self.client = client or AlpacaPaperClient()
        seed = {a.strategy: a.params for a in cfg.allocations}
        self.versions = learning.Versions(self.store, seed)

    @property
    def watchlist(self):
        return list(dict.fromkeys(self.intel["watchlist"] + [a.symbol for a in self.cfg.allocations]))

    def stocks(self):
        return [s for s in self.watchlist if s not in self.intel.get("etfs", [])]

    def universe(self, refresh=False):
        syms = self.watchlist + list(market.SECTORS) + ["SPY"]
        return market.load_universe(self.client, syms, self.cfg.data_start, refresh=refresh)

    # ------------------------------------------------------------- tareas
    def job_news(self):
        n = sources.alpaca_news(self.store, self.client, self.watchlist, days_back=3)
        c = sources.flag_contradictions(self.store)
        return f"{n} noticias nuevas, {c} contradicciones marcadas"

    def job_backfill_news(self, days=120):
        n = sources.alpaca_news(self.store, self.client, self.watchlist, days_back=days, max_pages=400)
        return f"{n} noticias históricas"

    def job_official(self):
        a = sources.fed_press(self.store)
        b = sources.sec_filings(self.store, self.stocks())
        return f"Fed {a} comunicados, SEC {b} presentaciones"

    def job_macro_calendar(self):
        return f"FRED {sources.fred(self.store)} observaciones, BLS {sources.bls_calendar(self.store)} eventos"

    def job_fundamentals(self):
        prices = {}
        for s in self.stocks():
            try:
                prices[s] = float(self.client.get_bars(s, start=(datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d"))[-1]["c"])
            except Exception:
                pass
        return f"{fundamentals.refresh(self.store, self.stocks(), prices)} empresas"

    def job_paper_session(self):
        from ..paper_trader import PaperTrader
        from ..report import write_report
        t = PaperTrader(self.cfg, client=self.client, versions=self.versions, intel=self.store)
        s = t.run_once()
        write_report(t.client, t.store, self.cfg)
        return f"{len(s['orders'])} órdenes, {len(s.get('cancelled', []))} canceladas, bloqueo={s['blocked']}"

    def job_research(self):
        bars = self.universe(refresh=True)
        evaluated = predictions.evaluate(self.store, bars)
        health = {r["source"]: r["status"] for r in self.store.query("SELECT source,status FROM source_health")}
        new = predictions.make_predictions(self.store, bars, self.watchlist, self.versions,
                                           horizon=int(self.intel.get("prediction_horizon", 5)), source_status=health)
        for it in self.store.query("SELECT * FROM items WHERE primary_symbols!='' AND priced_in IS NULL AND published_at>=?",
                                   ((datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),)):
            rx = market.reaction(it, bars)
            if rx and rx.get("assessment"):
                self.store.upsert("items", {"uid": it["uid"], "priced_in": rx["assessment"], "data": {**json.loads(it["data"] or "{}"), "reaction": rx}}, commit=False)
        self.store.conn.commit()
        ctx = {"overview": market.market_overview(bars, self.watchlist), "macro": market.macro_summary(self.store),
               "news": market.important_news(self.store, bars),
               "events": self.store.query("SELECT date,title,source FROM events WHERE date>=? AND date<=? ORDER BY date",
                                          (datetime.now(NY).date().isoformat(), (datetime.now(NY).date() + timedelta(days=14)).isoformat())),
               "screener": sources.alpaca_screener(self.store, self.client),
               "base_rates": market.event_base_rates(self.store, bars),
               "prediction_stats": predictions.stats(self.store), "new_predictions": new, "evaluated": evaluated}
        report.build(self.store, ctx)
        return f"{new} predicciones nuevas, {evaluated} evaluadas"

    def job_learning(self):
        bars = self.universe()
        syms = [s for s in self.intel.get("learning_symbols", ["SPY", "QQQ", "AAPL", "MSFT", "GLD"]) if s in bars]
        rep = learning.run_learning(self.store, self.versions, bars, syms, self.cfg.strategy_grids, self.cfg.cost_model,
                                    auto_promote=bool(self.intel.get("auto_promote", False)))
        self.store.compact_journal()
        return "; ".join(f"{k}: {v['decision']}" for k, v in rep["strategies"].items())

    # ------------------------------------------------------------- motor
    def run_job(self, name: str) -> str:
        started = now()
        aid = uid("act", name, started)
        self.store.upsert("activity", {"aid": aid, "job": name, "started_at": started, "status": "running"})
        try:
            msg = getattr(self, f"job_{name}")()
            self.store.upsert("activity", {"aid": aid, "finished_at": now(), "status": "ok", "message": msg})
            log.info("Tarea %s: %s", name, msg)
            return msg
        except Exception as e:
            self.store.upsert("activity", {"aid": aid, "finished_at": now(), "status": "error",
                                           "message": f"{type(e).__name__}: {e}"[:500]})
            log.error("Tarea %s falló: %s\n%s", name, e, traceback.format_exc(limit=3))
            return f"ERROR {e}"

    def tick(self, now_utc: datetime | None = None) -> dict:
        now_utc = now_utc or datetime.now(timezone.utc)
        now_ny = now_utc.astimezone(NY)
        ran = {}
        for name in ORDER:
            if SCHEDULE[name](self.store, now_utc, now_ny):
                ran[name] = self.run_job(name)
        alerts = self.health()
        return {"ran": ran, "alerts": alerts}

    def health(self) -> list[str]:
        alerts = []
        for s in self.store.query("SELECT * FROM source_health"):
            if s["status"] == "down" or (s["status"] in ("degraded", "stale") and s["source"] in CRITICAL_SOURCES):
                alerts.append(f"Fuente {s['source']} en estado {s['status']}: {s['last_error'] or s['freshness']}")
        for j in ORDER:
            errs = self.store.query("SELECT status FROM activity WHERE job=? ORDER BY started_at DESC LIMIT 3", (j,))
            if len(errs) == 3 and all(e["status"] == "error" for e in errs):
                alerts.append(f"La tarea {j} ha fallado 3 veces seguidas")
        if JOURNAL:
            (JOURNAL / "ALERTS.md").write_text(f"# Alertas ({now()})\n\n" + ("\n".join(f"- {a}" for a in alerts) or "Sin alertas.") + "\n")
        hook = os.environ.get("ALERT_WEBHOOK_URL")
        if alerts and hook:
            try:
                txt = "Trading Lab — alertas:\n" + "\n".join(alerts)
                requests.post(hook, json={"text": txt, "content": txt[:1900]}, timeout=10)
            except requests.RequestException as e:
                log.warning("No se pudo enviar la alerta: %s", e)
        return alerts

    def scheduler(self, interval_s: int = 300):
        """Servicio persistente: ejecuta tick cada interval_s segundos y sobrevive a errores."""
        while True:
            try:
                self.tick()
            except Exception as e:
                log.exception("tick falló: %s", e)
            time.sleep(interval_s)
