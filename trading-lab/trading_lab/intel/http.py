"""HTTP compartido para fuentes públicas: reintentos, backoff, límite por host y User-Agent."""
from __future__ import annotations

import logging
import os
import threading
import time
from urllib.parse import urlparse

import requests

log = logging.getLogger(__name__)
# SEC exige un User-Agent que identifique al solicitante con un contacto.
# Configúralo con tu propio contacto: export SEC_USER_AGENT="MiLab micorreo@dominio.com"
DEFAULT_UA = "TradingResearchLab/1.0 research-lab@example.com"
MIN_INTERVAL = {"www.sec.gov": 0.15, "data.sec.gov": 0.15, "fred.stlouisfed.org": 0.5, "www.bls.gov": 1.0,
                "www.federalreserve.gov": 0.5}
_last: dict[str, float] = {}
_lock = threading.Lock()
_session = requests.Session()


class SourceError(RuntimeError):
    pass


def _throttle(host: str):
    gap = MIN_INTERVAL.get(host, 0.0)
    with _lock:
        wait = _last.get(host, 0) + gap - time.time()
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.time()


def get(url: str, params: dict | None = None, headers: dict | None = None, retries: int = 3, timeout: float = 25):
    host = urlparse(url).netloc
    h = {"User-Agent": os.environ.get("SEC_USER_AGENT", DEFAULT_UA), "Accept-Encoding": "gzip, deflate"}
    h.update(headers or {})
    delay = 2.0
    for attempt in range(retries + 1):
        _throttle(host)
        try:
            r = _session.get(url, params=params, headers=h, timeout=timeout)
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == retries:
                raise SourceError(f"{host}: sin conexión ({type(e).__name__})") from None
            time.sleep(delay); delay *= 2; continue
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            ra = r.headers.get("Retry-After")
            time.sleep(float(ra) if ra and ra.isdigit() else delay); delay *= 2; continue
        if r.status_code >= 400:
            raise SourceError(f"{host}: HTTP {r.status_code}")
        return r
    raise SourceError(f"{host}: reintentos agotados")


def get_json(url, **kw):
    return get(url, **kw).json()


def get_text(url, **kw):
    r = get(url, **kw)
    ctype = r.headers.get("Content-Type", "")
    if "charset=" in ctype.lower():
        return r.content.decode(ctype.lower().split("charset=")[-1].split(";")[0].strip(), errors="replace").lstrip("\ufeff")
    return r.content.decode("utf-8-sig", errors="replace")
