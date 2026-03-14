import uvicorn
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime

# Import APScheduler
from apscheduler.schedulers.background import BackgroundScheduler

# Import các Service và Router từ hệ thống
from app.data_collect.collectors.stock_sync import DSATurbo
from app.analyze.ranking.stock_compare import MarketSyncService
from app.analyze.indicator.engine import IndicatorService
from app.services.chatbot import chatbot_service
from app.socket.events import router as websocket_router
from app.api.routes.embed import router as embed_router

# Cấu hình Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# =========================================================
# SCHEDULED TASKS LOGIC (Quy trình tự động hóa)
# =========================================================
def run_market_pipeline():
    """
    Quy trình tự động hóa toàn diện:
    1. Đồng bộ dữ liệu yfinance (Backfill 7 ngày)
    2. Cập nhật Ranking & Heatmap vào Redis
    3. Tính toán các chỉ số kỹ thuật (Warmup RSI, MACD...) cho Top mã
    """
    logger.info("🚀 [Schedule] Starting Market Pipeline...")
    try:
        # Bước 1: Đồng bộ nến giá từ Yahoo Finance
        sync_service = DSATurbo()
        sync_service.run()
        
        # Bước 2: Xếp hạng thanh khoản và cập nhật bản đồ nhiệt
        ranking_service = MarketSyncService()
        ranking_service.sync()
        
        # Bước 3: Tính toán chỉ số kỹ thuật cho Top 20 mã giao dịch
        indicator_service = IndicatorService()
        indicator_service.run_warmup()
        
        logger.info("✅ [Schedule] Market Pipeline completed successfully.")
    except Exception as e:
        logger.error(f"❌ [Schedule] Pipeline Error: {str(e)}")

# =========================================================
# LIFESPAN MANAGEMENT (Quản lý vòng đời App)
# =========================================================
#@asynccontextmanager
#async def lifespan(app: FastAPI):
#    """Quản lý khởi tạo và giải phóng tài nguyên hệ thống"""
    # Khởi tạo Scheduler
#    scheduler = BackgroundScheduler()
    
    # Thiết lập chạy Pipeline mỗi 1 giờ
    # next_run_time=datetime.now() đảm bảo chạy ngay lập tức khi start container
#    scheduler.add_job(
#        run_market_pipeline, 
#        'interval', 
#        hours=1, 
        # next_run_time=datetime.now() 
#    )
    
#    scheduler.start()
#    logger.info("📅 Background Scheduler started with 1-hour interval.")
    
#    yield # Ứng dụng hoạt động tại đây
    
    # Tắt Scheduler khi đóng ứng dụng
#    scheduler.shutdown()
#    logger.info("📅 Background Scheduler shut down.")

# =========================================================
# FASTAPI APP SETUP
# =========================================================
app = FastAPI(
    title="Financial AI Analyst API",
    description="Hệ thống phân tích chứng khoán tích hợp Scheduler và Realtime Data",
    version="2.0.0",
    #lifespan=lifespan
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nhúng WebSocket Router
app.include_router(websocket_router)
app.include_router(embed_router)

class ChatRequest(BaseModel):
    message: str
    style: Optional[str] = "standard"

@app.get("/")
async def root():
    """Endpoint kiểm tra trạng thái Server"""
    return {"status": "online", "version": "2.0.0", "service": "Financial AI Analyst"}

@app.post("/api/v1/chat")
async def chat_endpoint(payload: ChatRequest):
    """Endpoint xử lý hội thoại với AI"""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    try:
        # Gọi ChatBot Service xử lý Hybrid RAG + Real-time Data
        result = await chatbot_service.handle_message(
            user_text=payload.message, 
            style=payload.style
        )
        return result
    except Exception as e:
        logger.error(f"Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

if __name__ == "__main__":
    # Chạy server với chế độ reload tự động khi thay đổi code
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
