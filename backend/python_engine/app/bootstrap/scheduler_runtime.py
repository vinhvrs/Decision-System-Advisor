import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.events import EVENT_JOB_ERROR
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from app.bootstrap.logging_setup import setup_engine_file_log
from app.bootstrap.scheduler_config import (
    DASHBOARD_BLOCKING_STARTUP_WARMUP,
    DASHBOARD_REDIS_MIN_TTL_SEC,
    DASHBOARD_REDIS_WATCHDOG_ENABLED,
    DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC,
    DASHBOARD_STARTUP_WARMUP_SEC,
    DASHBOARD_WARM_UP_BOOTSTRAP_SEC,
    DASHBOARD_WARM_UP_INTERVAL_HOURS,
    DASHBOARD_WARM_UP_INTERVAL_MINUTES,
    NEWS_EMBED_BATCH_LIMIT,
    NEWS_EMBED_ENABLED,
    NEWS_EMBED_INTERVAL_HOURS,
    NEWS_INTERVAL_HOURS,
    NEWS_INTERVAL_RAW,
    NEWS_SCHEDULE_LOOKBACK_DAYS,
    RANKING_SYNC_INTERVAL_HOURS,
    SCHEDULE_INTERVAL_HOURS,
    SCHEDULER_MISFIRE_GRACE_SEC,
)
from app.jobs.analysis_job import run_auto_analyze_refresh, warmup_top_stocks
from app.jobs.dashboard_job import get_last_dashboard_warmup, run_dashboard_warm_up
from app.jobs.news_job import run_news_daily_update, run_news_embed_pipeline
from app.jobs.ranking_job import run_ranking_sync
from app.jobs.stock_job import run_stock_sync
from config.settings import settings

logger = logging.getLogger(__name__)


async def _dashboard_redis_keepalive_runner(stop: asyncio.Event) -> None:
    try:
        await _dashboard_redis_keepalive(stop)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("[dashboard keepalive] background task crashed")


async def _dashboard_redis_keepalive(stop: asyncio.Event) -> None:
    """
    After server start, warm Redis once quickly, then (unless disabled) poll TTL and
    re-run warm-up if ``dashboard:daily`` is missing or close to expiry — complementary
    to the hourly APScheduler job.
    """
    from app.analyze.dashboard.dashboard import redis_dashboard_daily_ttl_seconds

    await asyncio.sleep(max(0.0, float(DASHBOARD_STARTUP_WARMUP_SEC)))
    if stop.is_set():
        return
    loop = asyncio.get_running_loop()
    logger.info(
        "[dashboard keepalive] startup warm-up (delay=%ss)",
        DASHBOARD_STARTUP_WARMUP_SEC,
    )
    await loop.run_in_executor(None, run_dashboard_warm_up)

    if not DASHBOARD_REDIS_WATCHDOG_ENABLED:
        return

    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=float(DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC))
            return
        except asyncio.TimeoutError:
            pass
        if stop.is_set():
            return
        try:
            ttl = redis_dashboard_daily_ttl_seconds()
            missing_or_err = ttl is None or ttl == -2
            low_ttl = ttl is not None and ttl >= 0 and ttl < int(DASHBOARD_REDIS_MIN_TTL_SEC)
            if missing_or_err or low_ttl:
                logger.info(
                    "[dashboard keepalive] ttl=%s min_ttl=%ss — running warm-up",
                    ttl,
                    DASHBOARD_REDIS_MIN_TTL_SEC,
                )
                await loop.run_in_executor(None, run_dashboard_warm_up)
        except Exception as e:
            logger.warning("[dashboard keepalive] check failed: %s", e, exc_info=True)


def _scheduler_error_listener(event):
    if event.exception:
        logger.error(
            "[Schedule] Job %s failed: %s",
            event.job_id,
            event.exception,
            exc_info=event.exception,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_engine_file_log()
    scheduler = BackgroundScheduler(
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": SCHEDULER_MISFIRE_GRACE_SEC,
        }
    )
    scheduler.add_listener(_scheduler_error_listener, EVENT_JOB_ERROR)

    interval_h = SCHEDULE_INTERVAL_HOURS
    base = datetime.now()
    stagger = [
        ("ranking_sync", timedelta(minutes=0)),
        ("stock_sync", timedelta(minutes=4)),
        ("auto_analyze_refresh", timedelta(minutes=6)),
    ]

    scheduler.add_job(
        run_ranking_sync,
        trigger="interval",
        hours=RANKING_SYNC_INTERVAL_HOURS,
        id="ranking_sync",
        next_run_time=base + dict(stagger)["ranking_sync"],
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    # First dashboard warm-up soon after process up (do not stagger 3+ minutes — looks "broken").
    try:
        _first_sec = max(2, int(os.environ.get("DASHBOARD_SCHEDULER_FIRST_DELAY_SEC", "8")))
    except ValueError:
        _first_sec = 8
    _dashboard_first = datetime.now() + timedelta(seconds=_first_sec)
    scheduler.add_job(
        run_dashboard_warm_up,
        trigger="interval",
        minutes=DASHBOARD_WARM_UP_INTERVAL_MINUTES,
        id="dashboard_warm_up",
        next_run_time=_dashboard_first,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    news_first_run_at = datetime.now()
    scheduler.add_job(
        run_news_daily_update,
        trigger="interval",
        hours=NEWS_INTERVAL_HOURS,
        id="news_daily_update",
        next_run_time=news_first_run_at,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    embed_first_at = news_first_run_at + timedelta(minutes=10)
    if NEWS_EMBED_ENABLED:
        scheduler.add_job(
            run_news_embed_pipeline,
            trigger="interval",
            hours=NEWS_EMBED_INTERVAL_HOURS,
            id="news_embed_qdrant",
            next_run_time=embed_first_at,
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )
    scheduler.add_job(
        run_stock_sync,
        trigger="interval",
        hours=interval_h,
        id="stock_sync",
        next_run_time=base + dict(stagger)["stock_sync"],
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        run_auto_analyze_refresh,
        trigger="interval",
        hours=interval_h,
        id="auto_analyze_refresh",
        next_run_time=base + dict(stagger)["auto_analyze_refresh"],
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.start()
    app.state.scheduler = scheduler

    if DASHBOARD_BLOCKING_STARTUP_WARMUP:
        try:
            logger.info("[Schedule] blocking startup dashboard warm-up (before traffic)...")
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, run_dashboard_warm_up)
            logger.info("[Schedule] blocking startup dashboard warm-up finished")
        except Exception:
            logger.exception("[Schedule] blocking startup dashboard warm-up failed")

    try:
        du = scheduler.get_job("dashboard_warm_up")
        logger.info(
            "[Schedule] APScheduler running; dashboard_warm_up every %s min, next_run=%s",
            DASHBOARD_WARM_UP_INTERVAL_MINUTES,
            du.next_run_time.isoformat() if du and du.next_run_time else None,
        )
    except Exception as e:
        logger.warning("[Schedule] could not log dashboard job: %s", e)

    keepalive_stop = asyncio.Event()
    app.state.dashboard_keepalive_stop = keepalive_stop
    app.state.dashboard_keepalive_task = asyncio.create_task(
        _dashboard_redis_keepalive_runner(keepalive_stop)
    )

    if DASHBOARD_WARM_UP_BOOTSTRAP_SEC > 0:
        bootstrap_warm = datetime.now() + timedelta(seconds=int(DASHBOARD_WARM_UP_BOOTSTRAP_SEC))
        scheduler.add_job(
            run_dashboard_warm_up,
            trigger="date",
            run_date=bootstrap_warm,
            id="dashboard_warm_up_bootstrap",
            replace_existing=True,
        )

    asyncio.create_task(warmup_top_stocks())

    yield

    keepalive_stop.set()
    kt = getattr(app.state, "dashboard_keepalive_task", None)
    if kt:
        kt.cancel()
        try:
            await kt
        except asyncio.CancelledError:
            pass

    scheduler.shutdown(wait=True)


def build_scheduler_health_payload(scheduler) -> dict:
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append(
            {
                "id": job.id,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
        )
    return {
        "ok": True,
        "running": scheduler.running,
        "news_lookback_days": NEWS_SCHEDULE_LOOKBACK_DAYS,
        "news_interval_hours": NEWS_INTERVAL_HOURS,
        "news_interval_hours_env": NEWS_INTERVAL_RAW or None,
        "news_embed_enabled": NEWS_EMBED_ENABLED,
        "news_embed_interval_hours": NEWS_EMBED_INTERVAL_HOURS,
        "news_embed_batch_limit": NEWS_EMBED_BATCH_LIMIT,
        "dashboard_warm_up_last": get_last_dashboard_warmup() or None,
        "dashboard_keepalive": {
            "blocking_startup_warmup": DASHBOARD_BLOCKING_STARTUP_WARMUP,
            "startup_delay_sec": DASHBOARD_STARTUP_WARMUP_SEC,
            "redis_watchdog_enabled": DASHBOARD_REDIS_WATCHDOG_ENABLED,
            "redis_watchdog_interval_sec": DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC,
            "redis_min_ttl_refresh_sec": DASHBOARD_REDIS_MIN_TTL_SEC,
            "warm_up_interval_minutes": DASHBOARD_WARM_UP_INTERVAL_MINUTES,
            "warm_up_interval_hours": DASHBOARD_WARM_UP_INTERVAL_HOURS,
            "warmup_run_demo_sync": settings.DASHBOARD_WARMUP_RUN_DEMO_SYNC,
        },
        "jobs": jobs,
    }

