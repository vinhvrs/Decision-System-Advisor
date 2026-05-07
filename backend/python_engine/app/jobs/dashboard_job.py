import logging
from datetime import datetime, timezone
from threading import Lock

from app.bootstrap.scheduler_config import WARM_UP_CHART_BARS, WARM_UP_LIMIT

logger = logging.getLogger(__name__)
_lock = Lock()
_last_dashboard_warmup: dict = {}


def get_last_dashboard_warmup() -> dict:
    return _last_dashboard_warmup


def run_dashboard_warm_up() -> None:
    global _last_dashboard_warmup
    if not _lock.acquire(blocking=False):
        logger.warning("Dashboard warm-up skipped because previous run is still active.")
        return
    at_start = datetime.now(timezone.utc).isoformat()
    try:
        from config.settings import settings
        from app.warm_up.warm_up import run_dashboard_daily_warmup

        try:
            settings.redis_client().ping()
        except Exception as e:
            logger.error("[Schedule] Redis PING failed before dashboard warm-up: %s", e, exc_info=True)
            _last_dashboard_warmup = {
                "at": at_start,
                "redis_ok": False,
                "validate_ok": None,
                "row_count": None,
                "redis_key": "dashboard:daily",
                "error": f"redis_ping:{e!s}",
            }
            return

        redis_ok, val_ok, row_count = run_dashboard_daily_warmup(
            limit=WARM_UP_LIMIT,
            chart_bars=WARM_UP_CHART_BARS,
            skip_validation=False,
        )
        err = None
        if not redis_ok:
            err = "redis_set_failed"
        elif not val_ok:
            err = "validation_failed"
        elif row_count == 0:
            err = "empty_snapshot_run_ranking_sync_first"
        _last_dashboard_warmup = {
            "at": datetime.now(timezone.utc).isoformat(),
            "redis_ok": redis_ok,
            "validate_ok": val_ok,
            "row_count": row_count,
            "redis_key": "dashboard:daily",
            "error": err,
        }
    except Exception as e:
        logger.error("[Schedule] Dashboard warm-up error: %s", e, exc_info=True)
        _last_dashboard_warmup = {
            "at": datetime.now(timezone.utc).isoformat(),
            "redis_ok": False,
            "validate_ok": None,
            "row_count": None,
            "redis_key": "dashboard:daily",
            "error": str(e),
        }
    finally:
        _lock.release()

