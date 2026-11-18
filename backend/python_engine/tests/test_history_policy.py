import unittest

from app.data_collect.history_policy import choose_history_fetch_plan, prioritize_by_history_coverage


class HistoryFetchPolicyTests(unittest.TestCase):
    def test_manual_backfill_wins(self):
        plan = choose_history_fetch_plan(
            existing_daily_bars=500,
            backfill_days=30,
            history_period="7d",
            bootstrap_min_bars=180,
            bootstrap_days=3650,
        )
        self.assertEqual("manual", plan.mode)
        self.assertEqual(30, plan.days)
        self.assertIsNone(plan.period)

    def test_undercovered_symbol_gets_long_bootstrap(self):
        plan = choose_history_fetch_plan(
            existing_daily_bars=12,
            backfill_days=None,
            history_period="7d",
            bootstrap_min_bars=180,
            bootstrap_days=3650,
        )
        self.assertEqual("bootstrap", plan.mode)
        self.assertEqual(3650, plan.days)
        self.assertIsNone(plan.period)

    def test_covered_symbol_uses_short_incremental_window(self):
        plan = choose_history_fetch_plan(
            existing_daily_bars=180,
            backfill_days=None,
            history_period="7d",
            bootstrap_min_bars=180,
            bootstrap_days=3650,
        )
        self.assertEqual("incremental", plan.mode)
        self.assertIsNone(plan.days)
        self.assertEqual("7d", plan.period)


    def test_least_covered_symbols_are_processed_first(self):
        instruments = [
            {"id": "a", "symbol": "AAA"},
            {"id": "b", "symbol": "BBB"},
            {"id": "c", "symbol": "CCC"},
            {"id": "d", "symbol": "DDD"},
        ]
        ordered = prioritize_by_history_coverage(
            instruments,
            {"a": 180, "b": 0, "c": 35, "d": 180},
        )
        self.assertEqual(["BBB", "CCC", "AAA", "DDD"], [row["symbol"] for row in ordered])

    def test_explicit_symbol_order_is_preserved(self):
        instruments = [
            {"id": "a", "symbol": "AAA"},
            {"id": "b", "symbol": "BBB"},
        ]
        ordered = prioritize_by_history_coverage(
            instruments,
            {"a": 180, "b": 0},
            preserve_input_order=True,
        )
        self.assertEqual(["AAA", "BBB"], [row["symbol"] for row in ordered])



if __name__ == "__main__":
    unittest.main()
