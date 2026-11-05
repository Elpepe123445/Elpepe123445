"""Conectores de fuentes autorizadas. Cada uno registra salud, frescura, fuente y evita duplicados."""
from __future__ import annotations

import io
import json
import logging
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import pandas as pd

from ..config import ROOT
from ..safety import MARKET_DATA_URL
from . import http, nlp
from .store import IntelStore, now, uid

log = logging.getLogger(__name__)

FRED_SERIES = {  # serie: (descripción, antigüedad máxima en días de la fecha de la observación; las mensuales
    # se fechan al inicio del mes y se publican ~5-6 semanas después de cerrarlo)
    "CPIAUCSL": ("IPC EE. UU. (índice)", 80), "CPILFESL": ("IPC subyacente", 80), "UNRATE": ("Tasa de paro", 80),
    "PAYEMS": ("Nóminas no agrícolas (miles)", 80), "DFF": ("Tipo efectivo fondos federales", 7),
    "DGS10": ("Bono 10 años", 7), "DGS2": ("Bono 2 años", 7), "T10Y2Y": ("Diferencial 10a-2a", 7),
    "VIXCLS": ("VIX", 7), "BAMLH0A0HYM2": ("Diferencial high yield", 7),
}
BLS_KEEP = ("Consumer Price Index", "Employment Situation", "Producer Price Index", "Job Openings",
            "Employment Cost Index", "Real Earnings", "Productivity and Costs")
SEC_8K_ITEMS = {
    "1.01": ("Acuerdo material", "product_business", "medium"), "1.03": ("Quiebra", "accounting_bankruptcy", "high"),
    "2.01": ("Adquisición completada", "m_and_a", "high"), "2.02": ("Resultados trimestrales", "earnings", "high"),
    "2.05": ("Costes de reestructuración", "management", "medium"), "2.06": ("Deterioro material", "accounting_bankruptcy", "high"),
    "3.01": ("Aviso de exclusión de cotización", "accounting_bankruptcy", "high"),
    "4.02": ("Estados financieros no fiables", "accounting_bankruptcy", "high"),
    "5.02": ("Cambio de directivos", "management", "medium"), "7.01": ("Reg FD", "other", "low"), "8.01": ("Otros eventos", "other", "low"),
}
SEC_FORMS = {"8-K", "10-Q", "10-K", "6-K", "S-1", "S-3", "424B5", "SC 13D", "DEF 14A"}


# ------------------------------------------------------------------ salud
def record(store: IntelStore, source: str, ok: bool, error: str | None = None, items: int = 0, freshness: str | None = None):
    prev = store.get("source_health", source) or {}
    fails = 0 if ok else int(prev.get("consecutive_failures") or 0) + 1
    status = "ok" if ok and not (freshness or "").startswith("STALE") else ("stale" if ok else ("down" if fails >= 3 else "degraded"))
    store.upsert("source_health", {"source": source, "last_attempt": now(),
                                   "last_success": now() if ok else prev.get("last_success"),
                                   "last_error": None if ok else error, "consecutive_failures": fails,
                                   "items_last": items, "freshness": freshness, "status": status})
    return status


def _guard(store, source, fn):
    try:
        n, fresh = fn()
        record(store, source, True, items=n, freshness=fresh)
        return n
    except Exception as e:  # la caída de una fuente no detiene las demás
        log.warning("Fuente %s falló: %s", source, e)
        record(store, source, False, error=f"{type(e).__name__}: {e}"[:300])
        return 0


def _add_item(store: IntelStore, *, key: str, source: str, kind: str, published: str, title: str, summary: str = "",
              url: str = "", symbols: list[str] = (), event: tuple[str, str] | None = None, data: dict | None = None) -> bool:
    u = uid(source, key)
    if store.exists("items", u):
        return False  # duplicado exacto
    ev, impact = event or nlp.classify_event(title, summary)
    norm = nlp.normalize(title)
    recent = store.query("SELECT uid,title,published_at,cluster_id FROM items WHERE published_at >= ? AND source=?",
                         ((datetime.fromisoformat(published.replace("Z", "+00:00")) - timedelta(days=2)).isoformat(), source))
    cluster = nlp.find_cluster(norm, published, recent)
    store.upsert("items", {
        "uid": u, "source": source, "kind": kind, "published_at": published, "fetched_at": now(),
        "symbols": ",".join(symbols), "title": title[:400], "summary": (summary or "")[:800], "url": url,
        "event_type": ev, "impact": impact, "sentiment": nlp.sentiment(f"{title}. {summary}"),
        "credibility": nlp.credibility(source, title), "cluster_id": cluster or u,
        "flags": "near_duplicate" if cluster else None, "data": data or {},
        "primary_symbols": ",".join(symbols if source == "sec_edgar" else primary_symbols(title, list(symbols)))}, commit=False)
    return True


# ------------------------------------------------------------ conectores
def alpaca_news(store: IntelStore, client, symbols: list[str], days_back: int = 3, max_pages: int = 40) -> int:
    def run():
        start = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%SZ")
        params = {"symbols": ",".join(symbols), "start": start, "limit": 50, "sort": "desc", "include_content": "false"}
        n, newest = 0, None
        for _ in range(max_pages):
            data = client._request("GET", f"{MARKET_DATA_URL}/v1beta1/news", params=params)
            for a in data.get("news", []):
                newest = max(newest or a["created_at"], a["created_at"])
                syms = [s for s in a.get("symbols", []) if s in symbols] or a.get("symbols", [])[:5]
                n += _add_item(store, key=a["id"], source="alpaca_news", kind="news", published=a["created_at"],
                               title=a.get("headline", ""), summary=a.get("summary", ""), url=a.get("url", ""),
                               symbols=syms, data={"provider": a.get("source"), "author": a.get("author")})
            tok = data.get("next_page_token")
            if not tok:
                break
            params["page_token"] = tok
        store.conn.commit()
        age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(newest.replace("Z", "+00:00"))).total_seconds() / 3600 if newest else None
        fresh = f"última noticia hace {age_h:.1f} h" if age_h is not None else "STALE: sin noticias"
        if age_h is not None and age_h > 72:
            fresh = "STALE: " + fresh
        return n, fresh
    return _guard(store, "alpaca_news", run)


def fed_press(store: IntelStore) -> int:
    def run():
        root = ET.fromstring(http.get_text("https://www.federalreserve.gov/feeds/press_all.xml").lstrip("﻿"))
        n, newest = 0, None
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            pub = parsedate_to_datetime(it.findtext("pubDate")).astimezone(timezone.utc).isoformat()
            newest = max(newest or pub, pub)
            n += _add_item(store, key=it.findtext("guid") or title, source="federal_reserve", kind="official_release",
                           published=pub, title=title, url=(it.findtext("link") or "").strip(),
                           data={"category": it.findtext("category")})
        store.conn.commit()
        return n, f"último comunicado {newest[:10] if newest else '—'}"
    return _guard(store, "federal_reserve", run)


def _ticker_map() -> dict[str, int]:
    p = ROOT / "data" / "sec_company_tickers.json"
    if not p.exists() or (datetime.now().timestamp() - p.stat().st_mtime) > 7 * 86400:
        p.parent.mkdir(exist_ok=True)
        p.write_text(http.get_text("https://www.sec.gov/files/company_tickers.json"))
    return {v["ticker"]: int(v["cik_str"]) for v in json.loads(p.read_text()).values()}


_NAMES: dict[str, list[str]] | None = None
GENERIC = {"inc", "corp", "corporation", "co", "company", "holdings", "group", "the", "platforms", "technologies",
           "international", "ltd", "plc", "trust", "etf", "fund", "class", "com", "de", "del"}
EXTRA_NAMES = {"GOOGL": ["google", "alphabet"], "META": ["meta", "facebook"], "SPY": ["s&p 500", "s&p"], "QQQ": ["nasdaq"],
               "DIA": ["dow"], "IWM": ["russell"], "GLD": ["gold"], "TLT": ["treasur"], "XOM": ["exxon"], "JPM": ["jpmorgan"],
               "UNH": ["unitedhealth"], "NVDA": ["nvidia"], "AMZN": ["amazon"], "MSFT": ["microsoft"], "AAPL": ["apple"]}


def _names() -> dict[str, list[str]]:
    global _NAMES
    if _NAMES is None:
        _NAMES = {k: list(v) for k, v in EXTRA_NAMES.items()}
        try:
            p = ROOT / "data" / "sec_company_tickers.json"
            if p.exists():
                for v in json.loads(p.read_text()).values():
                    words = [w for w in re.findall(r"[a-z0-9&]+", v["title"].lower()) if w not in GENERIC and len(w) > 2]
                    if words:
                        _NAMES.setdefault(v["ticker"], []).append(words[0])
        except (OSError, ValueError):
            pass
    return _NAMES


def primary_symbols(title: str, symbols: list[str]) -> list[str]:
    """Símbolos de los que trata realmente el titular (ticker o nombre presente), no solo etiquetados."""
    t = title.lower()
    out = []
    for s in symbols:
        if re.search(rf"(^|[^a-z]){re.escape(s.lower())}([^a-z]|$)", t) or any(n in t for n in _names().get(s, [])):
            out.append(s)
    return out


def sec_filings(store: IntelStore, symbols: list[str], days_back: int = 30) -> int:
    def run():
        tmap = _ticker_map()
        cutoff = (date.today() - timedelta(days=days_back)).isoformat()
        n = 0
        for sym in symbols:
            cik = tmap.get(sym)
            if not cik:
                continue  # ETFs y fondos no presentan 8-K/10-Q
            sub = http.get_json(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
            r = sub["filings"]["recent"]
            last_periodic = None
            for i, form in enumerate(r["form"]):
                fd = r["filingDate"][i]
                if form in ("10-Q", "10-K") and (last_periodic is None or fd > last_periodic):
                    last_periodic = fd
                if form not in SEC_FORMS or fd < cutoff:
                    continue
                accn = r["accessionNumber"][i]
                items = [x.strip() for x in (r.get("items", [""] * len(r["form"]))[i] or "").split(",") if x.strip()]
                if form == "8-K" and items:
                    main = next((SEC_8K_ITEMS[x] for x in items if x in SEC_8K_ITEMS and SEC_8K_ITEMS[x][1] != "other"),
                                SEC_8K_ITEMS.get(items[0], ("8-K", "other", "low")))
                    title = f"{sym} 8-K: " + "; ".join(SEC_8K_ITEMS.get(x, (x,))[0] for x in items)
                    event = (main[1], main[2])
                elif form in ("10-Q", "10-K"):
                    title, event = f"{sym} {form}: informe periódico ({r['reportDate'][i]})", ("earnings", "high")
                elif form.startswith("424B") or form in ("S-1", "S-3"):
                    # Un folleto 424B/S-3 puede ser de deuda o de acciones: requiere leer el documento antes de concluir dilución
                    title, event = f"{sym} {form}: folleto/registro de valores (deuda o acciones, ver documento)", ("securities_offering", "medium")
                else:
                    title, event = f"{sym} {form}", ("other", "low")
                acc_time = r.get("acceptanceDateTime", [None] * len(r["form"]))[i] or f"{fd}T00:00:00.000Z"
                url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn.replace('-', '')}/{r['primaryDocument'][i]}"
                n += _add_item(store, key=accn, source="sec_edgar", kind="filing", published=acc_time.replace(".000Z", "Z"),
                               title=title, url=url, symbols=[sym], event=event,
                               data={"form": form, "items": items, "accession": accn, "cik": cik})
            if last_periodic:  # estimación (no confirmada) de la próxima publicación de resultados
                est = (date.fromisoformat(last_periodic) + timedelta(days=91)).isoformat()
                store.upsert("events", {"uid": uid("earn_est", sym), "kind": "earnings_estimate", "date": est,
                                        "title": f"{sym}: resultados estimados (~91 días tras el último 10-Q/10-K)",
                                        "source": "sec_edgar (estimación)", "url": "", "data": {"last_periodic": last_periodic}},
                             commit=False)
        store.conn.commit()
        return n, "por eventos (sin calendario fijo)"
    return _guard(store, "sec_edgar", run)


def fred(store: IntelStore) -> int:
    def run():
        n, stale = 0, []
        for sid, (desc, max_age) in FRED_SERIES.items():
            txt = http.get_text("https://fred.stlouisfed.org/graph/fredgraph.csv", params={"id": sid})
            df = pd.read_csv(io.StringIO(txt))
            df.columns = ["date", "value"]
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            df = df.dropna().tail(400)
            for d, v in zip(df["date"], df["value"]):
                k = f"{sid}|{d}"
                if not store.exists("macro", k):
                    store.upsert("macro", {"key": k, "series": sid, "date": d, "value": float(v), "fetched_at": now()},
                                 commit=False, journal=False)
                    n += 1
            if (date.today() - date.fromisoformat(df["date"].iloc[-1])).days > max_age:
                stale.append(f"{sid} ({df['date'].iloc[-1]})")
        store.conn.commit()
        return n, ("STALE: " + ", ".join(stale)) if stale else "todas las series dentro de su periodicidad"
    return _guard(store, "fred", run)


def bls_calendar(store: IntelStore, days_ahead: int = 45) -> int:
    def run():
        txt = http.get_text("https://www.bls.gov/schedule/news_release/bls.ics")
        n, today, upcoming = 0, date.today(), 0
        for block in txt.split("BEGIN:VEVENT")[1:]:
            m = re.search(r"DTSTART;TZID=US-Eastern:(\d{8})T(\d{4})", block)
            s = re.search(r"SUMMARY:(.+)", block)
            if not (m and s):
                continue
            d = datetime.strptime(m.group(1), "%Y%m%d").date()
            title = s.group(1).strip()
            if not any(k in title for k in BLS_KEEP) or not (today - timedelta(days=7) <= d <= today + timedelta(days=days_ahead)):
                continue
            upcoming += d >= today
            store.upsert("events", {"uid": uid("bls", m.group(1), title), "kind": "economic_release", "date": d.isoformat(),
                                    "title": f"{title} ({m.group(2)[:2]}:{m.group(2)[2:]} ET)", "source": "bls",
                                    "url": "https://www.bls.gov/schedule/news_release/"}, commit=False)
            n += 1
        store.conn.commit()
        return n, f"{upcoming} publicaciones próximas" if upcoming else "STALE: calendario sin eventos futuros"
    return _guard(store, "bls_calendar", run)


def alpaca_screener(store: IntelStore, client) -> dict:
    """Movimientos inusuales del mercado (filtra warrants, derechos y acciones de menos de 5 $)."""
    out = {}
    def run():
        mv = client._request("GET", f"{MARKET_DATA_URL}/v1beta1/screener/stocks/movers", params={"top": 50})
        ma = client._request("GET", f"{MARKET_DATA_URL}/v1beta1/screener/stocks/most-actives", params={"top": 50})
        ok = lambda s, p: re.fullmatch(r"[A-Z]{1,5}", s) and p >= 5
        out["gainers"] = [x for x in mv.get("gainers", []) if ok(x["symbol"], x["price"])][:10]
        out["losers"] = [x for x in mv.get("losers", []) if ok(x["symbol"], x["price"])][:10]
        out["most_actives"] = [x for x in ma.get("most_actives", []) if re.fullmatch(r"[A-Z]{1,5}", x["symbol"])][:15]
        out["last_updated"] = mv.get("last_updated")
        return len(out["gainers"]) + len(out["losers"]), f"actualizado {str(mv.get('last_updated'))[:16]}"
    _guard(store, "alpaca_screener", run)
    return out


def flag_contradictions(store: IntelStore, days: int = 3) -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    # Solo hechos/noticias de agencia centradas en 1-2 empresas. La discrepancia entre analistas es divergencia
    # de opiniones (normal), no una contradicción de hechos.
    items = [r for r in store.query("SELECT uid,primary_symbols AS symbols,primary_symbols,event_type,sentiment,published_at,flags FROM items WHERE published_at>=? "
                                    "AND credibility IN ('fact','reported') AND event_type!='analyst_rating'", (since,))
             if r["primary_symbols"] and len(r["primary_symbols"].split(",")) <= 2]
    n = 0
    for a, b, why in nlp.contradictions(items):
        for u, other in ((a, b), (b, a)):
            it = store.get("items", u)
            flags = set(filter(None, (it.get("flags") or "").split(";")))
            tag = f"contradicts:{other}"
            if tag not in flags:
                flags.add(tag); n += 1
                store.upsert("items", {"uid": u, "flags": ";".join(sorted(flags))})
    return n
