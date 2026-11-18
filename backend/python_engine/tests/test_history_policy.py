import unittest

from app.data_collect.history_policy import choose_history_fetch_plan


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


if __name__ == "__main__":
    unittest.main()
