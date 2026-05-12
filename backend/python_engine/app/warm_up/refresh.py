from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path


def _python_engine_root() -> Path:
    """Directory that contains ``config/settings.py`` (works in Docker and on the host)."""
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        if (d / "config" / "settings.py").is_file():
            return d
    return Path(__file__).resolve().parents[2]


_ROOT = _python_engine_root()
sys.path.insert(0, str(_ROOT))

from app.analyze.dashboard.dashboard import (  # noqa: E402
    REDIS_KEY_DAILY,
    _redis_dashboard_key,
    compute_dashboard,
    push_dashboard_to_redis,
)
from app.warm_up.warm_up import maybe_run_demo_data_sync, run_dashboard_daily_warmup  # noqa: E402
from config.settings import settings  # noqa: E402

logger = logging.getLogger(__name__)


def refresh_redis_and_rebuild(*, limit: int, chart_bars: int, skip_validation: bool) -> tuple[bool, bool, bool]:
    """
    1) Flush all keys in current Redis DB.
    2) Rebuild `dashboard` key.
    3) Rebuild `dashboard:daily` key.

    Returns:
        (flush_ok, dashboard_ok, dashboard_daily_ok)
    """
    r = settings.redis_client()
    flush_ok = bool(r.flushdb())
    logger.info(
        "Redis FLUSHDB ok=%s host=%s port=%s db=%s",
        flush_ok,
        settings.REDIS_HOST,
        settings.REDIS_PORT,
        settings.REDIS_DB,
    )

    maybe_run_demo_data_sync(snapshot_limit=limit)
    dashboard_payload = compute_dashboard(limit=limit)
    dashboard_ok = bool(push_dashboard_to_redis(dashboard_payload))
    logger.info(
        "Rebuilt key=%s rows=%s redis_ok=%s",
        _redis_dashboard_key(),
        len(dashboard_payload.get("rows") or dashboard_payload.get("ranking_board") or []),
        dashboard_ok,
    )

    daily_ok, daily_val_ok, n_rows = run_dashboard_daily_warmup(
        limit=limit,
        chart_bars=chart_bars,
        skip_validation=skip_validation,
        skip_demo_sync=True,
    )
    logger.info(
        "Rebuilt key=%s rows=%s redis_ok=%s validate_ok=%s",
        REDIS_KEY_DAILY,
        n_rows,
        daily_ok,
        daily_val_ok,
    )
    return flush_ok, dashboard_ok, bool(daily_ok)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(
        description="Flush current Redis DB and rebuild dashboard caches from scratch."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Top N symbols by snapshot volume to include (default 20, max 500).",
    )
    parser.add_argument(
        "--chart-bars",
        type=int,
        default=90,
        help="Number of daily closes per row for dashboard:daily chart (default 90, min 2, max 500).",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Push dashboard:daily even if validation fails.",
    )
    args = parser.parse_args()
    limit = max(1, min(500, int(args.limit)))
    chart_bars = max(2, min(500, int(args.chart_bars)))

    flush_ok, dashboard_ok, daily_ok = refresh_redis_and_rebuild(
        limit=limit,
        chart_bars=chart_bars,
        skip_validation=bool(args.skip_validation),
    )
    print(
        "refresh_done "
        f"flush_ok={flush_ok} "
        f"dashboard_ok={dashboard_ok} "
        f"dashboard_daily_ok={daily_ok} "
        f"redis_db={settings.REDIS_DB}"
    )

    if not (flush_ok and dashboard_ok and daily_ok):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
