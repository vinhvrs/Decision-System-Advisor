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
    DASHBOARD_WARM_UP_INTERVAL_HOURS,
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

logger = logging.getLogger(__name__)


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
        ("dashboard_warm_up", timedelta(minutes=3)),
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
    scheduler.add_job(
        run_dashboard_warm_up,
        trigger="interval",
        hours=DASHBOARD_WARM_UP_INTERVAL_HOURS,
        id="dashboard_warm_up",
        next_run_time=base + dict(stagger)["dashboard_warm_up"],
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

    bootstrap_warm = datetime.now() + timedelta(
        seconds=int(os.environ.get("DASHBOARD_WARM_UP_BOOTSTRAP_SEC", "120"))
    )
    scheduler.add_job(
        run_dashboard_warm_up,
        trigger="date",
        run_date=bootstrap_warm,
        id="dashboard_warm_up_bootstrap",
        replace_existing=True,
    )
    asyncio.create_task(warmup_top_stocks())

    yield

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
        "jobs": jobs,
    }

