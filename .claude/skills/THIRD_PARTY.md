# Skills de terceros

Origen: https://github.com/tradermonty/claude-trading-skills (licencia MIT, ver LICENSE-claude-trading-skills)
Commit: d8e71ce2f0b069eb5b6fca352857c168c35e6c46 · instaladas el 2026-11-05
Instaladas sin las carpetas de tests. Revisadas antes de instalar: ninguna envía órdenes ni contiene instrucciones ocultas.
Red: market-breadth-analyzer, uptrend-analyzer y sector-analyst descargan CSV públicos del autor
(tradermonty.github.io / raw.githubusercontent.com/tradermonty/uptrend-dashboard). Son datos de un tercero, no oficiales.

Instaladas: backtest-expert data-quality-checker market-news-analyst sector-analyst market-environment-analysis market-breadth-analyzer uptrend-analyzer us-stock-analysis us-market-bubble-detector scenario-analyzer position-sizer pre-trade-discipline-gate residual-edge-analyzer trade-hypothesis-ideator trade-performance-coach

No instaladas a propósito:
- Necesitan clave de pago o registro (FMP, Finviz Elite, FXMacroData): canslim, earnings-calendar, economic-calendar-fetcher,
  technical-analyst, macro-regime-detector, vcp-screener, pead-screener, theme-detector, etc.
- Incompatibles con las reglas del laboratorio (solo paper, solo largo, sin derivados): parabolic-short-trade-planner,
  options-strategy-advisor, futures-position-sizer, mt5-robot-tester, crypto-regime-analyzer,
  portfolio-manager (contempla el endpoint de dinero real de Alpaca).
- Meta-skills para generar o revisar skills.
