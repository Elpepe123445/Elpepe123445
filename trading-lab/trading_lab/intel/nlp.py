"""Análisis de texto de noticias basado en reglas transparentes.

Es deliberadamente simple y auditable: un léxico financiero pequeño y patrones.
No está validado como predictor; su puntuación NUNCA genera órdenes por sí sola.
"""
from __future__ import annotations

import re
from datetime import datetime

EVENT_RULES: list[tuple[str, str, list[str]]] = [
    # (tipo, impacto potencial, patrones)
    ("earnings", "high", [r"\bearnings\b", r"quarterly results", r"\b(q[1-4]|first|second|third|fourth)[- ]quarter\b.*\b(results|revenue|eps)\b", r"\beps\b", r"beats? (estimates|expectations)", r"miss(es)? (estimates|expectations)"]),
    ("guidance", "high", [r"\bguidance\b", r"\boutlook\b", r"raises? (forecast|outlook)", r"cuts? (forecast|outlook)", r"\bforecast\b"]),
    ("m_and_a", "high", [r"\bacquir(e|es|ed|ing|ition)\b", r"\bmerger\b", r"\btakeover\b", r"\bbuyout\b", r"to buy .* for \$"]),
    ("debt_issuance", "medium", [r"\bbond (offering|sale|deal)\b", r"\bnotes? offering\b", r"\bdebt (offering|sale)\b", r"bond-?denominated", r"\bbonds?\b.*\b(prices?|launch(es)?)\b"]),
    ("offering_dilution", "high", [r"\b(stock|share|equity|secondary|public) offering\b", r"\bdilution\b", r"\bshare sale\b",
                                    r"convertible notes", r"at-the-market", r"\bto sell .* shares\b"]),
    ("legal_regulatory", "high", [r"\blawsuit\b", r"\bsues?\b", r"\bprobe\b", r"\binvestigation\b", r"\bantitrust\b", r"\bfined?\b", r"\bsec charges\b", r"\bsettle(s|ment)\b", r"\brecall\b"]),
    ("accounting_bankruptcy", "high", [r"\brestat(e|ement)\b", r"non-reliance", r"\bbankruptcy\b", r"chapter 11", r"going concern", r"\bdelist"]),
    ("central_bank", "high", [r"\bfomc\b", r"federal reserve", r"\bfed\b", r"interest rate", r"rate (cut|hike)", r"monetary policy", r"\becb\b"]),
    ("macro_data", "medium", [r"\bcpi\b", r"inflation", r"\bjobs report\b", r"nonfarm", r"payrolls", r"unemployment", r"\bgdp\b", r"\bpce\b", r"retail sales"]),
    ("analyst_rating", "medium", [r"\bupgrade[sd]?\b", r"\bdowngrade[sd]?\b", r"price target", r"\binitiat(es|ed) coverage\b", r"\boutperform\b", r"\bunderperform\b", r"overweight", r"underweight"]),
    ("capital_return", "medium", [r"\bbuyback\b", r"repurchase", r"\bdividend\b", r"stock split"]),
    ("management", "medium", [r"\bceo\b.*\b(steps down|resigns|appointed|named)\b", r"\bcfo\b.*\b(steps down|resigns|appointed|named)\b", r"\bresign"]),
    ("product_business", "low", [r"\blaunch(es|ed)?\b", r"\bunveil", r"\bpartnership\b", r"\bcontract\b", r"\bdeal\b", r"\bannounces?\b"]),
]
POS = set("beat beats surge surges soar soars jump jumps rally rallies gain gains record raise raises raised upgrade upgraded "
          "outperform strong stronger growth profit profitable exceed exceeds exceeded approval approved wins win "
          "accelerate accelerates expansion bullish rebound boost boosts tops top".split())
NEG = set("miss misses missed plunge plunges plummet plummets drop drops fall falls fell slump slumps cut cuts downgrade "
          "downgraded underperform weak weaker loss losses decline declines lawsuit probe investigation fine fined "
          "recall bankruptcy restatement layoffs warning warns bearish delay delayed halt halts concern concerns "
          "slowdown dilution sues fraud".split())
NEGATORS = {"not", "no", "never", "without", "fails", "failed"}
RUMOR = [r"\breportedly\b", r"\bsources? (say|said)\b", r"people familiar", r"\brumou?r", r"\bspeculat", r"\bin talks\b",
         r"\bconsidering\b", r"\bexplor(es|ing) (a )?sale\b", r"\bcould\b", r"\bunconfirmed\b", r"\bwsj reports?\b"]
OPINION = [r"\banalyst", r"\bprice target\b", r"\bupgrade", r"\bdowngrade", r"\bshould you\b", r"\bis it time\b",
           r"\bwhy\b", r"\btop \d+\b", r"\bbest\b.*\bstocks?\b", r"\bopinion\b", r"\bpreview\b", r"\bwhat to expect\b",
           r"\?$", r"\bbull(ish)? case\b", r"\bbear(ish)? case\b"]
OFFICIAL_SOURCES = {"sec_edgar", "federal_reserve", "bls", "fred"}


def _match(t: str) -> tuple[str, str]:
    for kind, impact, pats in EVENT_RULES:
        if any(re.search(p, t) for p in pats):
            return kind, impact
    return "other", "low"


DOWN = {"high": "medium", "medium": "low", "low": "low"}


def classify_event(title: str, summary: str = "") -> tuple[str, str]:
    """Clasifica por el titular; si no hay coincidencia, por el resumen con impacto rebajado un nivel."""
    k, imp = _match(title.lower())
    if k == "other" and summary:
        k, imp = _match(summary.lower())
        imp = DOWN[imp]
    return k, imp


def sentiment(text: str) -> float:
    """Puntuación en [-1, 1] = (pos - neg) / total de palabras con carga; maneja negaciones simples."""
    words = re.findall(r"[a-z']+", text.lower())
    pos = neg = 0
    for i, w in enumerate(words):
        flip = any(x in NEGATORS for x in words[max(0, i - 3):i])
        if w in POS:
            neg, pos = (neg + 1, pos) if flip else (neg, pos + 1)
        elif w in NEG:
            pos, neg = (pos + 1, neg) if flip else (pos, neg + 1)
    tot = pos + neg
    return round((pos - neg) / tot, 3) if tot else 0.0


def credibility(source: str, title: str) -> str:
    """'fact' (fuente oficial o dato confirmado), 'opinion' o 'rumor'."""
    if source in OFFICIAL_SOURCES:
        return "fact"
    t = title.lower().strip()
    if any(re.search(p, t) for p in RUMOR):
        return "rumor"
    if any(re.search(p, t) for p in OPINION):
        return "opinion"
    # Noticia de agencia sin marcadores de opinión/rumor: hecho reportado (no verificado por fuente primaria)
    return "reported"


def normalize(title: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", title.lower()))


def jaccard(a: str, b: str) -> float:
    sa, sb = set(a.split()), set(b.split())
    return len(sa & sb) / len(sa | sb) if sa and sb else 0.0


def find_cluster(norm_title: str, published: str, recent: list[dict], threshold: float = 0.7) -> str | None:
    """Devuelve el cluster de una noticia casi idéntica publicada en las 48 h anteriores."""
    try:
        t0 = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except ValueError:
        return None
    for r in recent:
        try:
            t1 = datetime.fromisoformat(r["published_at"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue
        if abs((t0 - t1).total_seconds()) <= 48 * 3600 and jaccard(norm_title, normalize(r["title"])) >= threshold:
            return r.get("cluster_id") or r["uid"]
    return None


def contradictions(items: list[dict], min_abs: float = 0.4) -> list[tuple[str, str, str]]:
    """Pares (uid_a, uid_b, motivo) del mismo símbolo y tipo de evento con sentimiento opuesto en 72 h."""
    out = []
    by_key: dict[tuple, list[dict]] = {}
    for it in items:
        for s in (it.get("symbols") or "").split(","):
            if s and it["event_type"] != "other":
                by_key.setdefault((s, it["event_type"]), []).append(it)
    for (sym, ev), lst in by_key.items():
        lst = sorted(lst, key=lambda x: x["published_at"])
        for i, a in enumerate(lst):
            for b in lst[i + 1:]:
                ta = datetime.fromisoformat(a["published_at"].replace("Z", "+00:00"))
                tb = datetime.fromisoformat(b["published_at"].replace("Z", "+00:00"))
                if (tb - ta).total_seconds() > 72 * 3600:
                    break
                if a["sentiment"] * b["sentiment"] < 0 and min(abs(a["sentiment"]), abs(b["sentiment"])) >= min_abs:
                    out.append((a["uid"], b["uid"], f"{sym}/{ev}: sentimiento opuesto ({a['sentiment']} vs {b['sentiment']})"))
    return out
