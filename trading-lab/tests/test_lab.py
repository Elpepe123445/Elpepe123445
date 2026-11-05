import json
import logging
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import pandas as pd

from trading_lab import indicators as ind
from trading_lab import strategies
from trading_lab.alpaca_client import AlpacaError, AlpacaPaperClient
from trading_lab.backtest import buy_and_hold, compute_metrics, optimize_and_validate, run_backtest
from trading_lab.config import Allocation, Config, ConfigError, RiskLimits, load_config
from trading_lab.paper_trader import PaperTrader, client_order_id
from trading_lab.risk import RiskManager
from trading_lab.safety import (PAPER_TRADING_URL, PaperTradingVerificationError, SecretRedactingFilter,
                                assert_paper_url, check_base_url_env, verify_paper_account)
from trading_lab.storage import Store

RISK = RiskLimits(max_position_pct=10, max_total_exposure_pct=50, max_daily_loss_pct=2,
                  max_drawdown_pct=10, max_orders_per_day=10, min_cash_reserve_pct=20)
LAB_RISK = RiskLimits(max_position_pct=3, max_total_exposure_pct=10, max_daily_loss_pct=1,
                      max_drawdown_pct=3, max_orders_per_day=10, min_cash_reserve_pct=20,
                      position_stop_loss_pct=8, stop_cooldown_days=5)


def synthetic(n=800, seed=1):
    rng = np.random.default_rng(seed)
    close = 100 * np.exp(np.cumsum(rng.normal(0.0004, 0.012, n)))
    open_ = close * (1 + rng.normal(0, 0.003, n))
    idx = pd.bdate_range("2020-01-01", periods=n)
    return pd.DataFrame({"open": open_, "high": np.maximum(open_, close) * 1.005,
                         "low": np.minimum(open_, close) * 0.995, "close": close,
                         "volume": rng.integers(1e5, 1e6, n).astype(float)}, index=idx)


class TestSafety(unittest.TestCase):
    def test_rejects_non_paper_account(self):
        with self.assertRaises(PaperTradingVerificationError):
            verify_paper_account({"account_number": "123456", "status": "ACTIVE"})

    def test_rejects_blocked_or_inactive(self):
        with self.assertRaises(PaperTradingVerificationError):
            verify_paper_account({"account_number": "PA1", "status": "ACTIVE", "trading_blocked": True})
        with self.assertRaises(PaperTradingVerificationError):
            verify_paper_account({"account_number": "PA1", "status": "SUBMITTED"})

    def test_accepts_paper(self):
        verify_paper_account({"account_number": "PA3XYZ", "status": "ACTIVE"})

    def test_live_base_url_env_rejected(self):
        with mock.patch.dict(os.environ, {"APCA_API_BASE_URL": "https://api.alpaca.markets"}):
            with self.assertRaises(PaperTradingVerificationError):
                check_base_url_env()

    def test_only_paper_url(self):
        assert_paper_url(PAPER_TRADING_URL + "/v2/orders")
        for bad in ("https://api.alpaca.markets/v2/orders", "https://paper-api.alpaca.markets.evil.com/v2"):
            with self.assertRaises(PaperTradingVerificationError):
                assert_paper_url(bad)

    def test_order_blocked_without_verification(self):
        with mock.patch.dict(os.environ, {"ALPACA_API_KEY": "kkkkkkkk", "ALPACA_SECRET_KEY": "ssssssss"}):
            c = AlpacaPaperClient(session=mock.MagicMock())
            with self.assertRaises(PaperTradingVerificationError):
                c.submit_order("SPY", 1, "buy", "x")
            self.assertNotIn("kkkkkkkk", repr(c))

    def test_missing_credentials(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(PaperTradingVerificationError):
                AlpacaPaperClient()

    def test_secret_redaction(self):
        f = SecretRedactingFilter(["SUPERSECRET123"])
        rec = logging.LogRecord("x", logging.INFO, "", 0, "key=%s", ("SUPERSECRET123",), None)
        f.filter(rec)
        self.assertNotIn("SUPERSECRET123", rec.getMessage())


class TestConfig(unittest.TestCase):
    def _write(self, d):
        p = Path(tempfile.mkdtemp()) / "c.json"
        p.write_text(json.dumps(d))
        return p

    def base(self):
        return {"symbols": ["SPY"], "risk": dict(RISK.__dict__), "paper_allocations": []}

    def test_repo_config_valid(self):
        load_config()

    def test_risk_required(self):
        d = self.base(); d.pop("risk")
        with self.assertRaises(ConfigError):
            load_config(self._write(d))

    def test_live_keys_forbidden(self):
        d = self.base(); d["live_trading"] = True
        with self.assertRaises(ConfigError):
            load_config(self._write(d))

    def test_no_leverage(self):
        d = self.base(); d["risk"]["max_total_exposure_pct"] = 100; d["risk"]["min_cash_reserve_pct"] = 10
        with self.assertRaises(ConfigError):
            load_config(self._write(d))

    def test_duplicate_symbol_allocation(self):
        d = self.base()
        d["paper_allocations"] = [{"strategy": "momentum", "symbol": "SPY"}, {"strategy": "breakout", "symbol": "SPY"}]
        with self.assertRaises(ConfigError):
            load_config(self._write(d))


class TestIndicators(unittest.TestCase):
    def test_sma_and_rsi_bounds(self):
        df = synthetic()
        self.assertAlmostEqual(ind.sma(df.close, 5).iloc[10], df.close.iloc[6:11].mean())
        r = ind.rsi(df.close).dropna()
        self.assertTrue(((r >= 0) & (r <= 100)).all())
        self.assertEqual(ind.rsi(pd.Series(np.arange(1, 40, dtype=float))).iloc[-1], 100.0)

    def test_indicators_are_causal(self):
        df = synthetic()
        t = 500
        for f in (lambda d: ind.rsi(d.close), lambda d: ind.macd(d.close)["hist"],
                  lambda d: ind.volatility(d.close), lambda d: ind.trend(d.close), lambda d: ind.atr(d)):
            self.assertAlmostEqual(f(df).iloc[t], f(df.iloc[: t + 1]).iloc[t], places=9)


class TestStrategies(unittest.TestCase):
    def test_no_lookahead_all_strategies(self):
        """La señal en t debe ser idéntica tanto si existen datos posteriores como si no."""
        df = synthetic(900)
        for name, s in strategies.STRATEGIES.items():
            full = s.signals(df)
            for t in (300, 450, 700):
                self.assertEqual(full.iloc[t], s.signals(df.iloc[: t + 1]).iloc[t], f"{name} usa datos futuros en t={t}")

    def test_long_only(self):
        df = synthetic()
        for s in strategies.STRATEGIES.values():
            sig = s.signals(df)
            self.assertTrue(sig.isin([0.0, 1.0]).all())

    def test_hypotheses_documented(self):
        for s in strategies.STRATEGIES.values():
            self.assertGreater(len(s.hypothesis), 40)


class TestBacktest(unittest.TestCase):
    def test_executes_at_next_open(self):
        idx = pd.bdate_range("2021-01-01", periods=5)
        df = pd.DataFrame({"open": [10, 20, 30, 40, 50], "high": [99] * 5, "low": [1] * 5,
                           "close": [11, 21, 31, 41, 51], "volume": [1] * 5}, index=idx, dtype=float)
        tgt = pd.Series([1, 0, 0, 0, 0], index=idx, dtype=float)  # señal al cierre del día 0
        r = run_backtest(df, tgt, capital=1000, slippage_bps=0)
        t = r.trades.iloc[0]
        self.assertEqual(t.entry_date, idx[1]); self.assertEqual(t.entry_price, 20)   # apertura día 1
        self.assertEqual(t.exit_date, idx[2]); self.assertEqual(t.exit_price, 30)     # apertura día 2
        self.assertAlmostEqual(r.equity.iloc[-1], 1500)

    def test_costs_reduce_returns(self):
        df = synthetic()
        sig = strategies.get("macd_trend").signals(df)
        free = run_backtest(df, sig, slippage_bps=0).metrics["total_return_pct"]
        costly = run_backtest(df, sig, commission=1, slippage_bps=10)
        self.assertLess(costly.metrics["total_return_pct"], free)
        self.assertGreater(costly.metrics["costs"], 0)

    def test_metrics(self):
        eq = pd.Series([100, 120, 90, 110], index=pd.bdate_range("2021-01-01", periods=4), dtype=float)
        tr = pd.DataFrame({"pnl": [10, -5, 20], "return_pct": [1, -0.5, 2]})
        m = compute_metrics(eq, tr)
        self.assertAlmostEqual(m["max_drawdown_pct"], -25.0)
        self.assertEqual(m["profit_factor"], 6.0)
        self.assertAlmostEqual(m["win_rate_pct"], 66.7)
        self.assertEqual(m["num_trades"], 3)

    def test_train_test_separation(self):
        df = synthetic(900)
        r = optimize_and_validate(df, strategies.get("ma_crossover"), {"fast": [10, 20], "slow": [50, 100]}, 0.6, {})
        self.assertLess(pd.Timestamp(r["train"]["end"]), pd.Timestamp(r["test"]["start"]))
        self.assertIn("warnings", r)
        self.assertGreaterEqual(buy_and_hold(df).metrics["num_trades"], 1)


class TestRisk(unittest.TestCase):
    def setUp(self):
        self.rm = RiskManager(RISK)

    def test_position_limit(self):
        d = self.rm.size_buy(price=100, equity=100_000, cash=100_000, current_exposure=0, symbol_exposure=0, orders_today=0)
        self.assertTrue(d.allowed)
        self.assertLessEqual(d.qty * 100, 10_000)

    def test_cash_only_no_margin(self):
        d = self.rm.size_buy(price=100, equity=100_000, cash=20_500, current_exposure=0, symbol_exposure=0, orders_today=0)
        self.assertLessEqual(d.qty * 100, 500)

    def test_exposure_and_order_limits(self):
        self.assertFalse(self.rm.size_buy(100, 100_000, 60_000, 50_000, 0, 0).allowed)
        self.assertFalse(self.rm.size_buy(100, 100_000, 100_000, 0, 0, 10).allowed)

    def test_circuit_breakers(self):
        self.assertIsNotNone(self.rm.circuit_breaker(97_000, 100_000, 100_000))
        self.assertIsNotNone(self.rm.circuit_breaker(89_000, 89_500, 100_000))
        self.assertIsNone(self.rm.circuit_breaker(99_500, 100_000, 100_000))

    def test_never_short(self):
        self.assertFalse(self.rm.size_sell(0, 0).allowed)
        self.assertEqual(self.rm.size_sell(7.6, 0).qty, 7)

    def test_requires_limits(self):
        with self.assertRaises(ValueError):
            RiskManager(None)


class FakeClient:
    """Imita la API de Alpaca paper (con estado) para probar el ciclo sin red."""

    def __init__(self, df, account_number="PA123"):
        self.df, self.acct_no, self.submitted, self.verified = df, account_number, [], False
        self.reject = False
        self.positions, self.open_orders, self.cancelled = [], [], []
        self.show_open = True
        self.calendar_last = str(df.index[-1].date())

    def verify_paper(self):
        a = {"account_number": self.acct_no, "status": "ACTIVE", "equity": "100000", "cash": "100000",
             "last_equity": "100000", "long_market_value": "0"}
        verify_paper_account(a)
        self.verified = True
        return a

    def get_clock(self): return {"is_open": False}
    def get_calendar(self, start, end): return [{"date": self.calendar_last, "open": "09:30", "close": "16:00"}]
    def get_positions(self): return self.positions
    def get_orders(self, status="open", limit=100): return list(self.open_orders) if self.show_open else []

    def cancel_order(self, oid):
        assert self.verified
        self.cancelled.append(oid)
        self.open_orders = [o for o in self.open_orders if o["id"] != oid]

    def get_order_by_client_id(self, coid):
        for o in self.submitted:
            if o["client_order_id"] == coid:
                return {**o, "status": "canceled" if o["id"] in self.cancelled else o["status"]}
        return None

    def get_bars(self, symbol, start, **kw):
        return [{"t": d.strftime("%Y-%m-%dT05:00:00Z"), "o": r.open, "h": r.high, "l": r.low, "c": r.close, "v": r.volume}
                for d, r in self.df.iterrows()]

    def submit_order(self, symbol, qty, side, client_order_id):
        assert self.verified
        if self.reject:
            raise AlpacaError(403, "insufficient buying power")
        o = {"id": f"id{len(self.submitted)}", "status": "accepted", "client_order_id": client_order_id,
             "symbol": symbol, "side": side, "qty": str(qty)}
        self.submitted.append(o)
        self.open_orders.append(o)
        return o


class TestPaperTrader(unittest.TestCase):
    def make(self, client, risk=LAB_RISK):
        cfg = Config(symbols=["SPY"], data_start="2020-01-01", commission_per_trade=0, slippage_bps=5,
                     train_fraction=0.6, risk=risk, allocations=[Allocation("momentum", "SPY", {"lookback": 20})],
                     strategy_grids={})
        store = Store(Path(tempfile.mkdtemp()) / "t.sqlite3", journal_dir=None)
        return PaperTrader(cfg, client=client, store=store), store

    def uptrend(self, n=400, down=False):
        df = synthetic(n)
        f = np.linspace(2, 1, n) if down else np.linspace(1, 2, n)
        df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].mul(f, axis=0)
        return df

    def price(self, c):
        return float(c.df.close.iloc[-1])

    def test_buy_sized_to_lab_limits(self):
        c = FakeClient(self.uptrend())
        t, _ = self.make(c)
        t.run_once()
        self.assertEqual(len(c.submitted), 1)
        self.assertLessEqual(int(c.submitted[0]["qty"]) * self.price(c), 3_000)  # 3 % de 100k

    def test_pending_order_not_duplicated(self):
        c = FakeClient(self.uptrend())
        t, store = self.make(c)
        t.run_once(); t.run_once()
        self.assertEqual(len(c.submitted), 1)
        self.assertIn("pendiente", store.rows("decisions")[0]["reason"])

    def test_duplicate_by_client_order_id(self):
        c = FakeClient(self.uptrend()); c.show_open = False
        t, store = self.make(c)
        t.run_once(); t.run_once()
        self.assertEqual(len(c.submitted), 1)
        self.assertTrue(any(d["action"] == "duplicate_skipped" for d in store.rows("decisions")))

    def test_oversized_pending_order_cancelled_and_resized(self):
        c = FakeClient(self.uptrend())
        coid = client_order_id("momentum", "SPY", c.calendar_last, "buy")
        c.verified = True; c.submit_order("SPY", 1000, "buy", coid); c.verified = False
        t, store = self.make(c)
        s = t.run_once()
        self.assertEqual(c.cancelled, ["id0"])
        self.assertEqual(s["cancelled"], [coid])
        self.assertEqual(c.submitted[-1]["client_order_id"], coid + "-r2")
        self.assertLessEqual(int(c.submitted[-1]["qty"]) * self.price(c), 3_000)

    def test_stop_loss_and_cooldown(self):
        c = FakeClient(self.uptrend())
        c.positions = [{"symbol": "SPY", "qty": "10", "market_value": str(10 * self.price(c)), "unrealized_plpc": "-0.10"}]
        t, store = self.make(c)
        t.run_once()
        self.assertEqual(c.submitted[-1]["side"], "sell")
        self.assertEqual(store.rows("decisions")[0]["action"], "sell_stop_loss")
        c.positions, c.open_orders = [], []          # la venta se ejecutó
        t.run_once()                                  # la señal sigue en 1, pero hay enfriamiento
        self.assertEqual(len(c.submitted), 1)
        self.assertIn("Enfriamiento", store.rows("decisions")[0]["reason"])

    def test_trim_oversized_position(self):
        c = FakeClient(self.uptrend())
        px = self.price(c)
        c.positions = [{"symbol": "SPY", "qty": "100", "market_value": str(100 * px), "unrealized_plpc": "0.01"}]
        t, store = self.make(c)
        t.run_once()
        o = c.submitted[-1]
        self.assertEqual(o["side"], "sell")
        self.assertLessEqual((100 - int(o["qty"])) * px, 3_000 + px)
        self.assertEqual(store.rows("decisions")[0]["action"], "sell_trim")

    def test_stale_data_blocks_trading(self):
        c = FakeClient(self.uptrend()); c.calendar_last = str((c.df.index[-1] + pd.Timedelta(days=3)).date())
        t, store = self.make(c)
        t.run_once()
        self.assertEqual(c.submitted, [])
        self.assertEqual(store.rows("decisions")[0]["action"], "stale_data")

    def test_exit_on_signal_zero(self):
        c = FakeClient(self.uptrend(down=True))
        c.positions = [{"symbol": "SPY", "qty": "5", "market_value": str(5 * self.price(c)), "unrealized_plpc": "-0.01"}]
        t, store = self.make(c)
        t.run_once()
        self.assertEqual((c.submitted[-1]["side"], c.submitted[-1]["qty"]), ("sell", "5"))

    def test_blocks_non_paper_account(self):
        c = FakeClient(self.uptrend(), account_number="999")
        t, store = self.make(c)
        s = t.run_once()
        self.assertIsNotNone(s["blocked"])
        self.assertEqual(c.submitted, [])
        self.assertEqual(len(store.rows("errors")), 1)

    def test_rejected_order_logged(self):
        c = FakeClient(self.uptrend()); c.reject = True
        t, store = self.make(c)
        t.run_once()
        self.assertEqual(store.rows("orders")[0]["status"], "rejected")

    def test_journal_rebuilds_db(self):
        j = Path(tempfile.mkdtemp())
        s1 = Store(j / "a.sqlite3", journal_dir=j)
        s1.decision("momentum", "SPY", "2026-01-02", 1.0, 0, "buy", "test", 10.0)
        s1.order("lab-x", "momentum", "SPY", "buy", 3, "accepted", "id1", ref_price=10.0)
        s1.order("lab-x", status="filled", filled_qty=3, filled_avg_price=10.1)
        s2 = Store(j / "b.sqlite3", journal_dir=j)
        self.assertEqual(s2.rows("decisions")[0]["reason"], "test")
        o = s2.get_order("lab-x")
        self.assertEqual((o["status"], o["filled_avg_price"], o["ref_price"]), ("filled", 10.1, 10.0))


if __name__ == "__main__":
    unittest.main()
