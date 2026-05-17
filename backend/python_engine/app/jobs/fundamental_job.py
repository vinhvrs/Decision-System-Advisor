"""
Scheduled SEC (+ optional MacroTrends) fundamental ingest for the US tech universe.
"""
from __future__ import annotations

import logging
import os
from threading import Lock

from app.pipeline.fundamental_ingest import run_fundamental_ingest

logger = logging.getLogger(__name__)
_lock = Lock()


def _enabled() -> bool:
    return (os.environ.get("FUNDAMENTAL_INGEST_ENABLED", "1") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _macrotrends_enabled() -> bool:
    return (os.environ.get("MACROTRENDS_ENABLED", "1") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def run_fundamental_ingest_job() -> None:
    """Pull SEC EDGAR companyfacts + submissions; optional MacroTrends gap-fill."""
    # Full daily pipeline (snapshots + SEC) runs in tech_universe_daily_job when enabled.
    tu = (os.environ.get("TECH_UNIVERSE_DAILY_ENABLED", "1") or "").strip().lower()
    if tu in ("1", "true", "yes", "on"):
        logger.info("[Schedule] fundamental ingest skipped — handled by tech_universe_daily")
        return
    if not _enabled():
        logger.info("[Schedule] fundamental ingest disabled (FUNDAMENTAL_INGEST_ENABLED=0)")
        return
    if not _lock.acquire(blocking=False):
        logger.warning("[Schedule] fundamental ingest skipped — previous run still active")
        return
    try:
        logger.info(
            "[Schedule] fundamental ingest starting (macrotrends=%s)",
            _macrotrends_enabled(),
        )
        run_fundamental_ingest(use_macrotrends=_macrotrends_enabled())
        logger.info("[Schedule] fundamental ingest completed")
    except Exception as e:
        logger.error("[Schedule] fundamental ingest error: %s", e, exc_info=True)
    finally:
        _lock.release()
