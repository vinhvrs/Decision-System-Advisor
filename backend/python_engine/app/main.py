import uvicorn
import logging
import asyncio
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.analyze.ranking.stock_compare import MarketSyncService
from app.services.chatbot import chatbot_service
from app.socket.events import router as websocket_router
from app.api.routes.embed import router as embed_router
from app.analyze.analysis_cache import analysis_cache_service
from app.analyze.auto_analyze import auto_analyze_service
from app.data_collect.collectors.news_handle import run_daily_update
from app.data_collect.collectors.stock_sync import DSATurbo

logger = logging.getLogger(__name__)

# tránh scheduler job chạy chồng nhau
pipeline_lock = Lock()
news_lock = Lock()
stock_sync_lock = Lock()


def run_ranking_sync():
    """
    Lightweight scheduled job:
    - Update ranking / heatmap
    """
    if not pipeline_lock.acquire(blocking=False):
        logger.warning("⚠️ Ranking sync skipped because previous run is still active.")
        return

    try:
        logger.info("🚀 [Schedule] Starting ranking sync...")
        ranking_service = MarketSyncService()
        ranking_service.sync()
        logger.info("✅ [Schedule] Ranking sync completed.")
    except Exception as e:
        logger.error(f"❌ [Schedule] Ranking sync error: {str(e)}", exc_info=True)
    finally:
        pipeline_lock.release()


def run_news_daily_update():
    """
    Heavy scheduled job:
    - Incremental news update
    - Writes docs + inference results
    """
    if not news_lock.acquire(blocking=False):
        logger.warning("⚠️ Daily news update skipped because previous run is still active.")
        return

    try:
        logger.info("🚀 [Schedule] Starting daily news update...")
        run_daily_update(lookback_days=1)
        logger.info("✅ [Schedule] Daily news update completed.")
    except Exception as e:
        logger.error(f"❌ [Schedule] Daily news update error: {str(e)}", exc_info=True)
    finally:
        news_lock.release()


def run_stock_sync():
    """
    Scheduled job:
    - Sync instrument_data (OHLCV) for top symbols from instrument_snapshot
    - Keeps chart data fresh for socket current-candle
    """
    if not stock_sync_lock.acquire(blocking=False):
        logger.warning("⚠️ Stock sync skipped because previous run is still active.")
        return

    try:
        logger.info("🚀 [Schedule] Starting stock sync...")
        turbo = DSATurbo()
        turbo.run()
        logger.info("✅ [Schedule] Stock sync completed.")
    except Exception as e:
        logger.error(f"❌ [Schedule] Stock sync error: {str(e)}", exc_info=True)
    finally:
        stock_sync_lock.release()


async def warmup_top_stocks():
    """
    Warm-up analysis cache:
    - Get top 100 symbols from ranking
    - If cache missing, call auto_analyze
    - Save final payload into Redis
    """
    try:
        symbols = await analysis_cache_service.get_top_symbols_from_ranking(
            ranking_key="liquidity:ranking:daily",
            limit=100,
        )

        if not symbols:
            logger.warning("⚠️ No symbols found from liquidity:ranking:daily")
            return

        logger.info(f"🔥 Warm-up analysis started for {len(symbols)} symbols")

        semaphore = asyncio.Semaphore(5)

        async def process_symbol(symbol: str):
            async with semaphore:
                try:
                    cached = await analysis_cache_service.get_analysis(symbol)
                    if cached:
                        logger.info(f"⏩ Skip cached analysis for {symbol}")
                        return

                    analyzed = await auto_analyze_service.analyze_symbol(
                        symbol=symbol,
                        clean_text=f"Analyze stock {symbol}",
                    )

                    if not analyzed or not isinstance(analyzed, dict):
                        logger.warning(f"⚠️ Invalid analysis payload for {symbol}")
                        return

                    success = await analysis_cache_service.set_analysis(symbol, analyzed)
                    if success:
                        logger.info(f"✅ Warmed analysis cache for {symbol}")
                    else:
                        logger.error(f"❌ Failed to save warmed cache for {symbol}")

                except Exception as e:
                    logger.error(f"❌ Warmup failed for {symbol}: {e}", exc_info=True)

        await asyncio.gather(*(process_symbol(symbol) for symbol in symbols))
        logger.info("✅ Warm-up analysis finished")

    except Exception as e:
        logger.error(f"❌ Warm-up analysis error: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    App lifecycle:
    - start scheduler
    - run warmup task on startup
    """
    scheduler = BackgroundScheduler()

    # 1) ranking sync mỗi giờ
    scheduler.add_job(
        run_ranking_sync,
        trigger="interval",
        hours=1,
        id="ranking_sync",
        next_run_time=datetime.now(),
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # 2) daily news update mỗi ngày
    scheduler.add_job(
        run_news_daily_update,
        trigger="interval",
        hours=24,
        id="news_daily_update",
        next_run_time=datetime.now(),
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    # 3) stock sync mỗi giờ (instrument_data for charts)
    scheduler.add_job(
        run_stock_sync,
        trigger="interval",
        hours=1,
        id="stock_sync",
        next_run_time=datetime.now(),
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.start()
    logger.info("📅 Background Scheduler started (ranking_sync, news_daily_update, stock_sync).")

    # warmup nền khi app khởi động
    asyncio.create_task(warmup_top_stocks())
    logger.info("🔥 Warm-up analysis task created.")

    yield

    scheduler.shutdown()
    logger.info("📅 Background Scheduler shut down.")


app = FastAPI(
    title="Financial AI Analyst API",
    description="Stock analysis system with scheduling and real-time support",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(websocket_router)
app.include_router(embed_router)


class ChatRequest(BaseModel):
    message: str
    style: Optional[str] = "standard"


@app.get("/")
async def root():
    return {
        "status": "online",
        "version": "2.1.0",
        "service": "Financial AI Analyst",
    }


@app.post("/api/v1/chat")
async def chat_endpoint(payload: ChatRequest):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        result = await chatbot_service.handle_message(
            user_text=payload.message,
            style=payload.style,
        )
        return result
    except Exception as e:
        logger.error(f"Chat Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
