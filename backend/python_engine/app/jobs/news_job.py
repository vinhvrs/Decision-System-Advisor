import asyncio
import logging
from threading import Lock

from app.bootstrap.scheduler_config import (
    NEWS_EMBED_BATCH_LIMIT,
    NEWS_EMBED_ENABLED,
    NEWS_SCHEDULE_LOOKBACK_DAYS,
    SYMBOL_INGEST_MODE,
    SYMBOL_INGEST_TOP_N,
)
from app.data_collect.collectors.news_handle import run_daily_update

logger = logging.getLogger(__name__)
_news_lock = Lock()
_embed_lock = Lock()


def run_news_daily_update() -> None:
    if not _news_lock.acquire(blocking=False):
        logger.warning("Daily news update skipped because previous run is still active.")
        return
    try:
        run_daily_update(
            lookback_days=NEWS_SCHEDULE_LOOKBACK_DAYS,
            symbol_scope=SYMBOL_INGEST_MODE,
            top_n=SYMBOL_INGEST_TOP_N,
        )
        logger.info("[Schedule] Daily news update completed.")
    except Exception as e:
        logger.error(f"[Schedule] Daily news update error: {str(e)}", exc_info=True)
    finally:
        _news_lock.release()


def run_news_embed_pipeline() -> None:
    if not NEWS_EMBED_ENABLED:
        return
    if not _embed_lock.acquire(blocking=False):
        logger.warning("News embed+Qdrant skipped because previous run is still active.")
        return
    try:
        from app.pipeline.orchestrator import pipeline_manager

        out = asyncio.run(
            pipeline_manager.embed_unprocessed_knowledge_docs(limit=NEWS_EMBED_BATCH_LIMIT)
        )
        logger.info("[Schedule] News embed+Qdrant completed: %s", out)
    except Exception as e:
        logger.error("[Schedule] News embed+Qdrant error: %s", e, exc_info=True)
    finally:
        _embed_lock.release()

