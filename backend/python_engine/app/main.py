import os
import uvicorn
import logging
import asyncio
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.events import EVENT_JOB_ERROR

from app.analyze.ranking.stock_compare import MarketSyncService
from app.services.chatbot import chatbot_service
from app.socket.events import router as websocket_router
from app.socket.chatbot_options import router as chatbot_ws_router
from app.api.routes.embed import router as embed_router
from app.analyze.analysis_cache import analysis_cache_service
from app.analyze.auto_analyze import auto_analyze_service
from app.data_collect.collectors.news_handle import run_daily_update
from app.data_collect.collectors.stock_sync import DSATurbo
from app.data_collect.symbol_ingest import snapshot_limit_for_stock_sync

logger = logging.getLogger(__name__)


def _setup_engine_file_log() -> None:
    log_path = Path(__file__).resolve().parent.parent / "storage" / "logs" / "engine.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.INFO)
    fh.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s"))
    root = logging.getLogger()
    target = str(log_path.resolve())
    if any(
        isinstance(h, logging.FileHandler) and getattr(h, "baseFilename", "") == target
        for h in root.handlers
    ):
        return
    root.addHandler(fh)
    root.setLevel(logging.INFO)
    # Per-request INFO lines from httpx clutter engine.log (Yahoo/GDELT polls).
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


pipeline_lock = Lock()
news_lock = Lock()
news_embed_lock = Lock()
stock_sync_lock = Lock()
auto_analyze_lock = Lock()


def _env_float(name: str, default: float, *, minimum: float) -> float:
    """Parse a positive float from env; empty/invalid falls back to default."""
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        v = float(raw)
        if not (v > 0) or v != v:  # reject NaN, <= 0
            return default
        return max(minimum, v)
    except ValueError:
        return default


# Env-tunable cadence (Docker / systemd should set these; defaults suit dev).
SCHEDULE_INTERVAL_HOURS = float(os.environ.get("SCHEDULE_INTERVAL_HOURS", "3"))
# Ranking sync (Redis heatmap, instrument_snapshot, fear_greed hash).
RANKING_SYNC_INTERVAL_HOURS = float(
    os.environ.get("RANKING_SYNC_INTERVAL_HOURS", str(SCHEDULE_INTERVAL_HOURS))
)
# News ingest: default hourly, independent of candle sync interval (min 5 minutes).
NEWS_INTERVAL_HOURS = _env_float("NEWS_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
_NEWS_INTERVAL_RAW = os.environ.get("NEWS_INTERVAL_HOURS", "")
# Wider window on each scheduled run so gaps (downtime / missed fires) still backfill GDELT.
NEWS_SCHEDULE_LOOKBACK_DAYS = max(1, int(os.environ.get("NEWS_SCHEDULE_LOOKBACK_DAYS", "7")))
# APScheduler: still run a job if it missed its slot by up to this many seconds (busy CPU / long news run).
SCHEDULER_MISFIRE_GRACE_SEC = int(os.environ.get("SCHEDULER_MISFIRE_GRACE_SEC", str(4 * 3600)))

# Symbol universe for scheduled news + candle sync:
#   all            — every company_profile row (news) and TOP_N snapshot rows (candles)
#   top_snapshot   — top SYMBOL_INGEST_TOP_N by snapshot volume (thesis demo default)
SYMBOL_INGEST_MODE = os.environ.get("SYMBOL_INGEST_MODE", "top_snapshot")
SYMBOL_INGEST_TOP_N = max(1, int(os.environ.get("SYMBOL_INGEST_TOP_N", "20")))

# Embed + Qdrant for knowledge_docs (off by default: crawl-only; set NEWS_EMBED_ENABLED=1 to enable).
_NEWS_EMBED_FLAG = os.environ.get("NEWS_EMBED_ENABLED", "0").strip().lower()
NEWS_EMBED_ENABLED = _NEWS_EMBED_FLAG not in ("0", "false", "no", "off")
NEWS_EMBED_INTERVAL_HOURS = _env_float("NEWS_EMBED_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
try:
    NEWS_EMBED_BATCH_LIMIT = max(1, int(os.environ.get("NEWS_EMBED_BATCH_LIMIT", "50")))
except ValueError:
    NEWS_EMBED_BATCH_LIMIT = 50


def run_ranking_sync():
    if not pipeline_lock.acquire(blocking=False):
        logger.warning("Ranking sync skipped because previous run is still active.")
        return

    try:
        logger.info("[Schedule] Starting ranking sync...")
        ranking_service = MarketSyncService()
        ranking_service.sync()
        logger.info("[Schedule] Ranking sync completed.")
    except Exception as e:
        logger.error(f"[Schedule] Ranking sync error: {str(e)}", exc_info=True)
    finally:
        pipeline_lock.release()


def run_news_daily_update():
    if not news_lock.acquire(blocking=False):
        logger.warning("Daily news update skipped because previous run is still active.")
        return

    try:
        logger.info(
            "[Schedule] Starting daily news update (lookback_days=%s, scope=%s, top_n=%s)...",
            NEWS_SCHEDULE_LOOKBACK_DAYS,
            SYMBOL_INGEST_MODE,
            SYMBOL_INGEST_TOP_N,
        )
        run_daily_update(
            lookback_days=NEWS_SCHEDULE_LOOKBACK_DAYS,
            symbol_scope=SYMBOL_INGEST_MODE,
            top_n=SYMBOL_INGEST_TOP_N,
        )
        logger.info("[Schedule] Daily news update completed.")
    except Exception as e:
        logger.error(f"[Schedule] Daily news update error: {str(e)}", exc_info=True)
    finally:
        news_lock.release()


def run_news_embed_pipeline():
    if not NEWS_EMBED_ENABLED:
        return
    if not news_embed_lock.acquire(blocking=False):
        logger.warning("News embed+Qdrant skipped because previous run is still active.")
        return

    try:
        from app.pipeline.orchestrator import pipeline_manager

        logger.info(
            "[Schedule] Starting news embed+Qdrant (batch limit=%s)...",
            NEWS_EMBED_BATCH_LIMIT,
        )
        out = asyncio.run(
            pipeline_manager.embed_unprocessed_knowledge_docs(limit=NEWS_EMBED_BATCH_LIMIT)
        )
        logger.info("[Schedule] News embed+Qdrant completed: %s", out)
    except Exception as e:
        logger.error("[Schedule] News embed+Qdrant error: %s", e, exc_info=True)
    finally:
        news_embed_lock.release()


def run_stock_sync():
    if not stock_sync_lock.acquire(blocking=False):
        logger.warning("Stock sync skipped because previous run is still active.")
        return

    try:
        logger.info(
            "[Schedule] Starting stock sync (candle data, scope=%s, top_n=%s)...",
            SYMBOL_INGEST_MODE,
            SYMBOL_INGEST_TOP_N,
        )
        turbo = DSATurbo(
            snapshot_limit=snapshot_limit_for_stock_sync(SYMBOL_INGEST_MODE, SYMBOL_INGEST_TOP_N)
        )
        turbo.run()
        logger.info("[Schedule] Stock sync completed.")
    except Exception as e:
        logger.error(f"[Schedule] Stock sync error: {str(e)}", exc_info=True)
    finally:
        stock_sync_lock.release()


async def _run_auto_analyze_refresh_async():
    try:
        symbols = await analysis_cache_service.get_top_symbols_from_ranking(
            ranking_key="liquidity:ranking:daily",
            limit=50,
        )
        if not symbols:
            logger.warning("No symbols found from liquidity:ranking:daily for auto_analyze")
            return

        logger.info(f"[Schedule] Auto-analyze refresh for {len(symbols)} symbols...")
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
                        logger.info(f"Refreshed analysis for {symbol}")
                except Exception as e:
                    logger.error(f"Auto-analyze failed for {symbol}: {e}", exc_info=True)

        await asyncio.gather(*(process_symbol(s) for s in symbols))
        logger.info("[Schedule] Auto-analyze refresh completed.")
    except Exception as e:
        logger.error(f"[Schedule] Auto-analyze refresh error: {e}", exc_info=True)


def run_auto_analyze_refresh():
    if not auto_analyze_lock.acquire(blocking=False):
        logger.warning("Auto-analyze refresh skipped because previous run is still active.")
        return

    try:
        asyncio.run(_run_auto_analyze_refresh_async())
    except Exception as e:
        logger.error(f"[Schedule] Auto-analyze refresh error: {str(e)}", exc_info=True)
    finally:
        auto_analyze_lock.release()


async def warmup_top_stocks():
    try:
        symbols = await analysis_cache_service.get_top_symbols_from_ranking(
            ranking_key="liquidity:ranking:daily",
            limit=100,
        )

        if not symbols:
            logger.warning("No symbols found from liquidity:ranking:daily")
            return

        logger.info(f"Warm-up analysis started for {len(symbols)} symbols")

        semaphore = asyncio.Semaphore(5)

        async def process_symbol(symbol: str):
            async with semaphore:
                try:
                    cached = await analysis_cache_service.get_analysis(symbol)
                    if cached:
                        logger.info(f"Skip cached analysis for {symbol}")
                        return

                    analyzed = await auto_analyze_service.analyze_symbol(
                        symbol=symbol,
                        clean_text=f"Analyze stock {symbol}",
                    )

                    if not analyzed or not isinstance(analyzed, dict):
                        logger.warning(f"Invalid analysis payload for {symbol}")
                        return

                    success = await analysis_cache_service.set_analysis(symbol, analyzed)
                    if success:
                        logger.info(f"Warmed analysis cache for {symbol}")
                    else:
                        logger.error(f"Failed to save warmed cache for {symbol}")

                except Exception as e:
                    logger.error(f"Warmup failed for {symbol}: {e}", exc_info=True)

        await asyncio.gather(*(process_symbol(symbol) for symbol in symbols))
        logger.info("Warm-up analysis finished")

    except Exception as e:
        logger.error(f"Warm-up analysis error: {e}", exc_info=True)


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
    _setup_engine_file_log()
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
    # Stagger first runs so ranking / candles / auto_analyze do not all hammer DB+API at t=0.
    # News runs on its own hourly cadence and starts as soon as the scheduler is up (no deliberate delay).
    stagger = [
        ("ranking_sync", timedelta(minutes=0)),
        ("stock_sync", timedelta(minutes=4)),
        ("auto_analyze_refresh", timedelta(minutes=6)),
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

    # Fresh timestamp so the first news run is not left in the past after other add_job() work.
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

    def _heartbeat():
        if not scheduler.running:
            logger.error("[Schedule] Heartbeat: scheduler is not running!")
            return
        for job in scheduler.get_jobs():
            logger.info("[Schedule] Heartbeat job=%s next_run=%s", job.id, job.next_run_time)

    scheduler.add_job(
        _heartbeat,
        trigger="interval",
        hours=2,
        id="scheduler_heartbeat",
        next_run_time=base + timedelta(minutes=1),
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.start()
    app.state.scheduler = scheduler

    logger.info(
        "Background scheduler started: ranking_sync every %sh (staggered), news ingest every %sh "
        "(env=%r → %s, first_run_at=%s) lookback_days=%s; "
        "news_embed+Qdrant %s (every %sh, batch=%s, first_run~%s); "
        "stock_sync/auto_analyze every %sh; misfire_grace=%ss. "
        "Laravel news:* schedules are disabled — python_engine owns this pipeline. GET /health/scheduler.",
        RANKING_SYNC_INTERVAL_HOURS,
        NEWS_INTERVAL_HOURS,
        _NEWS_INTERVAL_RAW,
        NEWS_INTERVAL_HOURS,
        news_first_run_at.isoformat(timespec="seconds"),
        NEWS_SCHEDULE_LOOKBACK_DAYS,
        "enabled" if NEWS_EMBED_ENABLED else "disabled",
        NEWS_EMBED_INTERVAL_HOURS,
        NEWS_EMBED_BATCH_LIMIT,
        embed_first_at.isoformat(timespec="seconds") if NEWS_EMBED_ENABLED else "n/a",
        interval_h,
        SCHEDULER_MISFIRE_GRACE_SEC,
    )

    asyncio.create_task(warmup_top_stocks())
    logger.info("Warm-up analysis task created.")

    yield

    scheduler.shutdown(wait=True)
    logger.info("Background scheduler shut down.")


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


@app.get("/health/scheduler")
async def health_scheduler(request: Request):
    """Confirm APScheduler is running and list next run times."""
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
        "news_interval_hours_env": _NEWS_INTERVAL_RAW or None,
        "news_embed_enabled": NEWS_EMBED_ENABLED,
        "news_embed_interval_hours": NEWS_EMBED_INTERVAL_HOURS,
        "news_embed_batch_limit": NEWS_EMBED_BATCH_LIMIT,
        "jobs": jobs,
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
    # reload=True spawns a parent+child process and duplicates schedulers — off by default in containers.
    _reload = os.environ.get("UVICORN_RELOAD", "0").lower() in ("1", "true", "yes")
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("UVICORN_HOST", "0.0.0.0"),
        port=int(os.environ.get("UVICORN_PORT", "8000")),
        reload=_reload,
    )
