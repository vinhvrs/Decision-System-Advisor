import logging
from threading import Lock

from app.bootstrap.scheduler_config import SYMBOL_INGEST_MODE, SYMBOL_INGEST_TOP_N
from app.data_collect.collectors.demo_data_sync import DSADemoSync
from app.data_collect.collectors.stock_sync import DSATurbo
from app.data_collect.symbol_ingest import snapshot_limit_for_stock_sync
from config.settings import settings
from app.storage.snapshot_update import run_snapshot_update

logger = logging.getLogger(__name__)
_stock_sync_lock = Lock()
_snapshot_update_lock = Lock()


def run_snapshot_tables_update() -> None:
    if not _snapshot_update_lock.acquire(blocking=False):
        logger.warning("Snapshot update skipped because previous run is still active.")
        return
    try:
        out = run_snapshot_update(symbol_scope=SYMBOL_INGEST_MODE, top_n=SYMBOL_INGEST_TOP_N)
        logger.info("[Schedule] Snapshot tables update completed: %s", out)
    except Exception as e:
        logger.error("[Schedule] Snapshot tables update error: %s", e, exc_info=True)
    finally:
        _snapshot_update_lock.release()


def run_stock_sync() -> None:
    if not _stock_sync_lock.acquire(blocking=False):
        logger.warning("Stock sync skipped because previous run is still active.")
        return
    try:
        lim = snapshot_limit_for_stock_sync(SYMBOL_INGEST_MODE, SYMBOL_INGEST_TOP_N)
        if settings.DASHBOARD_USE_DEMO:
            DSADemoSync(
                snapshot_limit=lim,
                history_period=settings.DEMO_SYNC_YF_PERIOD,
            ).run()
        else:
            DSATurbo(snapshot_limit=lim).run()
        run_snapshot_tables_update()
        logger.info("[Schedule] Stock sync completed.")
    except Exception as e:
        logger.error(f"[Schedule] Stock sync error: {str(e)}", exc_info=True)
    finally:
        _stock_sync_lock.release()

