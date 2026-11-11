"""Servidor del dashboard (solo lectura: no expone ningún endpoint para enviar órdenes)."""
from __future__ import annotations

import json
import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from ..alpaca_client import AlpacaPaperClient
from ..config import load_config
from ..research import REPORT_PATH
from ..storage import Store

log = logging.getLogger(__name__)
STATIC = Path(__file__).parent / "index.html"


class _Cache:
    def __init__(self, ttl=20):
        self.ttl, self.data, self.lock = ttl, {}, threading.Lock()

    def get(self, key, fn):
        with self.lock:
            hit = self.data.get(key)
            if hit and time.time() - hit[0] < self.ttl:
                return hit[1]
        val = fn()
        with self.lock:
            self.data[key] = (time.time(), val)
        return val


class App:
    def __init__(self):
        self.store = Store()
        self.cfg = load_config()
        self.cache = _Cache()
        try:
            self.client = AlpacaPaperClient()
        except Exception as e:  # el dashboard sigue mostrando backtests sin credenciales
            log.warning("Sin cliente Alpaca: %s", e)
            self.client = None

    def _alpaca(self, fn):
        if not self.client:
            return {"error": "Credenciales de Alpaca no configuradas"}
        try:
            return fn()
        except Exception as e:
            return {"error": f"{type(e).__name__}: {e}"}

    def summary(self):
        def f():
            acct = self.client.verify_paper()
            keep = ("account_number", "status", "equity", "last_equity", "cash", "portfolio_value",
                    "long_market_value", "short_market_value", "currency")
            return {"account": {k: acct.get(k) for k in keep}, "paper_verified": True,
                    "clock": self.client.get_clock(), "positions": self.client.get_positions()}
        return self.cache.get("summary", lambda: self._alpaca(f))

    def history(self):
        def f():
            ph = self.client.get_portfolio_history("3M", "1D")
            return {"timestamp": ph.get("timestamp"), "equity": ph.get("equity"),
                    "profit_loss": ph.get("profit_loss"), "base_value": ph.get("base_value")}
        return self.cache.get("history", lambda: self._alpaca(f))

    def orders(self):
        return self.cache.get("orders", lambda: self._alpaca(lambda: self.client.get_orders("all", 100)))

    def log(self):
        return {"decisions": self.store.rows("decisions", 200), "orders": self.store.rows("orders", 200),
                "errors": self.store.rows("errors", 100), "equity": list(reversed(self.store.rows("equity", 2000)))}

    def strategies(self):
        from ..strategies import STRATEGIES
        return {"allocations": [{"strategy": a.strategy, "symbol": a.symbol, "params": a.params,
                                 "hypothesis": STRATEGIES[a.strategy].hypothesis} for a in self.cfg.allocations],
                "risk": self.cfg.risk.__dict__}

    # ------------------------------------------------------ Market Intelligence
    def _intel(self):
        if not hasattr(self, "_istore"):
            from ..intel.store import IntelStore
            self._istore = IntelStore()
        return self._istore

    def intel_status(self):
        import requests
        from datetime import datetime, timezone

        def ping(url):
            try:
                return requests.head(url, timeout=5).status_code < 500
            except requests.RequestException:
                return False
        st = self._intel()
        internet = self.cache.get("internet", lambda: {"alpaca": ping("https://data.alpaca.markets"),
                                                       "sec": ping("https://www.sec.gov"),
                                                       "fred": ping("https://fred.stlouisfed.org")})
        act = st.query("SELECT job,started_at,finished_at,status,message FROM activity ORDER BY started_at DESC LIMIT 40")
        last = act[0]["started_at"] if act else None
        mins = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() / 60 if last else None
        alerts = [f"{s['source']}: {s['status']} — {s['last_error'] or s['freshness']}"
                  for s in st.query("SELECT * FROM source_health") if s["status"] != "ok"]
        return {"internet": internet, "sources": st.query("SELECT * FROM source_health ORDER BY source"),
                "activity": act, "last_activity": last, "minutes_since_activity": round(mins, 1) if mins is not None else None,
                "agent_state": "activo" if mins is not None and mins < 90 else "sin actividad reciente (proceso detenido o fuera de horario)",
                "alerts": alerts}

    def intel_news(self):
        rows = self._intel().query(
            "SELECT uid,source,published_at,symbols,title,url,event_type,impact,credibility,sentiment,priced_in,flags "
            "FROM items WHERE uid=cluster_id AND impact IN ('high','medium') ORDER BY published_at DESC LIMIT 60")
        return {"items": rows}

    def intel_report(self, date=None):
        st = self._intel()
        dates = [r["date"] for r in st.query("SELECT date FROM reports WHERE kind='daily' ORDER BY date DESC LIMIT 60")]
        if not dates:
            return {"error": "Aún no hay informes. Ejecuta: python -m trading_lab job research"}
        r = st.query("SELECT markdown,data FROM reports WHERE kind='daily' AND date=?", (date or dates[0],))[0]
        data = json.loads(r["data"] or "{}")
        return {"dates": dates, "date": date or dates[0], "markdown": r["markdown"],
                "overview": data.get("overview"), "macro": data.get("macro"), "events": data.get("events")}

    def intel_predictions(self):
        from ..intel.predictions import stats
        st = self._intel()
        return {"stats": stats(st), "recent": st.query(
            "SELECT model,model_version,symbol,base_date,direction,prob_up,regime,outcome_date,outcome_return,"
            "excess_return,correct,notes FROM predictions ORDER BY COALESCE(evaluated_at, created_at) DESC LIMIT 150")}

    def intel_strategies(self):
        st = self._intel()
        lr = st.query("SELECT date,data FROM reports WHERE kind='learning' ORDER BY date DESC LIMIT 1")
        learn = json.loads(lr[0]["data"]) if lr else None
        if learn:
            for v in learn.get("strategies", {}).values():
                v.pop("symbols", None)
        return {"versions": st.query("SELECT vid,strategy,version,status,params,created_at,decided_at,reason FROM strategy_versions "
                                     "ORDER BY strategy,version"), "learning": learn}

    def backtest(self):
        if not REPORT_PATH.exists():
            return {"error": "Aún no hay informe. Ejecuta: python -m trading_lab backtest"}
        return json.loads(REPORT_PATH.read_text())


def make_handler(app: App):
    routes = {"/api/summary": app.summary, "/api/history": app.history, "/api/orders": app.orders,
              "/api/log": app.log, "/api/strategies": app.strategies, "/api/backtest": app.backtest,
              "/api/intel/status": app.intel_status, "/api/intel/news": app.intel_news,
              "/api/intel/predictions": app.intel_predictions, "/api/intel/strategies": app.intel_strategies}

    class H(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            log.debug(fmt, *args)

        def _send(self, code, body: bytes, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"):
                return self._send(200, STATIC.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/intel/report":
                from urllib.parse import parse_qs, urlparse
                q = parse_qs(urlparse(self.path).query)
                d = (q.get("date") or [None])[0]
                try:
                    data = app.intel_report(d)
                except Exception as e:
                    data = {"error": f"{type(e).__name__}: {e}"}
                return self._send(200, json.dumps(data, default=str).encode(), "application/json")
            if path in routes:
                try:
                    data = routes[path]()
                except Exception as e:
                    data = {"error": f"{type(e).__name__}: {e}"}
                return self._send(200, json.dumps(data, default=str).encode(), "application/json")
            self._send(404, b"not found", "text/plain")

    return H


def serve(host="127.0.0.1", port=8050):
    app = App()
    srv = ThreadingHTTPServer((host, port), make_handler(app))
    log.info("Dashboard en http://%s:%d (solo lectura)", host, port)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
