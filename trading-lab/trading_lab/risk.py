"""Gestión de riesgo para Paper Trading: sin cortos, sin apalancamiento, con límites."""
from __future__ import annotations

import math
from dataclasses import dataclass

from .config import RiskLimits


@dataclass
class RiskDecision:
    allowed: bool
    qty: int
    reason: str


class RiskManager:
    def __init__(self, limits: RiskLimits):
        if limits is None:
            raise ValueError("No se puede operar sin límites de riesgo")
        limits.validate()
        self.l = limits

    def circuit_breaker(self, equity: float, last_equity: float, peak_equity: float | None) -> str | None:
        """Devuelve un motivo si deben bloquearse las compras nuevas."""
        if last_equity > 0 and (equity / last_equity - 1) * 100 <= -self.l.max_daily_loss_pct:
            return f"Pérdida diaria ≥ {self.l.max_daily_loss_pct}%: compras bloqueadas hoy"
        if peak_equity and (equity / peak_equity - 1) * 100 <= -self.l.max_drawdown_pct:
            return f"Drawdown ≥ {self.l.max_drawdown_pct}% desde el máximo: compras bloqueadas"
        return None

    def size_buy(self, price: float, equity: float, cash: float, current_exposure: float,
                 symbol_exposure: float, orders_today: int) -> RiskDecision:
        if orders_today >= self.l.max_orders_per_day:
            return RiskDecision(False, 0, f"Límite diario de {self.l.max_orders_per_day} órdenes alcanzado")
        if price <= 0 or equity <= 0:
            return RiskDecision(False, 0, "Precio o equity inválidos")
        # Sin apalancamiento: solo se usa el EFECTIVO, nunca el buying power con margen.
        cash_available = cash - equity * self.l.min_cash_reserve_pct / 100
        room_pos = equity * self.l.max_position_pct / 100 - symbol_exposure
        room_total = equity * self.l.max_total_exposure_pct / 100 - current_exposure
        budget = min(cash_available, room_pos, room_total)
        qty = math.floor(budget / (price * 1.01))  # colchón del 1 % por movimiento hasta la ejecución
        if qty < 1:
            return RiskDecision(False, 0, f"Sin margen de riesgo/efectivo (presupuesto {budget:.2f} $)")
        return RiskDecision(True, qty, f"Compra dimensionada: {qty} acciones (presupuesto {budget:.2f} $)")

    def size_sell(self, held_qty: float, orders_today: int) -> RiskDecision:
        # Vender solo lo que se tiene: nunca abrir cortos. Las salidas se permiten
        # aunque se haya alcanzado el límite de órdenes, porque reducen el riesgo.
        qty = int(math.floor(held_qty))
        if qty < 1:
            return RiskDecision(False, 0, "No hay posición larga que cerrar")
        return RiskDecision(True, qty, f"Cierre de {qty} acciones")
