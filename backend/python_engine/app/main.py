import uvicorn
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.services.chatbot import chatbot_service
from config.settings import settings

# Cấu hình Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Financial AI Analyst API",
    description="Hệ thống phân tích chứng khoán dựa trên RAG và NLP Pipeline",
    version="2.0.0"
)

# Cấu hình CORS (Cho phép Frontend gọi API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model định nghĩa dữ liệu đầu vào
class ChatRequest(BaseModel):
    message: str
    style: Optional[str] = "standard"
    user_id: Optional[str] = None

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Financial AI Analyst",
        "version": "2.0.0"
    }

@app.post("/api/v1/chat")
async def chat_endpoint(payload: ChatRequest):
    """
    Endpoint chính để xử lý tin nhắn từ người dùng
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    logger.info(f"Received message: {payload.message} (Style: {payload.style})")

    try:
        # Gọi Service xử lý chính (luồng RAG + NLP đã fix ở bước trước)
        result = await chatbot_service.handle_message(
            user_text=payload.message, 
            style=payload.style
        )
        
        return result

    except Exception as e:
        logger.error(f"Error in chat_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/api/v1/health")
async def health_check():
    """
    Kiểm tra trạng thái kết nối của các dịch vụ bên thứ 3
    """
    # Bạn có thể thêm logic kiểm tra Redis/Qdrant/Elastic tại đây
    return {"status": "healthy"}

if __name__ == "__main__":
    # Chạy server với Uvicorn
    # host và port lấy từ settings hoặc mặc định
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True # Tự động load lại khi sửa code (chỉ dùng khi dev)
    )