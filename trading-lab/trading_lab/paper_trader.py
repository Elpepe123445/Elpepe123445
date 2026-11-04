"""Ciclo de Paper Trading: datos → señales → riesgo → órdenes simuladas → registro."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import strategies
from .alpaca_client import AlpacaError, AlpacaPaperClient
from .config import Config
from .data import bars_to_frame
from .risk import RiskManager
from .safety import PaperTradingVerificationError
from .storage import Store

log = logging.getLogger(__name__)


def client_order_id(strategy: str, symbol: str, signal_date: str, side: str) -> str:
    """Determinista: una misma señal del mismo día nunca genera dos órdenes."""
    return f"lab-{strategy}-{symbol}-{signal_date}-{side}"[:128]


class PaperTrader:
    def __init__(self, cfg: Config, client: AlpacaPaperClient | None = None, store: Store | None = None):
        if not cfg.allocations:
            raise ValueError("No hay paper_allocations configuradas")
        self.cfg = cfg
        self.client = client or AlpacaPaperClient()
        self.store = store or Store()
        self.risk = RiskManager(cfg.risk)

    def _completed_bars(self, symbol: str, market_open: bool):
        start = (datetime.now(timezone.utc) - timedelta(days=600)).strftime("%Y-%m-%d")
        df = bars_to_frame(self.client.get_bars(symbol, start=start))
        today = datetime.now(ZoneInfo("America/New_York")).date()
        if market_open and len(df) and df.index[-1].date() >= today:
            df = df.iloc[:-1]  # la barra de hoy está incompleta
        return df

    def run_once(self) -> dict:
        summary = {"orders": [], "decisions": 0, "blocked": None}
        try:
            acct = self.client.verify_paper()  # sin verificación no hay órdenes
        except (PaperTradingVerificationError, AlpacaError) as e:
            self.store.error("verify_paper", str(e))
            log.error("Verificación paper fallida, ciclo abortado: %s", e)
            summary["blocked"] = str(e)
            return summary
        self.store.equity_snapshot(acct)
        equity, cash = float(acct["equity"]), float(acct["cash"])
        clock = self.client.get_clock()
        positions = {p["symbol"]: p for p in self.client.get_positions()}
        open_orders = self.client.get_orders("open")
        pending_syms = {o["symbol"] for o in open_orders}
        exposure = sum(max(float(p["market_value"]), 0) for p in positions.values())
        for p in positions.values():
            if float(p["qty"]) < 0:
                self.store.error("risk", f"Posición corta inesperada en {p['symbol']}; el lab no opera cortos")
        breaker = self.risk.circuit_breaker(equity, float(acct["last_equity"]), self.store.peak_equity())
        if breaker:
            summary["blocked"] = breaker

        for alloc in self.cfg.allocations:
            strat = strategies.get(alloc.strategy)
            sym = alloc.symbol
            try:
                df = self._completed_bars(sym, clock.get("is_open", False))
                if len(df) < 250:
                    self.store.decision(strat.name, sym, None, None, None, "skip", f"Datos insuficientes ({len(df)} barras)")
                    continue
                sig = strat.signals(df, alloc.params)
                signal, sig_date, price = float(sig.iloc[-1]), str(df.index[-1].date()), float(df["close"].iloc[-1])
                held = float(positions.get(sym, {}).get("qty", 0) or 0)
                summary["decisions"] += 1
                if sym in pending_syms:
                    self.store.decision(strat.name, sym, sig_date, signal, held, "hold", "Orden pendiente: se evita duplicar", price)
                    continue
                if signal >= 0.5 and held <= 0:
                    if breaker:
                        self.store.decision(strat.name, sym, sig_date, signal, held, "blocked", breaker, price)
                        continue
                    sym_exp = max(float(positions.get(sym, {}).get("market_value", 0) or 0), 0)
                    rd = self.risk.size_buy(price, equity, cash, exposure, sym_exp, self.store.orders_today())
                    if not rd.allowed:
                        self.store.decision(strat.name, sym, sig_date, signal, held, "rejected_by_risk", rd.reason, price)
                        continue
                    self._submit(strat.name, sym, sig_date, "buy", rd.qty, price, rd.reason, summary)
                    cash -= rd.qty * price
                    exposure += rd.qty * price
                elif signal < 0.5 and held > 0:
                    rd = self.risk.size_sell(held, self.store.orders_today())
                    if rd.allowed:
                        self._submit(strat.name, sym, sig_date, "sell", rd.qty, price, rd.reason, summary)
                else:
                    state = "en posición" if held > 0 else "fuera del mercado"
                    self.store.decision(strat.name, sym, sig_date, signal, held, "hold", f"Sin cambio: {state}", price)
            except Exception as e:  # un fallo en un activo no detiene el resto
                log.exception("Error procesando %s/%s", alloc.strategy, sym)
                self.store.error(f"{alloc.strategy}/{sym}", f"{type(e).__name__}: {e}")
        return summary

    def _submit(self, strategy, symbol, sig_date, side, qty, price, reason, summary):
        coid = client_order_id(strategy, symbol, sig_date, side)
        if self.store.has_order(coid) or self.client.get_order_by_client_id(coid):
            self.store.decision(strategy, symbol, sig_date, None, None, "duplicate_skipped", f"Orden {coid} ya existe", price)
            return
        try:
            o = self.client.submit_order(symbol, qty, side, coid)
            self.store.order(coid, strategy, symbol, side, qty, o.get("status", "submitted"), o.get("id"))
            self.store.decision(strategy, symbol, sig_date, 1.0 if side == "buy" else 0.0, None, side, reason, price)
            summary["orders"].append({"symbol": symbol, "side": side, "qty": qty, "status": o.get("status")})
            log.info("Orden paper %s %d %s enviada (%s)", side, qty, symbol, o.get("status"))
        except AlpacaError as e:
            status = "rejected" if 400 <= e.status < 500 else "error_retryable"
            self.store.order(coid, strategy, symbol, side, qty, status, error=str(e))
            self.store.decision(strategy, symbol, sig_date, None, None, status, str(e), price)
            log.warning("Orden %s rechazada/error: %s", coid, e)

    def run_loop(self, interval_s: int = 900, max_cycles: int | None = None):
        n = 0
        while max_cycles is None or n < max_cycles:
            try:
                s = self.run_once()
                log.info("Ciclo %d: %d decisiones, %d órdenes, bloqueo=%s", n + 1, s["decisions"], len(s["orders"]), s["blocked"])
            except Exception as e:  # desconexiones prolongadas: registrar y seguir
                self.store.error("loop", f"{type(e).__name__}: {e}")
                log.exception("Ciclo fallido; se reintentará")
            n += 1
            if max_cycles is None or n < max_cycles:
                time.sleep(interval_s)
