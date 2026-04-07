"""
Historical backfill entrypoint.

Implementation split across:

- ``app.data_collect.collectors.news_handle`` — GDELT / analysis → ``knowledge_docs`` (when ``NEWS_HANDLE_ENABLED``).
- ``app.data_collect.collectors.stock_sync`` — candles (``DSATurbo``) and Yahoo corporate actions → DB.
"""

import logging

from app.data_collect.collectors.news_handle import run_deep_news_backfill

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    run_deep_news_backfill(limit_year=2018)
