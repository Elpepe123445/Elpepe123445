"""Punto de entrada: python -m trading_lab <comando>"""
from __future__ import annotations

import argparse
import json
import logging
import sys

from .safety import install_log_redaction


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    install_log_redaction()
    ap = argparse.ArgumentParser(prog="trading_lab", description="AI Trading Research Lab (solo Alpaca Paper Trading)")
    ap.add_argument("--config", default=None)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("verify", help="Verifica conexión y que la cuenta es paper")
    b = sub.add_parser("backtest", help="Backtests + validación fuera de muestra")
    b.add_argument("--refresh", action="store_true", help="Volver a descargar datos")
    p = sub.add_parser("paper", help="Ejecuta el ciclo de paper trading")
    p.add_argument("--loop", action="store_true")
    p.add_argument("--interval", type=int, default=900, help="Segundos entre ciclos")
    d = sub.add_parser("dashboard", help="Servidor web del dashboard")
    d.add_argument("--port", type=int, default=8050)
    d.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args(argv)

    from .alpaca_client import AlpacaPaperClient
    from .config import DEFAULT_CONFIG, load_config

    cfg = load_config(args.config or DEFAULT_CONFIG)

    if args.cmd == "verify":
        c = AlpacaPaperClient()
        acct = c.verify_paper()
        clock = c.get_clock()
        print(json.dumps({"paper_verified": True, "account_prefix": acct["account_number"][:2],
                          "status": acct["status"], "equity": acct["equity"], "cash": acct["cash"],
                          "market_open": clock["is_open"], "next_open": clock["next_open"]}, indent=1))
    elif args.cmd == "backtest":
        from .research import REPORT_PATH, run_research
        rep = run_research(cfg, AlpacaPaperClient(), refresh=args.refresh)
        print("\nRanking (Sharpe fuera de muestra):")
        for r in rep["ranking"]:
            print(f"  {r['strategy']:<20} {r['symbol']:<5} test Sharpe {r['test_sharpe']:>5}  ret {r['test_return_pct']:>7}%  "
                  f"DD {r['test_max_dd_pct']:>6}%  trades {r['test_trades']:>3}  | B&H {r['benchmark_return_pct']:>7}% "
                  f"Sharpe {r['benchmark_sharpe']}")
        for w in rep["global_warnings"]:
            print("AVISO:", w)
        print("Informe:", REPORT_PATH)
    elif args.cmd == "paper":
        from .paper_trader import PaperTrader
        t = PaperTrader(cfg)
        if args.loop:
            t.run_loop(args.interval)
        else:
            print(json.dumps(t.run_once(), indent=1, default=str))
    elif args.cmd == "dashboard":
        from .dashboard.server import serve
        serve(args.host, args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
