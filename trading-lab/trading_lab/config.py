"""Carga y validación de configuración (config.json)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config.json"


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class RiskLimits:
    max_position_pct: float          # % máx. del equity en una sola posición
    max_total_exposure_pct: float    # % máx. del equity invertido en total
    max_daily_loss_pct: float        # si la pérdida del día supera esto, se detienen las compras
    max_drawdown_pct: float          # si el drawdown desde el máximo lo supera, se detienen las compras
    max_orders_per_day: int
    min_cash_reserve_pct: float      # efectivo mínimo que nunca se invierte
    position_stop_loss_pct: float = 8.0   # cierre forzado si una posición pierde este %
    stop_cooldown_days: int = 5           # días sin reentrar en un activo tras un stop

    def validate(self) -> None:
        if not 0 < self.position_stop_loss_pct <= 50:
            raise ConfigError("risk.position_stop_loss_pct debe estar en (0, 50]")
        for name in ("max_position_pct", "max_total_exposure_pct", "max_daily_loss_pct",
                     "max_drawdown_pct", "min_cash_reserve_pct"):
            v = getattr(self, name)
            if not (0 < v <= 100) and not (name == "min_cash_reserve_pct" and v == 0):
                raise ConfigError(f"risk.{name} debe estar en (0, 100]")
        # Sin apalancamiento: la exposición total no puede superar el 100 % del equity.
        if self.max_total_exposure_pct + self.min_cash_reserve_pct > 100:
            raise ConfigError("exposición + reserva de efectivo no puede superar el 100 % (sin apalancamiento)")
        if self.max_position_pct > self.max_total_exposure_pct:
            raise ConfigError("max_position_pct no puede superar max_total_exposure_pct")
        if self.max_orders_per_day <= 0:
            raise ConfigError("risk.max_orders_per_day debe ser > 0")


@dataclass(frozen=True)
class Allocation:
    strategy: str
    symbol: str
    params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Config:
    symbols: list[str]
    data_start: str
    commission_per_trade: float
    slippage_bps: float
    train_fraction: float
    risk: RiskLimits
    allocations: list[Allocation]
    strategy_grids: dict

    @property
    def cost_model(self) -> dict:
        return {"commission": self.commission_per_trade, "slippage_bps": self.slippage_bps}


def load_config(path: Path | str = DEFAULT_CONFIG) -> Config:
    raw = json.loads(Path(path).read_text())
    if "risk" not in raw:
        raise ConfigError("Faltan los límites de riesgo: el sistema no opera sin ellos")
    # Cualquier clave relacionada con endpoints o live se rechaza: no hay modo real.
    forbidden = {"base_url", "live", "live_trading", "endpoint", "paper"}
    if forbidden & set(raw):
        raise ConfigError(f"Claves no permitidas en config: {sorted(forbidden & set(raw))}")
    risk = RiskLimits(**raw["risk"])
    risk.validate()
    allocs = [Allocation(**a) for a in raw.get("paper_allocations", [])]
    syms = [a.symbol for a in allocs]
    if len(syms) != len(set(syms)):
        # Cada símbolo pertenece a una única estrategia para que las posiciones no se mezclen.
        raise ConfigError("Cada símbolo solo puede asignarse a una estrategia en paper_allocations")
    tf = float(raw.get("train_fraction", 0.6))
    if not 0.3 <= tf <= 0.8:
        raise ConfigError("train_fraction debe estar entre 0.3 y 0.8")
    return Config(
        symbols=raw["symbols"],
        data_start=raw.get("data_start", "2019-01-01"),
        commission_per_trade=float(raw.get("commission_per_trade", 0.0)),
        slippage_bps=float(raw.get("slippage_bps", 5.0)),
        train_fraction=tf,
        risk=risk,
        allocations=allocs,
        strategy_grids=raw.get("strategy_grids", {}),
    )
