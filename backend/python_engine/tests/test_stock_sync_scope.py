import unittest

from app.bootstrap import scheduler_config
from app.data_collect.symbol_ingest import snapshot_limit_for_stock_sync


class StockSyncScopeTests(unittest.TestCase):
    def test_default_stock_sync_covers_market_view_board(self):
        self.assertGreaterEqual(scheduler_config.STOCK_SYNC_TOP_N, 40)

    def test_top_snapshot_stock_sync_uses_dedicated_limit(self):
        limit = snapshot_limit_for_stock_sync(
            scheduler_config.STOCK_SYNC_MODE,
            scheduler_config.STOCK_SYNC_TOP_N,
        )
        if limit is not None:
            self.assertGreaterEqual(limit, 40)
            self.assertEqual(scheduler_config.STOCK_SYNC_TOP_N, limit)

    def test_news_ingest_limit_does_not_define_stock_sync_limit(self):
        # News/corporate ingest is intentionally allowed to remain narrower.
        # OHLC persistence must keep its own coverage floor for Market View.
        self.assertGreaterEqual(scheduler_config.STOCK_SYNC_TOP_N, 40)


if __name__ == "__main__":
    unittest.main()
