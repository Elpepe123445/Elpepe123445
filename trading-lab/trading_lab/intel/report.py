"""Informe diario de Market Intelligence (markdown + datos), guardado en memoria y en el diario."""
from __future__ import annotations

import json
from datetime import date, timedelta

from .market import SECTORS
from .store import JOURNAL, IntelStore, now, uid


def _f(x, suf=""):
    return "—" if x is None else f"{x}{suf}"


def build(store: IntelStore, ctx: dict) -> tuple[str, dict]:
    ov, mac, news = ctx["overview"], ctx["macro"], ctx["news"]
    d = ov.get("as_of") or date.today().isoformat()
    L = [f"# Market Intelligence — {d}", "", f"_Generado {now()} · Solo investigación: nada de este informe ejecuta órdenes._", ""]
    L += ["## Resumen del mercado", "",
          f"- **Régimen** (SPY vs SMA200 × volatilidad): **{_f(ov.get('regime'))}** desde {_f(ov.get('regime_since'))}.",
          f"- **Amplitud**: {_f(ov.get('breadth_above_sma50_pct'), '%')} de la lista de seguimiento sobre su SMA50."]
    for s, sn in ov.get("indices", {}).items():
        L.append(f"- **{s}** {sn['close']} · 1d {sn['ret_1d_pct']:+}% · 5d {sn['ret_5d_pct']:+}% · 20d {sn['ret_20d_pct']:+}% · "
                 f"RSI {sn['rsi14']} · vol. 20d {sn['vol20_ann_pct']}% (percentil 1a {_f(sn['vol_percentile_1y'])})")
    L += ["", "## Macro (FRED, datos oficiales)", ""]
    for k, v in mac["series"].items():
        L.append(f"- {k}: " + ", ".join(f"{a}={b}" for a, b in v.items()))
    L += [f"- _{n}_" for n in mac["notes"]]
    L += ["", "## Próximos eventos", ""]
    ev = ctx.get("events", [])
    L += [f"- {e['date']} · {e['title']} · fuente: {e['source']}" for e in ev] or ["- Sin eventos registrados."]
    L += ["", "## Sectores (20 sesiones)", "", "| ETF | Sector | 1d | 5d | 20d | Vol. rel. | Tendencia |", "|---|---|---|---|---|---|---|"]
    L += [f"| {s['etf']} | {s['sector']} | {s['ret_1d_pct']:+} | {s['ret_5d_pct']:+} | {s['ret_20d_pct']:+} | {s['volume_ratio20']} | {s['trend50']} |"
          for s in ov.get("sectors", [])]
    L += ["", "## Movimientos inusuales (lista de seguimiento)", ""]
    L += [f"- **{u['symbol']}**: " + "; ".join(u["reasons"]) for u in ov.get("unusual", [])] or ["- Ninguno."]
    sc = ctx.get("screener") or {}
    if sc.get("gainers") or sc.get("losers"):
        L += ["", "**Mercado amplio (Alpaca screener, acciones ≥ 5 $):** "
              + "subidas: " + ", ".join(f"{x['symbol']} {x['percent_change']:+.1f}%" for x in sc.get("gainers", [])[:6])
              + " · caídas: " + ", ".join(f"{x['symbol']} {x['percent_change']:+.1f}%" for x in sc.get("losers", [])[:6])]
    L += ["", "## Noticias importantes y su relevancia", ""]
    if not news:
        L.append("- Sin noticias de impacto alto/medio confirmadas en las últimas 36 h.")
    for n in news:
        rx = n.get("reaction") or {}
        L.append(f"- **[{n['event_type']} · {n['impact']} · {n['credibility']}]** {n['title']} "
                 f"({n['published_at'][:16]}Z, {n['source']}) — sentimiento {n['sentiment']:+}"
                 + (f" · reacción {rx.get('reaction_pct')}% (exceso {rx.get('excess_reaction_pct')}%), {rx.get('assessment')}" if rx.get("assessment") else
                    f" · {rx.get('status')}" if rx else "")
                 + (f"\n  - Para valorar su importancia: {n['follow_up']}" if n.get("follow_up") else "")
                 + (f"\n  - ⚠ Contradicción con otra noticia" if "contradicts" in (n.get("flags") or "") else "")
                 + (f"\n  - Fuente: {n['url']}" if n.get("url") else ""))
    br = ctx.get("base_rates") or {}
    if br:
        L += ["", "## Eventos similares (estudio de eventos, exceso vs SPY a 5 sesiones)", "",
              "| Evento | n | Exceso medio | % positivos | ¿Muestra suficiente? |", "|---|---|---|---|---|"]
        L += [f"| {k} | {v['n']} | {v['mean_excess_5d_pct']:+}% | {v['pct_positive']}% | {'sí' if v['reliable'] else 'no (<30)'} |"
              for k, v in br.items()]
    ps = ctx.get("prediction_stats") or {}
    L += ["", "## Predicciones: registradas vs resultados reales", "",
          f"Nuevas hoy: {ctx.get('new_predictions', 0)} · evaluadas hoy: {ctx.get('evaluated', 0)} · "
          f"total evaluadas: {ps.get('evaluated', 0)} · pendientes: {ps.get('pending', '—')}", ""]
    if ps.get("by_model"):
        L += ["| Modelo | n | Acierto | Retorno medio | Exceso medio | Brier | ¿Datos suficientes? |", "|---|---|---|---|---|---|---|"]
        L += [f"| {m['label']} | {m['n']} | {m['hit_rate_pct']}% | {m['mean_return_pct']}% | {_f(m['mean_excess_pct'], '%')} | {_f(m['brier'])} | "
              f"{'sí' if m['enough_data'] else 'no'} |" for m in ps["by_model"]]
    else:
        L.append(ps.get("note", ""))
    L += ["", "## Estado de las fuentes", "", "| Fuente | Estado | Último éxito | Frescura | Error |", "|---|---|---|---|---|"]
    L += [f"| {s['source']} | {s['status']} | {_f(s['last_success'])} | {_f(s['freshness'])} | {_f(s['last_error'])} |"
          for s in store.query("SELECT * FROM source_health ORDER BY source")]
    L += ["", "_Las predicciones y puntuaciones son experimentales. Con pocas observaciones no permiten conclusiones._"]
    md = "\n".join(L)
    data = {k: v for k, v in ctx.items() if k != "bars"}
    store.upsert("reports", {"rid": uid("daily", d), "date": d, "kind": "daily", "created_at": now(), "markdown": md,
                             "data": json.loads(json.dumps(data, default=str))})
    if JOURNAL:
        p = JOURNAL / "reports"
        p.mkdir(parents=True, exist_ok=True)
        (p / f"{d}.md").write_text(md)
    return md, data
