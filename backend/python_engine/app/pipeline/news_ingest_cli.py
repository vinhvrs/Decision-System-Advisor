"""
Operator CLI: historical news backfill, then rely on data-engine APScheduler for day-to-day.

Usage (from ``backend/python_engine``):

  # 1) One-time GDELT history (set NEWS_HANDLE_ENABLED before process starts — we set it below)
  python news_ingest.py backfill --limit-year 2018

  # 2) Rolling window + Yahoo RSS + corporate actions (same as scheduled job)
  python news_ingest.py daily --lookback-days 14

  # RSS + corporate only (no GDELT), no env required
  python news_ingest.py rss

Symbol universe follows SYMBOL_INGEST_MODE / SYMBOL_INGEST_TOP_N (same as scheduler).
"""
from __future__ import annotations

import argparse
import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="News ingest: GDELT backfill, daily window, or RSS-only.")
    sub = p.add_subparsers(dest="command", required=True)

    pb = sub.add_parser("backfill", help="GDELT + corporate history back to --limit-year (needs outbound HTTPS).")
    pb.add_argument("--limit-year", type=int, default=2018, help="Earliest calendar year to pull (default 2018).")
    pb.add_argument(
        "--symbol-scope",
        default=None,
        choices=("all", "top_snapshot"),
        help="Override SYMBOL_INGEST_MODE for this run.",
    )
    pb.add_argument("--top-n", type=int, default=None, help="Override SYMBOL_INGEST_TOP_N.")

    pd = sub.add_parser("daily", help="Corporate + optional GDELT window + Yahoo RSS (matches scheduled news job).")
    pd.add_argument("--lookback-days", type=int, default=7, help="GDELT window width (default 7).")
    pd.add_argument("--no-gdelt", action="store_true", help="Do not set NEWS_HANDLE_ENABLED (RSS + corporate only).")
    pd.add_argument("--symbol-scope", default=None, choices=("all", "top_snapshot"))
    pd.add_argument("--top-n", type=int, default=None)

    pr = sub.add_parser("rss", help="Yahoo Finance RSS crawl only (no GDELT, no corporate loop).")

    args = p.parse_args(argv)

    if args.command == "backfill":
        os.environ["NEWS_HANDLE_ENABLED"] = "1"
    elif args.command == "daily" and not args.no_gdelt:
        os.environ["NEWS_HANDLE_ENABLED"] = "1"

    # Import after env so ``news_handle.NEWS_HANDLE_ENABLED`` snapshot is correct.
    if args.command == "rss":
        from app.data_collect.collectors.news_crawler import run_yahoo_rss_crawl

        out = run_yahoo_rss_crawl()
        logger.info("Yahoo RSS finished: %s", out)
        return 0

    from app.data_collect.collectors import news_handle
    from app.data_collect.collectors.news_handle import run_daily_update, run_deep_news_backfill

    scope = getattr(args, "symbol_scope", None)
    top_n = getattr(args, "top_n", None)

    if args.command == "backfill":
        if not news_handle.NEWS_HANDLE_ENABLED:
            logger.error("NEWS_HANDLE_ENABLED is false after import; set env before starting Python.")
            return 1
        logger.info("Starting deep GDELT backfill (limit_year=%s)...", args.limit_year)
        run_deep_news_backfill(limit_year=args.limit_year, symbol_scope=scope, top_n=top_n)
        logger.info("Backfill finished.")
        return 0

    if args.command == "daily":
        logger.info("Starting daily news ingest (lookback_days=%s)...", args.lookback_days)
        run_daily_update(
            lookback_days=max(1, int(args.lookback_days)),
            symbol_scope=scope,
            top_n=top_n,
        )
        logger.info("Daily ingest finished.")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
