from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple


def _python_engine_root() -> Path:
    """Directory that contains ``config/settings.py`` (works in Docker and on the host)."""
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        if (d / "config" / "settings.py").is_file():
            return d
    # Fallback: app/warm_up → …/python_engine
    return Path(__file__).resolve().parents[2]


_ROOT = _python_engine_root()
# Must be first so `import app...` resolves (running `python app/warm_up/warm_up.py` does not set PYTHONPATH).
sys.path.insert(0, str(_ROOT))

from app.analyze.dashboard.dashboard import (  # noqa: E402
    REDIS_KEY_DAILY,
    compute_dashboard_daily,
    push_redis_payload,
    validate_dashboard_daily_payload,
)
from app.config.dsa_tables import table as dsa_table
from config.settings import settings  # noqa: E402

logger = logging.getLogger(__name__)


def maybe_run_demo_data_sync(*, snapshot_limit: int) -> None:
    """
    Optional Yahoo → demo tables before building the dashboard payload.

    Gated by ``DASHBOARD_WARMUP_RUN_DEMO_SYNC`` (default off): running ``DSADemoSync`` on every
    warm-up can take tens of minutes and holds the dashboard job lock, so hourly Redis refreshes
    were skipped and ``dashboard:daily`` TTL never reset.
    """
    if not settings.USE_DEMO_TABLES:
        return
    if not getattr(settings, "DASHBOARD_WARMUP_RUN_DEMO_SYNC", False):
        return
    from app.data_collect.collectors.demo_data_sync import DSADemoSync

    lim = max(1, min(500, int(snapshot_limit)))
    DSADemoSync(
        snapshot_limit=lim,
        history_period=settings.DEMO_SYNC_YF_PERIOD,
    ).run()


def run_dashboard_daily_warmup(
    *,
    limit: int = 100,
    chart_bars: int = 90,
    skip_validation: bool = False,
    skip_demo_sync: bool = False,
) -> Tuple[bool, bool, int]:
    """
    Push ``dashboard:daily`` to Redis (for APScheduler / FastAPI lifespan).

    Returns:
        (redis_set_ok, validation_ok, row_count)
    """
    lim = max(1, min(500, int(limit)))
    cb = max(2, min(500, int(chart_bars)))
    if not skip_demo_sync:
        maybe_run_demo_data_sync(snapshot_limit=lim)
    payload = compute_dashboard_daily(limit=lim, chart_bars=cb)
    rows = payload.get("ranking_board") or payload.get("rows") or []
    row_count = len(rows)
    ok_val, issues = validate_dashboard_daily_payload(payload, chart_bars_max=cb)
    meta = payload.setdefault("meta", {})
    meta["validation_ok"] = ok_val
    meta["validation_issue_count"] = len(issues)
    meta["validation_issues"] = issues[:80]
    if issues:
        for msg in issues:
            (logger.error if not ok_val else logger.warning)("dashboard validate: %s", msg)

    strict = getattr(settings, "DASHBOARD_REDIS_STRICT_VALIDATION", False)
    skip_push = (not ok_val) and strict and (not skip_validation)
    if skip_push:
        pool = dsa_table("instrument_snapshot")
        logger.error(
            "dashboard warm-up skipped Redis SET (DASHBOARD_REDIS_STRICT_VALIDATION=1): rows=%s issues=%s. "
            "If rows=0, ensure `%s` has rows (and OHLC in `%s` when DEV_MODE=dev).",
            row_count,
            len(issues),
            pool,
            dsa_table("instrument_data"),
        )
        return False, False, row_count

    if not ok_val and not skip_validation:
        logger.warning(
            "dashboard validation failed but pushing Redis anyway (strict off): %s issue(s)",
            len(issues),
        )

    meta["redis_set_at"] = datetime.now(timezone.utc).isoformat()
    redis_ok = bool(push_redis_payload(REDIS_KEY_DAILY, payload))
    logger.info(
        "dashboard warm-up key=%s rows=%s redis_ok=%s chart_len min=%s max=%s validate_ok=%s",
        REDIS_KEY_DAILY,
        row_count,
        redis_ok,
        meta.get("chart_length_min"),
        meta.get("chart_length_max"),
        ok_val,
    )
    return redis_ok, ok_val, row_count


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Warm Redis dashboard:daily from DB + analysis keys.")
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Top N symbols by snapshot volume to include (default 100, max 500)",
    )
    parser.add_argument(
        "--chart-bars",
        type=int,
        default=90,
        help="Number of daily closes per row for chart (default 90, min 2 max 500)",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Push even if internal consistency checks fail (not recommended).",
    )
    args = parser.parse_args()
    lim = max(1, min(500, int(args.limit)))
    chart_bars = max(2, min(500, int(args.chart_bars)))
    redis_ok, val_ok, n = run_dashboard_daily_warmup(
        limit=lim,
        chart_bars=chart_bars,
        skip_validation=bool(args.skip_validation),
    )
    if not redis_ok:
        raise SystemExit(1)
    if not val_ok and not args.skip_validation:
        print(
            f"WARNING validation issues but Redis updated (see meta.validation_issues). "
            f"rows={n} validate_ok={val_ok}"
        )
    print(f"Redis key={REDIS_KEY_DAILY} rows={n} validate_ok={val_ok} redis_set_ok={redis_ok}")


if __name__ == "__main__":
    main()
