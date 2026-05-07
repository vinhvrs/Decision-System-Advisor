import logging
from threading import Lock

from app.analyze.ranking.stock_compare import MarketSyncService

logger = logging.getLogger(__name__)
_lock = Lock()


def run_ranking_sync() -> None:
    if not _lock.acquire(blocking=False):
        logger.warning("Ranking sync skipped because previous run is still active.")
        return
    try:
        logger.info("[Schedule] Starting ranking sync...")
        MarketSyncService().sync()
        logger.info("[Schedule] Ranking sync completed.")
    except Exception as e:
        logger.error(f"[Schedule] Ranking sync error: {str(e)}", exc_info=True)
    finally:
        _lock.release()

