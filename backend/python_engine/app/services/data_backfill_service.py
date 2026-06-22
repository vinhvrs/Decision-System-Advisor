"""
Admin-triggered data backfill jobs (market OHLC, demo board, news history).

Charts read ``instrument_data`` (production). Use ``DSATurbo`` (stock_sync) for those jobs.
``DSADemoSync`` is only used for explicit demo-table jobs.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import pymysql

from config.settings import settings

logger = logging.getLogger(__name__)

DEMO_BOARD_SYMBOLS: List[str] = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "TSLA",
    "META",
    "JPM",
    "V",
    "JNJ",
]

DEFAULT_CATCH_UP_DAYS = 30
DEFAULT_BACKFILL_DAYS = 365


def _db_connect() -> pymysql.connections.Connection:
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _get_instrument_id(conn: pymysql.connections.Connection, symbol: str) -> Optional[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM instruments WHERE symbol=%s LIMIT 1", (symbol.upper(),))
        row = cur.fetchone()
        return row["id"] if row else None


def _get_production_daily_stats(conn: pymysql.connections.Connection, symbol: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS daily_rows, MAX(d.timestamps) AS latest_ts
            FROM instruments i
            JOIN instrument_periods ip ON ip.instrument_id = i.id AND ip.period = 'daily'
            JOIN instrument_data d ON d.instrument_period_id = ip.id
            WHERE i.symbol = %s
            """,
            (symbol.upper(),),
        )
        row = cur.fetchone() or {}
        latest = row.get("latest_ts")
        latest_str = None
        if latest is not None:
            if isinstance(latest, datetime):
                latest_str = latest.strftime("%Y-%m-%d")
            else:
                latest_str = str(latest)[:10]
        return {
            "daily_rows": int(row.get("daily_rows") or 0),
            "latest_daily": latest_str,
        }


def _sync_production_symbol(symbol: str, *, backfill_days: int) -> Dict[str, Any]:
    from app.data_collect.collectors.stock_sync import DSATurbo

    sym = (symbol or "").strip().upper()
    days = max(1, min(int(backfill_days), 3650))

    conn = _db_connect()
    try:
        inst_id = _get_instrument_id(conn, sym)
        if not inst_id:
            return {"ok": False, "symbol": sym, "error": "instrument not found"}

        before = _get_production_daily_stats(conn, sym)
    finally:
        conn.close()

    turbo = DSATurbo(backfill_days=days)
    try:
        turbo.update_stock(inst_id, sym)
    finally:
        try:
            turbo.conn.close()
        except Exception:
            pass

    conn = _db_connect()
    try:
        after = _get_production_daily_stats(conn, sym)
    finally:
        conn.close()

    return {
        "ok": True,
        "symbol": sym,
        "target_table": "instrument_data",
        "backfill_days": days,
        "before": before,
        "after": after,
    }


def backfill_market_symbol(symbol: str, *, backfill_days: int = DEFAULT_CATCH_UP_DAYS) -> Dict[str, Any]:
    """Yahoo daily bars → ``instrument_data`` (charts use this table)."""
    sym = (symbol or "").strip().upper()
    if not sym:
        return {"ok": False, "error": "symbol is required"}

    result = _sync_production_symbol(sym, backfill_days=backfill_days)
    result["job"] = "market_symbol"
    return result


def catch_up_demo_board(*, backfill_days: int = DEFAULT_CATCH_UP_DAYS) -> Dict[str, Any]:
    """Catch up all demo-board symbols in ``instrument_data`` (always runs, no row-count skip)."""
    days = max(1, min(int(backfill_days), 3650))

    conn = _db_connect()
    try:
        before = {s: _get_production_daily_stats(conn, s) for s in DEMO_BOARD_SYMBOLS}
    finally:
        conn.close()

    synced: List[str] = []
    errors: List[Dict[str, str]] = []
    after: Dict[str, Dict[str, Any]] = {}

    for sym in DEMO_BOARD_SYMBOLS:
        try:
            result = _sync_production_symbol(sym, backfill_days=days)
            if result.get("ok"):
                synced.append(sym)
                after[sym] = result.get("after", {})
            else:
                errors.append({"symbol": sym, "error": str(result.get("error", "sync failed"))})
        except Exception as e:
            errors.append({"symbol": sym, "error": str(e)})

    return {
        "ok": True,
        "job": "demo_board_refill",
        "target_table": "instrument_data",
        "synced": synced,
        "errors": errors,
        "before": before,
        "after": after,
        "backfill_days": days,
    }


def backfill_market_symbol_demo(symbol: str, *, backfill_days: int = DEFAULT_BACKFILL_DAYS) -> Dict[str, Any]:
    """Yahoo daily → ``instrument_data_demo`` (dashboard demo mode only)."""
    from app.data_collect.collectors.demo_data_sync import DSADemoSync

    sym = (symbol or "").strip().upper()
    if not sym:
        return {"ok": False, "error": "symbol is required"}

    days = max(1, min(int(backfill_days), 3650))
    conn = _db_connect()
    try:
        inst_id = _get_instrument_id(conn, sym)
        if not inst_id:
            return {"ok": False, "error": f"instrument not found: {sym}"}
    finally:
        conn.close()

    demo = DSADemoSync(backfill_days=days)
    try:
        demo.update_stock(inst_id, sym)
    finally:
        try:
            demo.conn.close()
        except Exception:
            pass

    return {
        "ok": True,
        "job": "market_symbol_demo",
        "symbol": sym,
        "target_table": "instrument_data_demo",
        "backfill_days": days,
    }


def backfill_news(
    *,
    limit_year: int = 2018,
    symbol: Optional[str] = None,
) -> Dict[str, Any]:
    """Historical GDELT + corporate actions into ``knowledge_docs``."""
    from app.data_collect.collectors.news_handle import run_deep_news_backfill

    year = max(1990, min(int(limit_year), 2030))
    scope = (symbol or "").strip().upper() or None

    run_deep_news_backfill(limit_year=year, symbol_scope=scope)

    return {
        "ok": True,
        "job": "news_backfill",
        "limit_year": year,
        "symbol": scope,
    }


def sync_market_universe(
    *,
    backfill_days: Optional[int] = None,
    history_period: str = "7d",
) -> Dict[str, Any]:
    """Sync ``snapshot_demo`` symbols into ``instrument_data`` via ``DSATurbo.run()``."""
    from app.data_collect.collectors.stock_sync import DSATurbo

    days = None if backfill_days is None else max(1, min(int(backfill_days), 3650))
    turbo = DSATurbo(backfill_days=days, history_period=history_period)
    try:
        instruments = turbo.fetch_symbols()
        symbols = [str(i["symbol"]).upper() for i in instruments]
        turbo.run()
    finally:
        try:
            turbo.conn.close()
        except Exception:
            pass

    return {
        "ok": True,
        "job": "demo_sync_all",
        "target_table": "instrument_data",
        "symbol_count": len(symbols),
        "symbols": symbols[:50],
        "backfill_days": days,
        "history_period": history_period if days is None else None,
    }


def sync_demo_universe(
    *,
    backfill_days: Optional[int] = None,
    history_period: str = "7d",
) -> Dict[str, Any]:
    """Sync ``snapshot_demo`` into ``instrument_data_demo`` (demo tables only)."""
    from app.data_collect.collectors.demo_data_sync import DSADemoSync

    days = None if backfill_days is None else max(1, min(int(backfill_days), 3650))
    demo = DSADemoSync(backfill_days=days, history_period=history_period)
    try:
        instruments = demo.fetch_symbols()
        symbols = [str(i["symbol"]).upper() for i in instruments]
        demo.run()
    finally:
        try:
            demo.conn.close()
        except Exception:
            pass

    return {
        "ok": True,
        "job": "demo_sync_all_demo",
        "target_table": "instrument_data_demo",
        "symbol_count": len(symbols),
        "symbols": symbols[:50],
        "backfill_days": days,
        "history_period": history_period if days is None else None,
    }


def run_job(job: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Dispatch a named backfill job."""
    params = params or {}
    logger.info("data_backfill_service.run_job job=%s params=%s", job, params)

    if job == "market_symbol":
        return backfill_market_symbol(
            str(params.get("symbol", "")),
            backfill_days=int(params.get("backfill_days", DEFAULT_CATCH_UP_DAYS)),
        )
    if job == "demo_board_refill":
        return catch_up_demo_board(
            backfill_days=int(params.get("backfill_days", DEFAULT_CATCH_UP_DAYS)),
        )
    if job == "market_symbol_demo":
        return backfill_market_symbol_demo(
            str(params.get("symbol", "")),
            backfill_days=int(params.get("backfill_days", DEFAULT_BACKFILL_DAYS)),
        )
    if job == "news_backfill":
        return backfill_news(
            limit_year=int(params.get("limit_year", 2018)),
            symbol=params.get("symbol"),
        )
    if job == "demo_sync_all":
        bfd = params.get("backfill_days")
        return sync_market_universe(
            backfill_days=int(bfd) if bfd is not None else None,
            history_period=str(params.get("history_period", "7d")),
        )
    if job == "demo_sync_all_demo":
        bfd = params.get("backfill_days")
        return sync_demo_universe(
            backfill_days=int(bfd) if bfd is not None else None,
            history_period=str(params.get("history_period", "7d")),
        )

    return {"ok": False, "error": f"unknown job: {job}"}


BACKFILL_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "market_symbol",
        "label": "Catch up chart OHLC (one symbol)",
        "description": "Yahoo daily → instrument_data. Use this when a stock chart stops updating (e.g. NVDA stuck at an old date).",
        "module": "app.data_collect.collectors.stock_sync.DSATurbo",
        "params": [
            {"name": "symbol", "type": "string", "required": True},
            {"name": "backfill_days", "type": "integer", "default": 30, "min": 1, "max": 3650},
        ],
    },
    {
        "id": "demo_board_refill",
        "label": "Catch up demo board (10 symbols)",
        "description": "Refresh last N days for AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, JPM, V, JNJ in instrument_data.",
        "module": "app.data_collect.collectors.stock_sync.DSATurbo",
        "params": [
            {"name": "backfill_days", "type": "integer", "default": 30, "min": 1, "max": 3650},
        ],
    },
    {
        "id": "demo_sync_all",
        "label": "Sync snapshot_demo universe",
        "description": "All symbols in snapshot_demo → instrument_data (production OHLC).",
        "module": "app.data_collect.collectors.stock_sync.DSATurbo.run",
        "params": [
            {"name": "backfill_days", "type": "integer", "optional": True},
            {"name": "history_period", "type": "string", "default": "7d"},
        ],
    },
    {
        "id": "news_backfill",
        "label": "News history backfill",
        "description": "GDELT + corporate actions → knowledge_docs (requires NEWS_HANDLE_ENABLED=1).",
        "module": "app.data_collect.collectors.news_handle.run_deep_news_backfill",
        "params": [
            {"name": "limit_year", "type": "integer", "default": 2018},
            {"name": "symbol", "type": "string", "optional": True},
        ],
    },
    {
        "id": "market_symbol_demo",
        "label": "Demo table OHLC (one symbol)",
        "description": "Yahoo daily → instrument_data_demo only (beginner board / DASHBOARD_USE_DEMO).",
        "module": "app.data_collect.collectors.demo_data_sync.DSADemoSync",
        "params": [
            {"name": "symbol", "type": "string", "required": True},
            {"name": "backfill_days", "type": "integer", "default": 365, "min": 1, "max": 3650},
        ],
    },
]
