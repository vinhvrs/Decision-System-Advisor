import uvicorn
import logging
import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.data_collect.collectors.stock_sync import DSATurbo
from app.analyze.ranking.stock_compare import MarketSyncService
from app.analyze.indicator.engine import IndicatorService
from app.services.chatbot import chatbot_service
from app.socket.events import router as websocket_router
from app.api.routes.embed import router as embed_router

from app.analyze.analysis_cache import analysis_cache_service
from app.analyze.auto_analyze import auto_analyze_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_market_pipeline():
    """
    Quy trình tự động hóa toàn diện:
    1. Đồng bộ dữ liệu Yahoo Finance
    2. Cập nhật ranking / heatmap vào Redis
    3. Warmup technical indicators
    """
    logger.info("🚀 [Schedule] Starting Market Pipeline...")
    try:
        sync_service = DSATurbo()
        sync_service.run()

        ranking_service = MarketSyncService()
        ranking_service.sync()

        indicator_service = IndicatorService()
        indicator_service.run_warmup()

        logger.info("✅ [Schedule] Market Pipeline completed successfully.")
    except Exception as e:
        logger.error(f"❌ [Schedule] Pipeline Error: {str(e)}")


async def warmup_top_stocks():
    """
    Warm-up analysis cache:
    - Lấy top 100 stock từ Redis ranking
    - Nếu chưa có cache analysis thì gọi auto_analyze
    - Lưu Redis TTL 3h
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

                    response_payload = analyzed.get("response", {})
                    await analysis_cache_service.set_analysis(symbol, response_payload)

                    logger.info(f"✅ Warmed analysis cache for {symbol}")
                except Exception as e:
                    logger.error(f"❌ Warmup failed for {symbol}: {e}")

        await asyncio.gather(*(process_symbol(symbol) for symbol in symbols))
        logger.info("✅ Warm-up analysis finished")

    except Exception as e:
        logger.error(f"❌ Warm-up analysis error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Quản lý vòng đời hệ thống:
    - start scheduler
    - chạy warm-up cache khi app khởi động
    """
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        run_market_pipeline,
        "interval",
        hours=1,
        next_run_time=datetime.now(),
    )

    scheduler.start()
    logger.info("📅 Background Scheduler started with 1-hour interval.")

    # Chạy warmup nền, không block app start
    asyncio.create_task(warmup_top_stocks())
    logger.info("🔥 Warm-up analysis task created.")

    yield

    scheduler.shutdown()
    logger.info("📅 Background Scheduler shut down.")


app = FastAPI(
    title="Financial AI Analyst API",
    description="Hệ thống phân tích chứng khoán tích hợp Scheduler và Realtime Data",
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
        logger.error(f"Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)