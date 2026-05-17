"""
Scheduled daily refresh: ``snapshot_demo``, ``snapshot_daily``, ``company_facts_raw`` (10 tech symbols).
"""
from __future__ import annotations

import logging
import os
from threading import Lock

from app.pipeline.tech_universe_daily import run_tech_universe_daily

logger = logging.getLogger(__name__)
_lock = Lock()


def _enabled() -> bool:
    return (os.environ.get("TECH_UNIVERSE_DAILY_ENABLED", "1") or "").strip().lower() in (
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


def run_tech_universe_daily_job() -> None:
    if not _enabled():
        logger.info("[Schedule] tech universe daily disabled (TECH_UNIVERSE_DAILY_ENABLED=0)")
        return
    if not _lock.acquire(blocking=False):
        logger.warning("[Schedule] tech universe daily skipped — previous run still active")
        return
    try:
        period = (os.environ.get("TECH_UNIVERSE_YF_PERIOD", "30d") or "30d").strip() or "30d"
        logger.info("[Schedule] tech universe daily starting (yf_period=%s)", period)
        run_tech_universe_daily(
            yf_period=period,
            use_macrotrends=_macrotrends_enabled(),
        )
        logger.info("[Schedule] tech universe daily completed")
    except Exception as e:
        logger.error("[Schedule] tech universe daily error: %s", e, exc_info=True)
    finally:
        _lock.release()
