"""Cliente REST mínimo para Alpaca, restringido a Paper Trading."""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import requests

from .safety import (
    MARKET_DATA_URL,
    PAPER_TRADING_URL,
    PaperTradingVerificationError,
    assert_paper_url,
    check_base_url_env,
    verify_paper_account,
)

log = logging.getLogger(__name__)


class AlpacaError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class AlpacaPaperClient:
    """Las claves se leen de ALPACA_API_KEY / ALPACA_SECRET_KEY y nunca se imprimen."""

    def __init__(self, timeout: float = 15.0, max_retries: int = 4, session: requests.Session | None = None):
        check_base_url_env()
        key = os.environ.get("ALPACA_API_KEY")
        secret = os.environ.get("ALPACA_SECRET_KEY")
        if not key or not secret:
            raise PaperTradingVerificationError(
                "Faltan ALPACA_API_KEY y/o ALPACA_SECRET_KEY en las variables de entorno"
            )
        self._session = session or requests.Session()
        self._session.headers.update({"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret})
        self.timeout = timeout
        self.max_retries = max_retries
        self._verified = False

    def __repr__(self) -> str:  # nunca exponer credenciales
        return "AlpacaPaperClient(base_url=%r, credentials=***)" % PAPER_TRADING_URL

    # ------------------------------------------------------------------ HTTP
    def _request(self, method: str, url: str, **kw) -> Any:
        delay = 1.0
        for attempt in range(self.max_retries + 1):
            try:
                resp = self._session.request(method, url, timeout=self.timeout, **kw)
            except (requests.ConnectionError, requests.Timeout) as e:
                if attempt == self.max_retries:
                    raise AlpacaError(0, f"Error de conexión: {type(e).__name__}") from None
                log.warning("Desconexión (%s). Reintento %d en %.0fs", type(e).__name__, attempt + 1, delay)
                time.sleep(delay)
                delay *= 2
                continue
            # Reintentar solo errores transitorios. Las órdenes llevan client_order_id,
            # así que un reintento no puede crear duplicados (Alpaca rechaza el repetido).
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                log.warning("HTTP %d transitorio. Reintento %d en %.0fs", resp.status_code, attempt + 1, delay)
                time.sleep(delay)
                delay *= 2
                continue
            if resp.status_code >= 400:
                try:
                    msg = resp.json().get("message", resp.text)
                except ValueError:
                    msg = resp.text
                raise AlpacaError(resp.status_code, str(msg)[:300])
            return resp.json() if resp.content else None
        raise AlpacaError(0, "Reintentos agotados")

    def _trading(self, method: str, path: str, **kw) -> Any:
        url = PAPER_TRADING_URL + path
        assert_paper_url(url)
        return self._request(method, url, **kw)

    # -------------------------------------------------------------- Cuenta
    def get_account(self) -> dict:
        return self._trading("GET", "/v2/account")

    def verify_paper(self) -> dict:
        """Debe llamarse con éxito antes de cualquier orden."""
        acct = self.get_account()
        verify_paper_account(acct)
        self._verified = True
        return acct

    def get_clock(self) -> dict:
        return self._trading("GET", "/v2/clock")

    def get_positions(self) -> list[dict]:
        return self._trading("GET", "/v2/positions")

    def get_orders(self, status: str = "open", limit: int = 100) -> list[dict]:
        return self._trading("GET", "/v2/orders", params={"status": status, "limit": limit, "direction": "desc"})

    def get_order_by_client_id(self, client_order_id: str) -> dict | None:
        try:
            return self._trading("GET", "/v2/orders:by_client_order_id", params={"client_order_id": client_order_id})
        except AlpacaError as e:
            if e.status == 404:
                return None
            raise

    def get_portfolio_history(self, period: str = "1M", timeframe: str = "1D") -> dict:
        return self._trading("GET", "/v2/account/portfolio/history", params={"period": period, "timeframe": timeframe})

    # -------------------------------------------------------------- Órdenes
    def submit_order(self, symbol: str, qty: int, side: str, client_order_id: str) -> dict:
        if not self._verified:
            raise PaperTradingVerificationError("Entorno paper no verificado: orden bloqueada")
        if side not in ("buy", "sell"):
            raise ValueError("side inválido")
        if int(qty) <= 0:
            raise ValueError("qty debe ser > 0")
        payload = {
            "symbol": symbol,
            "qty": str(int(qty)),  # acciones enteras, sin fracciones
            "side": side,
            "type": "market",
            "time_in_force": "day",
            "client_order_id": client_order_id,
        }
        return self._trading("POST", "/v2/orders", json=payload)

    # -------------------------------------------------------- Datos mercado
    def get_bars(self, symbol: str, start: str, end: str | None = None, timeframe: str = "1Day",
                 feed: str = "iex", adjustment: str = "all") -> list[dict]:
        params: dict[str, Any] = {"timeframe": timeframe, "start": start, "limit": 10000,
                                  "feed": feed, "adjustment": adjustment}
        if end:
            params["end"] = end
        bars: list[dict] = []
        url = f"{MARKET_DATA_URL}/v2/stocks/{symbol}/bars"
        while True:
            data = self._request("GET", url, params=params)
            bars.extend(data.get("bars") or [])
            token = data.get("next_page_token")
            if not token:
                return bars
            params["page_token"] = token
