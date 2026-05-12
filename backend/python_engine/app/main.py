import logging
import os
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.routes.embed import router as embed_router
from app.bootstrap.scheduler_runtime import build_scheduler_health_payload, lifespan
from app.services.chatbot import chatbot_service
from app.socket.chatbot_options import router as chatbot_ws_router
from app.socket.events import router as websocket_router

logger = logging.getLogger(__name__)


def _trigger_client_is_loopback(request: Request) -> bool:
    client = request.client
    if client is None:
        return False
    host = (client.host or "").lower().strip("[]")
    return host in ("127.0.0.1", "::1", "localhost")


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
app.include_router(chatbot_ws_router)
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


def _run_dashboard_warm_up_sync() -> None:
    """Runs in a thread after the trigger HTTP response returns."""
    try:
        from app.jobs.dashboard_job import run_dashboard_warm_up

        run_dashboard_warm_up()
    except Exception as e:
        logger.exception("internal dashboard warm-up failed: %s", e)


@app.post("/internal/tasks/dashboard-warm-up")
async def internal_dashboard_warm_up(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Laravel calls this **after** sending the API response to the browser (fire-and-forget).
    Guard with ``ENGINE_INTERNAL_TRIGGER_SECRET`` (header ``X-Engine-Trigger-Token``), or for **local
    dev only** set ``ENGINE_INTERNAL_TRIGGER_INSECURE_LOCAL=1`` and call from loopback without a secret.
    """
    secret = (os.environ.get("ENGINE_INTERNAL_TRIGGER_SECRET") or "").strip()
    insecure = (os.environ.get("ENGINE_INTERNAL_TRIGGER_INSECURE_LOCAL") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if secret:
        token = (request.headers.get("X-Engine-Trigger-Token") or "").strip()
        if token != secret:
            raise HTTPException(status_code=403, detail="Invalid trigger token")
    elif insecure and _trigger_client_is_loopback(request):
        logger.warning(
            "internal dashboard warm-up: no ENGINE_INTERNAL_TRIGGER_SECRET; allowing loopback only (insecure local)"
        )
    else:
        raise HTTPException(
            status_code=503,
            detail="Set ENGINE_INTERNAL_TRIGGER_SECRET or ENGINE_INTERNAL_TRIGGER_INSECURE_LOCAL=1 (loopback only)",
        )

    background_tasks.add_task(_run_dashboard_warm_up_sync)
    return {"ok": True, "accepted": True, "task": "dashboard_warm_up"}


@app.get("/health/scheduler")
async def health_scheduler(request: Request):
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler is None:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "detail": "Scheduler not initialized"},
        )
    if not scheduler.running:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "detail": "Scheduler stopped"},
        )
    return build_scheduler_health_payload(scheduler)


@app.post("/api/v1/chat")
async def chat_endpoint(payload: ChatRequest):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        return await chatbot_service.handle_message(
            user_text=payload.message,
            style=payload.style,
        )
    except Exception as e:
        logger.error(f"Chat Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    )
    reload_enabled = os.environ.get("UVICORN_RELOAD", "0").lower() in ("1", "true", "yes")
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("UVICORN_HOST", "0.0.0.0"),
        port=int(os.environ.get("UVICORN_PORT", "8000")),
        reload=reload_enabled,
    )

