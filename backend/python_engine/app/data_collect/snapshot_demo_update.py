"""
Refresh ``snapshot_demo`` quote rows (price, volume, liquidity, change_pct) from Yahoo Finance.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import pymysql
import yfinance as yf

from config.settings import settings

logger = logging.getLogger(__name__)


def _conn() -> pymysql.connections.Connection:
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _metrics_from_history(df) -> dict[str, float] | None:
    if df is None or df.empty:
        return None
    work = df.sort_index()
    latest = work.iloc[-1]
    prev_close = float(work.iloc[-2]["Close"]) if len(work) > 1 else float(latest["Open"])
    price = float(latest["Close"])
    open_p = float(latest["Open"])
    volume = float(latest["Volume"])
    if price <= 0:
        return None
    change_pct = ((price - prev_close) / prev_close * 100.0) if prev_close > 0 else 0.0
    liquidity = price * volume
    return {
        "price": price,
        "open": open_p,
        "volume": volume,
        "liquidity": liquidity,
        "change_pct": change_pct,
    }


def refresh_snapshot_demo_symbol(
    cur: pymysql.cursors.Cursor,
    *,
    instrument_id: str,
    symbol: str,
    history_period: str = "5d",
) -> bool:
    sym = symbol.strip().upper()
    try:
        df = yf.Ticker(sym).history(period=history_period, interval="1d", auto_adjust=True)
    except Exception as e:
        logger.warning("snapshot_demo yfinance failed %s: %s", sym, e)
        return False
    m = _metrics_from_history(df)
    if not m:
        return False
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        """
        INSERT INTO snapshot_demo
            (instrument_id, symbol, price, open, volume, liquidity, change_pct, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            symbol = VALUES(symbol),
            price = VALUES(price),
            open = VALUES(open),
            volume = VALUES(volume),
            liquidity = VALUES(liquidity),
            change_pct = VALUES(change_pct),
            updated_at = VALUES(updated_at)
        """,
        (
            instrument_id,
            sym,
            m["price"],
            m["open"],
            m["volume"],
            m["liquidity"],
            m["change_pct"],
            now,
        ),
    )
    return True


def refresh_snapshot_demo_symbols(
    symbols: list[str],
    *,
    history_period: str = "5d",
) -> dict[str, Any]:
    """Update ``snapshot_demo`` for each symbol that exists in ``instruments``."""
    wanted = [s.strip().upper() for s in symbols if s and str(s).strip()]
    if not wanted:
        return {"ok": True, "updated": 0, "skipped": 0, "symbols": []}

    conn = _conn()
    updated = 0
    skipped = 0
    try:
        with conn.cursor() as cur:
            ph = ",".join(["%s"] * len(wanted))
            cur.execute(
                f"""
                SELECT id, UPPER(TRIM(symbol)) AS symbol
                FROM instruments
                WHERE UPPER(TRIM(symbol)) IN ({ph})
                """,
                wanted,
            )
            id_by_sym = {str(r["symbol"]): str(r["id"]) for r in (cur.fetchall() or [])}

            for sym in wanted:
                inst_id = id_by_sym.get(sym)
                if not inst_id:
                    skipped += 1
                    logger.warning("snapshot_demo skip — no instrument row for %s", sym)
                    continue
                if refresh_snapshot_demo_symbol(
                    cur, instrument_id=inst_id, symbol=sym, history_period=history_period
                ):
                    updated += 1
                else:
                    skipped += 1
        conn.commit()
    finally:
        conn.close()

    return {"ok": True, "updated": updated, "skipped": skipped, "symbols": wanted}
