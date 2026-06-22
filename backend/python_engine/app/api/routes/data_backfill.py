from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.internal_trigger import verify_internal_trigger
from app.services.data_backfill_service import BACKFILL_CATALOG, run_job

logger = logging.getLogger(__name__)

router = APIRouter(tags=["data-backfill"])


class DataBackfillRequest(BaseModel):
    job: str = Field(..., min_length=1, max_length=64)
    symbol: Optional[str] = None
    backfill_days: Optional[int] = Field(None, ge=1, le=3650)
    limit_year: Optional[int] = Field(None, ge=1990, le=2030)
    history_period: Optional[str] = Field(None, max_length=16)


def _params_from_body(body: DataBackfillRequest) -> Dict[str, Any]:
    raw = body.model_dump(exclude_none=True)
    job = raw.pop("job")
    return {"job": job, "params": raw}


def _run_job_sync(job: str, params: Dict[str, Any]) -> None:
    try:
        result = run_job(job, params)
        logger.info("data_backfill finished: %s", result)
    except Exception as e:
        logger.exception("data_backfill failed job=%s: %s", job, e)


@router.get("/api/v1/admin/data-backfill/catalog")
async def catalog():
    return {"ok": True, "jobs": BACKFILL_CATALOG}


@router.post("/internal/tasks/data-backfill")
async def internal_data_backfill(
    request: Request,
    body: DataBackfillRequest,
    background_tasks: BackgroundTasks,
):
    verify_internal_trigger(request)

    job = body.job.strip()
    allowed = {item["id"] for item in BACKFILL_CATALOG}
    if job not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown job. Allowed: {sorted(allowed)}")

    if job == "market_symbol" and not (body.symbol or "").strip():
        raise HTTPException(status_code=400, detail="symbol is required for market_symbol")

    if job == "market_symbol_demo" and not (body.symbol or "").strip():
        raise HTTPException(status_code=400, detail="symbol is required for market_symbol_demo")

    payload = _params_from_body(body)
    background_tasks.add_task(_run_job_sync, payload["job"], payload["params"])

    return {
        "ok": True,
        "accepted": True,
        "task": "data_backfill",
        "job": job,
        "params": payload["params"],
    }
