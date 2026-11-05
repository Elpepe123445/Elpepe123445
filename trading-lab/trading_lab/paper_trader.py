"""Ciclo de Paper Trading: verificación → datos → señales → riesgo → órdenes simuladas → registro."""
from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import strategies
from .alpaca_client import AlpacaError, AlpacaPaperClient
from .config import Config
from .data import bars_to_frame
from .risk import RiskManager
from .safety import PaperTradingVerificationError
from .storage import Store

log = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
ACTIVE = {"new", "accepted", "pending_new", "partially_filled", "filled", "held", "accepted_for_bidding",
          "pending_replace", "pending_cancel", "done_for_day", "calculated", "replaced"}
FINAL_FAIL = {"canceled", "expired", "rejected"}


def client_order_id(strategy: str, symbol: str, signal_date: str, side: str) -> str:
    """Determinista: una misma señal del mismo día nunca genera dos órdenes activas."""
    return f"lab-{strategy}-{symbol}-{signal_date}-{side}"[:120]


def last_completed_session(calendar: list[dict], now_ny: datetime) -> str | None:
    """Fecha de la última sesión cuyo cierre ya ha pasado (según el calendario de Alpaca)."""
    done = []
    for d in calendar:
        close = datetime.fromisoformat(f"{d['date']}T{d['close']}").replace(tzinfo=NY)
        if close <= now_ny:
            done.append(d["date"])
    return max(done) if done else None


class PaperTrader:
    def __init__(self, cfg: Config, client: AlpacaPaperClient | None = None, store: Store | None = None):
        if not cfg.allocations:
            raise ValueError("No hay paper_allocations configuradas")
        self.cfg = cfg
        self.client = client or AlpacaPaperClient()
        self.store = store or Store()
        self.risk = RiskManager(cfg.risk)

    # ------------------------------------------------------------ helpers
    def _bars(self, symbol: str, last_session: str):
        start = (datetime.now(timezone.utc) - timedelta(days=600)).strftime("%Y-%m-%d")
        df = bars_to_frame(self.client.get_bars(symbol, start=start))
        return df[df.index <= last_session]  # nunca usar barras de una sesión no cerrada

    def sync_orders(self) -> None:
        """Actualiza estado y precio de ejecución de las órdenes del laboratorio."""
        for o in self.store.open_lab_orders():
            try:
                a = self.client.get_order_by_client_id(o["client_order_id"])
            except AlpacaError as e:
                self.store.error("sync_orders", str(e)); continue
            if a:
                self.store.order(o["client_order_id"], status=a.get("status"),
                                 filled_qty=float(a.get("filled_qty") or 0) or None,
                                 filled_avg_price=float(a["filled_avg_price"]) if a.get("filled_avg_price") else None,
                                 filled_at=a.get("filled_at"))

    def _next_coid(self, base: str) -> str | None:
        """Devuelve un id libre o None si ya hay una orden activa/ejecutada para esta señal."""
        for cand in (base, base + "-r2", base + "-r3"):
            local = self.store.get_order(cand)
            remote = self.client.get_order_by_client_id(cand)
            status = (remote or {}).get("status") or (local or {}).get("status")
            if status is None:
                return cand
            if status == "pending_cancel" and (local or {}).get("status") == "canceled":
                continue  # la cancelamos nosotros; Alpaca aún la está procesando
            if status not in FINAL_FAIL:
                return None
        return None

    # ---------------------------------------------------------------- ciclo
    def run_once(self) -> dict:
        summary = {"orders": [], "cancelled": [], "decisions": 0, "blocked": None}
        try:
            acct = self.client.verify_paper()  # sin verificación no hay órdenes
        except (PaperTradingVerificationError, AlpacaError) as e:
            self.store.error("verify_paper", str(e))
            log.error("Verificación paper fallida, ciclo abortado: %s", e)
            summary["blocked"] = str(e)
            return summary
        self.store.equity_snapshot(acct)
        self.sync_orders()
        equity, cash = float(acct["equity"]), float(acct["cash"])
        now_ny = datetime.now(NY)
        cal = self.client.get_calendar((now_ny.date() - timedelta(days=10)).isoformat(), now_ny.date().isoformat())
        last_session = last_completed_session(cal, now_ny)
        summary["last_session"] = last_session
        if not last_session:
            self.store.error("calendar", "No se pudo determinar la última sesión cerrada: no se opera")
            summary["blocked"] = "calendario no disponible"
            return summary
        positions = {p["symbol"]: p for p in self.client.get_positions()}
        open_orders = self.client.get_orders("open")
        pos_limit = equity * self.cfg.risk.max_position_pct / 100

        bars = {}
        for alloc in self.cfg.allocations:
            try:
                bars[alloc.symbol] = self._bars(alloc.symbol, last_session)
            except Exception as e:
                self.store.error(f"data/{alloc.symbol}", f"{type(e).__name__}: {e}")

        # 1) Órdenes pendientes que superan los límites actuales → cancelar
        pending = {}
        for o in open_orders:
            sym, qty = o["symbol"], float(o.get("qty") or 0)
            px = float(bars[sym]["close"].iloc[-1]) if sym in bars and len(bars[sym]) else None
            if (o["side"] == "buy" and str(o.get("client_order_id", "")).startswith("lab-")
                    and px and qty * px > pos_limit * 1.05):
                try:
                    self.client.cancel_order(o["id"])
                    self.store.order(o["client_order_id"], status="canceled", error="cancelada: supera límite de riesgo")
                    self.store.decision(None, sym, last_session, None, None, "cancel_oversize",
                                        f"Orden pendiente de {qty:.0f} acc. (~{qty * px:,.0f} $) supera el límite "
                                        f"por posición ({pos_limit:,.0f} $)", px)
                    summary["cancelled"].append(o["client_order_id"])
                    continue
                except AlpacaError as e:
                    self.store.error("cancel_order", str(e))
            pending.setdefault(sym, []).append(o)

        exposure = sum(max(float(p["market_value"]), 0) for p in positions.values())
        for sym, os_ in pending.items():  # las compras pendientes cuentan como exposición
            px = float(bars[sym]["close"].iloc[-1]) if sym in bars and len(bars[sym]) else 0
            exposure += sum(float(o.get("qty") or 0) * px for o in os_ if o["side"] == "buy")
        managed = {a.symbol for a in self.cfg.allocations}
        for sym, p in positions.items():
            if float(p["qty"]) < 0:
                self.store.error("risk", f"Posición corta inesperada en {sym}; el lab no opera cortos")
            if sym not in managed:
                self.store.decision(None, sym, last_session, None, float(p["qty"]), "unmanaged_position",
                                    "Posición sin estrategia asignada: el lab no la gestiona")

        breaker = self.risk.circuit_breaker(equity, float(acct["last_equity"]), self.store.peak_equity())
        summary["blocked"] = breaker
        summary["exposure_pct_before"] = round(exposure / equity * 100, 2) if equity else None

        for alloc in self.cfg.allocations:
            strat, sym = strategies.get(alloc.strategy), alloc.symbol
            try:
                df = bars.get(sym)
                if df is None or len(df) < 250:
                    self.store.decision(strat.name, sym, last_session, None, None, "skip",
                                        f"Datos insuficientes ({0 if df is None else len(df)} barras)")
                    continue
                sig_date = str(df.index[-1].date())
                if sig_date != last_session:
                    self.store.decision(strat.name, sym, sig_date, None, None, "stale_data",
                                        f"Última barra {sig_date} ≠ última sesión cerrada {last_session}: no se opera")
                    continue
                sig = strat.signals(df, alloc.params)
                signal, price = float(sig.iloc[-1]), float(df["close"].iloc[-1])
                pos = positions.get(sym, {})
                held = float(pos.get("qty", 0) or 0)
                details = {"params": {**strat.defaults, **alloc.params}}
                summary["decisions"] += 1

                if sym in pending:
                    self.store.decision(strat.name, sym, sig_date, signal, held, "hold",
                                        "Orden pendiente en Alpaca: se evita duplicar", price, details)
                    continue
                # Salidas de protección (siempre permitidas: reducen riesgo)
                if held > 0:
                    plpc = float(pos.get("unrealized_plpc", 0) or 0) * 100
                    mv = float(pos.get("market_value", 0) or 0)
                    if plpc <= -self.cfg.risk.position_stop_loss_pct:
                        self._submit(strat.name, sym, sig_date, "sell", int(held), price,
                                     f"STOP-LOSS: pérdida {plpc:.2f}% ≤ -{self.cfg.risk.position_stop_loss_pct}%",
                                     summary, action="sell_stop_loss")
                        continue
                    if mv > pos_limit * 1.25:
                        excess = int((mv - pos_limit) // price)
                        if excess >= 1:
                            self._submit(strat.name, sym, sig_date, "sell", excess, price,
                                         f"Reducción a límite por posición: {mv:,.0f} $ > {pos_limit:,.0f} $",
                                         summary, action="sell_trim")
                            continue

                if signal >= 0.5 and held <= 0:
                    stop_d = self.store.last_stop(sym)
                    if stop_d and (date.fromisoformat(sig_date) - date.fromisoformat(stop_d)).days < self.cfg.risk.stop_cooldown_days:
                        self.store.decision(strat.name, sym, sig_date, signal, held, "blocked",
                                            f"Enfriamiento tras stop-loss del {stop_d}", price, details)
                        continue
                    if breaker:
                        self.store.decision(strat.name, sym, sig_date, signal, held, "blocked", breaker, price, details)
                        continue
                    rd = self.risk.size_buy(price, equity, cash, exposure, 0.0, self.store.orders_today())
                    if not rd.allowed:
                        self.store.decision(strat.name, sym, sig_date, signal, held, "rejected_by_risk", rd.reason, price, details)
                        continue
                    reason = f"Señal {strat.name}=1 al cierre {sig_date}. {rd.reason}"
                    if self._submit(strat.name, sym, sig_date, "buy", rd.qty, price, reason, summary, details=details):
                        cash -= rd.qty * price
                        exposure += rd.qty * price
                elif signal < 0.5 and held > 0:
                    rd = self.risk.size_sell(held, self.store.orders_today())
                    if rd.allowed:
                        self._submit(strat.name, sym, sig_date, "sell", rd.qty, price,
                                     f"Señal {strat.name}=0 al cierre {sig_date}: salida. {rd.reason}", summary, details=details)
                else:
                    state = "en posición, se mantiene" if held > 0 else "sin señal de entrada, se espera"
                    self.store.decision(strat.name, sym, sig_date, signal, held, "hold", f"Sin cambio: {state}", price, details)
            except Exception as e:  # un fallo en un activo no detiene el resto
                log.exception("Error procesando %s/%s", alloc.strategy, sym)
                self.store.error(f"{alloc.strategy}/{sym}", f"{type(e).__name__}: {e}")
        return summary

    def _submit(self, strategy, symbol, sig_date, side, qty, price, reason, summary, action=None, details=None) -> bool:
        action = action or side
        coid = self._next_coid(client_order_id(strategy, symbol, sig_date, side))
        if coid is None:
            self.store.decision(strategy, symbol, sig_date, None, None, "duplicate_skipped",
                                "Ya existe una orden activa o ejecutada para esta señal", price)
            return False
        try:
            o = self.client.submit_order(symbol, qty, side, coid)
            self.store.order(coid, strategy, symbol, side, qty, o.get("status", "submitted"), o.get("id"),
                             ref_price=price, reason=reason)
            self.store.decision(strategy, symbol, sig_date, 1.0 if side == "buy" else 0.0, None, action, reason, price, details)
            summary["orders"].append({"symbol": symbol, "side": side, "qty": qty, "status": o.get("status"), "action": action})
            log.info("Orden paper %s %d %s enviada (%s)", side, qty, symbol, o.get("status"))
            return True
        except AlpacaError as e:
            status = "rejected" if 400 <= e.status < 500 else "error_retryable"
            self.store.order(coid, strategy, symbol, side, qty, status, error=str(e), ref_price=price, reason=reason)
            self.store.decision(strategy, symbol, sig_date, None, None, status, str(e), price)
            log.warning("Orden %s rechazada/error: %s", coid, e)
            return False

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
