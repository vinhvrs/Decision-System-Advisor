import asyncio
import logging
from threading import Lock

from app.analyze.analysis_cache import analysis_cache_service
from app.analyze.auto_analyze import auto_analyze_service

logger = logging.getLogger(__name__)
_auto_analyze_lock = Lock()


async def _run_auto_analyze_refresh_async() -> None:
    try:
        symbols = await analysis_cache_service.get_top_symbols_from_ranking(
            ranking_key="liquidity:ranking:daily",
            limit=50,
        )
        if not symbols:
            return
        semaphore = asyncio.Semaphore(5)

        async def process_symbol(symbol: str):
            async with semaphore:
                try:
                    analyzed = await auto_analyze_service.analyze_symbol(
                        symbol=symbol,
                        clean_text=f"Analyze stock {symbol}",
                    )
                    if analyzed and isinstance(analyzed, dict):
                        await analysis_cache_service.set_analysis(symbol, analyzed)
                except Exception as e:
                    logger.error(f"Auto-analyze failed for {symbol}: {e}", exc_info=True)

        await asyncio.gather(*(process_symbol(s) for s in symbols))
    except Exception as e:
        logger.error(f"[Schedule] Auto-analyze refresh error: {e}", exc_info=True)


def run_auto_analyze_refresh() -> None:
    if not _auto_analyze_lock.acquire(blocking=False):
        logger.warning("Auto-analyze refresh skipped because previous run is still active.")
        return
    try:
        asyncio.run(_run_auto_analyze_refresh_async())
    except Exception as e:
        logger.error(f"[Schedule] Auto-analyze refresh error: {str(e)}", exc_info=True)
    finally:
        _auto_analyze_lock.release()


async def warmup_top_stocks() -> None:
    try:
        symbols = await analysis_cache_service.get_top_symbols_from_ranking(
            ranking_key="liquidity:ranking:daily",
            limit=100,
        )
        if not symbols:
            return

        semaphore = asyncio.Semaphore(5)

        async def process_symbol(symbol: str):
            async with semaphore:
                try:
                    cached = await analysis_cache_service.get_analysis(symbol)
                    if cached:
                        return
                    analyzed = await auto_analyze_service.analyze_symbol(
                        symbol=symbol,
                        clean_text=f"Analyze stock {symbol}",
                    )
                    if analyzed and isinstance(analyzed, dict):
                        await analysis_cache_service.set_analysis(symbol, analyzed)
                except Exception as e:
                    logger.error(f"Warmup failed for {symbol}: {e}", exc_info=True)

        await asyncio.gather(*(process_symbol(symbol) for symbol in symbols))
    except Exception as e:
        logger.error(f"Warm-up analysis error: {e}", exc_info=True)

