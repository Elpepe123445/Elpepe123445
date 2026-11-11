"""Protecciones de seguridad: SOLO Paper Trading.

Este módulo es la única fuente de la URL de trading. No existe ninguna opción
para usar el endpoint de dinero real: la URL está fijada como constante y
cualquier configuración que intente cambiarla provoca un error.
"""
from __future__ import annotations

import logging
import os
import re

# Endpoint de simulación documentado por Alpaca (docs.alpaca.markets/us/docs/paper-trading).
PAPER_TRADING_URL = "https://paper-api.alpaca.markets"
# La API de datos de mercado es de solo lectura y es la misma para paper y live.
MARKET_DATA_URL = "https://data.alpaca.markets"

# Las cuentas paper de Alpaca tienen número de cuenta con prefijo "PA".
PAPER_ACCOUNT_PREFIX = "PA"


class PaperTradingVerificationError(RuntimeError):
    """Se lanza cuando no se puede demostrar que el entorno es Paper Trading."""


def check_base_url_env() -> None:
    """Si el usuario define APCA_API_BASE_URL, debe ser exactamente la URL paper."""
    configured = os.environ.get("APCA_API_BASE_URL")
    if configured and configured.rstrip("/") != PAPER_TRADING_URL:
        raise PaperTradingVerificationError(
            "APCA_API_BASE_URL apunta a un endpoint que no es Paper Trading. "
            "Este laboratorio solo funciona con " + PAPER_TRADING_URL
        )


def assert_paper_url(url: str) -> None:
    if not url.startswith(PAPER_TRADING_URL + "/") and url != PAPER_TRADING_URL:
        raise PaperTradingVerificationError(f"URL de trading no permitida: {url}")


def verify_paper_account(account: dict) -> None:
    """Valida la respuesta de /v2/account. Falla cerrado ante cualquier duda."""
    if not isinstance(account, dict):
        raise PaperTradingVerificationError("Respuesta de cuenta inválida")
    number = str(account.get("account_number", ""))
    if not number.startswith(PAPER_ACCOUNT_PREFIX):
        raise PaperTradingVerificationError(
            "El número de cuenta no tiene el prefijo de cuenta paper ('PA'). Órdenes bloqueadas."
        )
    if account.get("status") != "ACTIVE":
        raise PaperTradingVerificationError(f"Cuenta no activa: {account.get('status')}")
    if account.get("trading_blocked") or account.get("account_blocked"):
        raise PaperTradingVerificationError("La cuenta tiene el trading bloqueado")


class SecretRedactingFilter(logging.Filter):
    """Elimina de los logs cualquier aparición de las claves de API."""

    def __init__(self, secrets: list[str]):
        super().__init__()
        vals = [s for s in secrets if s and len(s) >= 6]
        self._pattern = re.compile("|".join(re.escape(s) for s in vals)) if vals else None

    def filter(self, record: logging.LogRecord) -> bool:
        if self._pattern is not None:
            msg = record.getMessage()
            redacted = self._pattern.sub("***REDACTED***", msg)
            if redacted != msg:
                record.msg, record.args = redacted, ()
        return True


def install_log_redaction() -> None:
    secrets = [os.environ.get("ALPACA_API_KEY", ""), os.environ.get("ALPACA_SECRET_KEY", "")]
    flt = SecretRedactingFilter(secrets)
    root = logging.getLogger()
    root.addFilter(flt)
    for h in root.handlers:
        h.addFilter(flt)
