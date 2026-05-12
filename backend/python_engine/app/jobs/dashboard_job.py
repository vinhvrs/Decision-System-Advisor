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
    from config.settings import settings as _settings

    wait_sec = int(getattr(_settings, "DASHBOARD_WARMUP_LOCK_WAIT_SEC", 900) or 0)
    if wait_sec > 0:
        if not _lock.acquire(blocking=True, timeout=wait_sec):
            logger.error(
                "Dashboard warm-up skipped: lock still held after %ss (previous run may be stuck or very slow). "
                "Keep DASHBOARD_WARMUP_RUN_DEMO_SYNC off and rely on stock_job for Yahoo → DB.",
                wait_sec,
            )
            _last_dashboard_warmup = {
                "at": datetime.now(timezone.utc).isoformat(),
                "redis_ok": False,
                "validate_ok": None,
                "row_count": None,
                "redis_key": "dashboard:daily",
                "error": "warm_up_lock_timeout",
            }
            return
    else:
        if not _lock.acquire(blocking=False):
            logger.error(
                "Dashboard warm-up skipped: previous run still active (DASHBOARD_WARMUP_LOCK_WAIT_SEC=0)."
            )
            _last_dashboard_warmup = {
                "at": datetime.now(timezone.utc).isoformat(),
                "redis_ok": False,
                "validate_ok": None,
                "row_count": None,
                "redis_key": "dashboard:daily",
                "error": "warm_up_lock_busy",
            }
            return

    at_start = datetime.now(timezone.utc).isoformat()
    logger.info("[Schedule] dashboard warm-up starting")
    try:
        from config.settings import settings
        from app.warm_up.warm_up import run_dashboard_daily_warmup

        try:
            settings.redis_client().ping()
        except Exception as e:
            logger.error(
                "[Schedule] Redis PING failed before dashboard warm-up (host=%s port=%s db=%s ssl=%s): %s",
                settings.REDIS_HOST,
                settings.REDIS_PORT,
                settings.REDIS_DB,
                getattr(settings, "REDIS_USE_SSL", False),
                e,
                exc_info=True,
            )
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
            err = "payload_validation_issues"
        elif row_count == 0:
            err = "empty_ranking_board"
        _last_dashboard_warmup = {
            "at": datetime.now(timezone.utc).isoformat(),
            "redis_ok": redis_ok,
            "validate_ok": val_ok,
            "row_count": row_count,
            "redis_key": "dashboard:daily",
            "error": err,
        }
        logger.info(
            "[Schedule] dashboard warm-up finished redis_ok=%s validate_ok=%s rows=%s err=%s",
            redis_ok,
            val_ok,
            row_count,
            err,
        )
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

