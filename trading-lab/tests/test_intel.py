import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from trading_lab.intel import fundamentals as fm
from trading_lab.intel import learning, nlp, predictions, sources
from trading_lab.intel.jobs import SCHEDULE
from trading_lab.intel.store import IntelStore, uid
from tests.test_lab import LAB_RISK, FakeClient, synthetic
from trading_lab.config import Allocation, Config
from trading_lab.paper_trader import PaperTrader
from trading_lab.storage import Store


def tmp_store(journal=True):
    d = Path(tempfile.mkdtemp())
    return IntelStore(d / "i.db", d / "j" if journal else None), d


class TestNLP(unittest.TestCase):
    def test_classification(self):
        self.assertEqual(nlp.classify_event("Apple beats estimates as quarterly results top forecasts")[0], "earnings")
        self.assertEqual(nlp.classify_event("Meta Platforms Prices $15 Billion USD Bond Offering")[0], "debt_issuance")
        self.assertEqual(nlp.classify_event("Biotech announces $200M public offering of common stock")[0], "offering_dilution")
        self.assertEqual(nlp.classify_event("Analyst upgrades NVDA, raises price target")[0], "analyst_rating")
        k, imp = nlp.classify_event("Company update", "The firm faces an antitrust probe")
        self.assertEqual((k, imp), ("legal_regulatory", "medium"))  # solo por resumen: impacto rebajado

    def test_sentiment_and_negation(self):
        self.assertGreater(nlp.sentiment("Shares surge after record profit beats estimates"), 0)
        self.assertLess(nlp.sentiment("Stock plunges on weak guidance and lawsuit"), 0)
        self.assertLess(nlp.sentiment("Company did not beat expectations"), 0)

    def test_credibility(self):
        self.assertEqual(nlp.credibility("sec_edgar", "8-K"), "fact")
        self.assertEqual(nlp.credibility("alpaca_news", "Apple reportedly in talks to buy startup"), "rumor")
        self.assertEqual(nlp.credibility("alpaca_news", "Should you buy NVDA now?"), "opinion")
        self.assertEqual(nlp.credibility("alpaca_news", "Microsoft reports quarterly revenue of $92B"), "reported")

    def test_near_duplicate_and_contradiction(self):
        t = "2026-11-04T10:00:00Z"
        recent = [{"uid": "a", "title": "Apple acquires data startup Ascend io", "published_at": t, "cluster_id": "a"}]
        self.assertEqual(nlp.find_cluster(nlp.normalize("Apple Acquires Data Startup Ascend.io"), "2026-11-04T12:00:00Z", recent), "a")
        self.assertIsNone(nlp.find_cluster(nlp.normalize("Apple acquires data startup Ascend io"), "2026-11-09T12:00:00Z", recent))
        items = [{"uid": "x", "symbols": "AAPL", "event_type": "earnings", "sentiment": 0.8, "published_at": t},
                 {"uid": "y", "symbols": "AAPL", "event_type": "earnings", "sentiment": -0.7, "published_at": "2026-11-05T10:00:00Z"}]
        self.assertEqual(len(nlp.contradictions(items)), 1)


class TestStore(unittest.TestCase):
    def test_dedupe_and_replay_with_gzip(self):
        s, d = tmp_store()
        for _ in range(2):
            sources._add_item(s, key="1", source="alpaca_news", kind="news", published="2026-11-04T10:00:00Z",
                              title="Apple beats estimates", symbols=["AAPL"])
        s.conn.commit()
        self.assertEqual(s.query("SELECT COUNT(*) n FROM items")[0]["n"], 1)
        self.assertTrue((d / "j" / "items" / "2026-11.jsonl.gz").exists())
        s2 = IntelStore(d / "other.db", d / "j")
        self.assertEqual(s2.query("SELECT title FROM items")[0]["title"], "Apple beats estimates")

    def test_source_health(self):
        s, _ = tmp_store(False)
        def boom():
            raise RuntimeError("caída")
        for i in range(3):
            sources._guard(s, "x", boom)
        self.assertEqual(s.get("source_health", "x")["status"], "down")
        sources._guard(s, "x", lambda: (5, "ok"))
        h = s.get("source_health", "x")
        self.assertEqual((h["status"], h["consecutive_failures"]), ("ok", 0))


class TestFundamentals(unittest.TestCase):
    def test_ytd_and_non_calendar_fiscal_year(self):
        # Año fiscal oct-sep; el 4º trimestre solo aparece en el anual; el flujo de caja solo como acumulado.
        rev = [{"start": "2025-09-28", "end": "2025-12-27", "val": 100, "filed": "a", "form": "10-Q"},
               {"start": "2025-12-28", "end": "2026-03-28", "val": 110, "filed": "b", "form": "10-Q"},
               {"start": "2026-03-29", "end": "2026-06-27", "val": 120, "filed": "c", "form": "10-Q"},
               {"start": "2025-09-28", "end": "2026-09-26", "val": 460, "filed": "d", "form": "10-K"},
               {"start": "2024-09-29", "end": "2025-09-27", "val": 400, "filed": "z", "form": "10-K"},
               {"start": "2025-06-29", "end": "2025-09-27", "val": 100, "filed": "z", "form": "10-K"}]
        ocf = [{"start": "2025-09-28", "end": "2025-12-27", "val": 30, "filed": "a"},
               {"start": "2025-09-28", "end": "2026-03-28", "val": 70, "filed": "b"},
               {"start": "2025-09-28", "end": "2026-06-27", "val": 100, "filed": "c"},
               {"start": "2025-09-28", "end": "2026-09-26", "val": 150, "filed": "d"}]
        q, _ = fm._series({"Revenues": {"units": {"USD": rev}}}, ["Revenues"])
        self.assertEqual(q["2026-09-26"][0], 130)               # 460 - 100 - 110 - 120
        self.assertEqual(fm._ttm(q), 460)
        q2, _ = fm._series({"OCF": {"units": {"USD": ocf}}}, ["OCF"])
        self.assertEqual([q2[k][0] for k in sorted(q2)], [30, 40, 30, 50])
        self.assertEqual(fm._year_ago(q, "2026-09-26"), 100)

    def test_score_bounds(self):
        sc, why = fm.score({"available": True, "revenue_yoy_pct": 20, "net_margin_pct": 30, "pe_ttm": 80})
        self.assertTrue(-1 <= sc <= 1 and why)
        self.assertEqual(fm.score(None)[0], 0.0)


class FakeVersions:
    def models_for(self, name):
        return [{"label": "v1", "params": {}}]


class TestPredictions(unittest.TestCase):
    def test_make_and_evaluate(self):
        s, _ = tmp_store(False)
        full = synthetic(700)
        bars_then = {"SPY": full.iloc[:-10], "AAPL": full.iloc[:-10] * 1.0}
        n = predictions.make_predictions(s, bars_then, ["AAPL"], FakeVersions(), horizon=5)
        self.assertGreater(n, 0)
        self.assertEqual(predictions.make_predictions(s, bars_then, ["AAPL"], FakeVersions(), horizon=5), 0)  # idempotente
        ev = predictions.evaluate(s, {"SPY": full, "AAPL": full})
        self.assertEqual(ev, n)
        p = s.query("SELECT * FROM predictions WHERE model='naive:always_up'")[0]
        base = full.index[len(full) - 11]
        exp = full["close"].iloc[len(full) - 6] / full["close"].loc[base] - 1
        self.assertAlmostEqual(p["outcome_return"], round(exp, 5))
        self.assertEqual(p["correct"], int(exp > 0))
        st = predictions.stats(s)
        self.assertTrue(st["by_model"])
        self.assertFalse(st["by_model"][0]["enough_data"])

    def test_not_evaluated_before_horizon(self):
        s, _ = tmp_store(False)
        full = synthetic(700)
        predictions.make_predictions(s, {"SPY": full, "AAPL": full}, ["AAPL"], FakeVersions())
        self.assertEqual(predictions.evaluate(s, {"SPY": full, "AAPL": full}), 0)


class TestLearning(unittest.TestCase):
    def test_protections_cannot_be_modified(self):
        with self.assertRaises(learning.ProtectedParameterError):
            learning.validate_params("momentum", {"max_position_pct": 50})
        with self.assertRaises(learning.ProtectedParameterError):
            learning.validate_params("ma_crossover", {"fast": 200, "slow": 50})
        with self.assertRaises(learning.ProtectedParameterError):
            learning.validate_params("momentum", {"lookback": 5000})

    def test_versions_shadow_promote_revert(self):
        s, _ = tmp_store(False)
        v = learning.Versions(s, {"momentum": {"lookback": 126}})
        self.assertEqual(v.active_params("momentum")["lookback"], 126)
        vid = v.propose("momentum", {"lookback": 63, "threshold": 0.0}, {"x": 1})
        self.assertEqual(len(v.models_for("momentum")), 2)
        self.assertEqual(v.active_params("momentum")["lookback"], 126)  # la candidata NO opera
        v.promote(vid)
        self.assertEqual(v.active_params("momentum")["lookback"], 63)
        v.revert("momentum")
        self.assertEqual(v.active_params("momentum")["lookback"], 126)

    def test_walk_forward_runs_out_of_sample(self):
        df = synthetic(1200)
        wf = learning.walk_forward(df, "ma_crossover", {"fast": [10, 20], "slow": [50, 100]}, {"fast": 20, "slow": 100},
                                   {"commission": 0, "slippage_bps": 5})
        self.assertEqual(wf["windows"], (1200 - 504 - 126) // 126 + 1)
        self.assertGreater(wf["walk_forward"]["days"], 0)

    def test_no_change_without_evidence(self):
        s, _ = tmp_store(False)
        v = learning.Versions(s)
        bars = {"SPY": synthetic(1200, seed=3), "QQQ": synthetic(1200, seed=4)}
        rep = learning.run_learning(s, v, bars, ["SPY", "QQQ"], {"momentum": {"lookback": [63, 126]}}, {})
        for name, r in rep["strategies"].items():
            if not r["decision"].startswith("candidata"):
                self.assertEqual(v.production(name)["version"], 1)


class TestScheduleAndVeto(unittest.TestCase):
    def test_schedule(self):
        s, _ = tmp_store(False)
        ny = datetime(2026, 11, 5, 16, 30, tzinfo=timezone(timedelta(hours=-5)))
        self.assertTrue(SCHEDULE["paper_session"](s, ny.astimezone(timezone.utc), ny))
        sat = datetime(2026, 11, 7, 16, 30, tzinfo=timezone(timedelta(hours=-5)))
        self.assertFalse(SCHEDULE["paper_session"](s, sat.astimezone(timezone.utc), sat))
        self.assertTrue(SCHEDULE["learning"](s, sat.astimezone(timezone.utc), sat))
        s.upsert("activity", {"aid": "1", "job": "news", "started_at": ny.astimezone(timezone.utc).isoformat(), "status": "ok"})
        self.assertFalse(SCHEDULE["news"](s, ny.astimezone(timezone.utc) + timedelta(minutes=20), ny))

    def test_news_only_vetoes_entries(self):
        intel, _ = tmp_store(False)
        df = synthetic(400)
        df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].mul(np.linspace(1, 2, 400), axis=0)
        c = FakeClient(df)
        cfg = Config(symbols=["SPY"], data_start="2020-01-01", commission_per_trade=0, slippage_bps=5, train_fraction=0.6,
                     risk=LAB_RISK, allocations=[Allocation("momentum", "SPY", {"lookback": 20})], strategy_grids={},
                     intel={"news_entry_veto": True})
        store = Store(Path(tempfile.mkdtemp()) / "t.db", journal_dir=None)
        sources._add_item(intel, key="k", source="sec_edgar", kind="filing", published=datetime.now(timezone.utc).isoformat(),
                          title="SPY 8-K: Estados financieros no fiables", symbols=["SPY"], event=("accounting_bankruptcy", "high"))
        intel.conn.commit()
        t = PaperTrader(cfg, client=c, store=store, intel=intel)
        t.run_once()
        self.assertEqual(c.submitted, [])
        self.assertEqual(store.rows("decisions")[0]["action"], "blocked_by_news")
        # Una noticia positiva NUNCA provoca una compra por sí misma: sin veto, la compra la decide la estrategia.
        intel2, _ = tmp_store(False)
        t2 = PaperTrader(cfg, client=FakeClient(df), store=Store(Path(tempfile.mkdtemp()) / "u.db", journal_dir=None), intel=intel2)
        t2.run_once()
        self.assertEqual(len(t2.client.submitted), 1)


if __name__ == "__main__":
    unittest.main()
