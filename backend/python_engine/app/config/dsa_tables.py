"""
Resolve logical table names from DEV_MODE in backend/.env.

DEV_MODE=dev      → demo tables (instrument_data_demo, snapshot_demo, …)
DEV_MODE=production → production tables (instrument_data, instrument_snapshot, …)
"""

from __future__ import annotations

import os

TABLES: dict[str, tuple[str, str]] = {
    "company_profile": ("company_profile", "company_profile_demo"),
    "instrument_data": ("instrument_data", "instrument_data_demo"),
    "instruments": ("instruments", "instrument_demo"),
    "instrument_periods": ("instrument_periods", "instrument_period_demo"),
    "instrument_snapshot": ("instrument_snapshot", "snapshot_demo"),
}


def dev_mode() -> str:
    return os.environ.get("DEV_MODE", "dev").strip().lower()


def use_demo_tables() -> bool:
    mode = dev_mode()
    if mode in ("production", "prod"):
        return False
    if mode in ("dev", "demo", "local"):
        return True
    legacy = os.environ.get("DASHBOARD_USE_DEMO", "").strip().lower()
    if legacy in ("1", "true", "yes", "on"):
        return True
    if legacy in ("0", "false", "no", "off"):
        return False
    return mode != "production"


def table(logical: str) -> str:
    pair = TABLES.get(logical)
    if not pair:
        raise KeyError(f"Unknown logical DSA table: {logical}")
    prod, demo = pair
    return demo if use_demo_tables() else prod


def all_resolved() -> dict[str, str]:
    return {logical: table(logical) for logical in TABLES}
