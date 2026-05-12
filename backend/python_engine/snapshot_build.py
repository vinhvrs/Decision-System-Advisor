from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pymysql

from config.settings import settings
from app.data_collect.symbol_ingest import (
    MODE_ALL,
    MODE_TOP_SNAPSHOT,
    normalize_symbol_ingest_mode,
    fetch_companies_for_ingest,
)


PERIOD_TO_SNAPSHOT_TABLE = {
    "daily": "snapshot_daily",
    "weekly": "snapshot_weekly",
    "monthly": "snapshot_monthly",
    "yearly": "snapshot_annual",
}


def _connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _max_candles() -> int:
    try:
        v = int(str(getattr(settings, "SNAPSHOT_MAX_CANDLES", 300)))
    except Exception:
        v = 300
    return max(50, min(v, 5000))


def _resolve_scope(symbol_scope: Optional[str], top_n: Optional[int]) -> Tuple[str, int]:
    mode = normalize_symbol_ingest_mode(symbol_scope or MODE_TOP_SNAPSHOT)
    n = max(1, int(top_n or 20))
    return mode, n


def _fetch_period_id(cur, instrument_id: str, period: str) -> Optional[str]:
    cur.execute(
        """
        SELECT id
        FROM instrument_periods
        WHERE instrument_id=%s AND period=%s
        LIMIT 1
        """,
        (instrument_id, period),
    )
    row = cur.fetchone()
    return str(row["id"]) if row and row.get("id") else None


def _fetch_candles(cur, period_id: str, limit: int) -> List[Dict]:
    cur.execute(
        """
        SELECT timestamps, open, high, low, close, volume
        FROM instrument_data
        WHERE instrument_period_id=%s
        ORDER BY timestamps DESC
        LIMIT %s
        """,
        (period_id, limit),
    )
    rows = cur.fetchall() or []
    rows.reverse()  # oldest -> newest
    out: List[Dict] = []
    for r in rows:
        ts = r.get("timestamps")
        out.append(
            {
                "timestamp": str(ts) if ts is not None else None,
                "open": float(r["open"]) if r.get("open") is not None else None,
                "high": float(r["high"]) if r.get("high") is not None else None,
                "low": float(r["low"]) if r.get("low") is not None else None,
                "close": float(r["close"]) if r.get("close") is not None else None,
                "volume": float(r["volume"]) if r.get("volume") is not None else None,
            }
        )
    return out


def _upsert_snapshot(
    cur,
    *,
    table_name: str,
    instrument_id: str,
    symbol: str,
    candles: List[Dict],
) -> None:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    candles_count = len(candles)
    from_time = candles[0]["timestamp"] if candles_count else None
    to_time = candles[-1]["timestamp"] if candles_count else None
    cur.execute(
        f"""
        INSERT INTO {table_name}
            (id, instrument_id, symbol, candles, candles_count, from_time, to_time, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            candles=VALUES(candles),
            candles_count=VALUES(candles_count),
            from_time=VALUES(from_time),
            to_time=VALUES(to_time),
            updated_at=VALUES(updated_at)
        """,
        (
            str(uuid.uuid4()),
            instrument_id,
            symbol,
            json.dumps(candles, ensure_ascii=False),
            candles_count,
            from_time,
            to_time,
            now_str,
            now_str,
        ),
    )


def build_snapshots(symbol_scope: Optional[str] = None, top_n: Optional[int] = None) -> Dict:
    mode, resolved_top_n = _resolve_scope(symbol_scope, top_n)
    max_candles = _max_candles()
    conn = _connect()
    touched = 0
    upserts = 0
    skipped = 0
    try:
        with conn.cursor() as cur:
            companies = fetch_companies_for_ingest(
                conn,
                symbol_scope=mode,
                top_n=resolved_top_n,
            )
            for c in companies:
                symbol = str(c.get("symbol") or "").strip().upper()
                if not symbol:
                    continue
                cur.execute("SELECT id FROM instruments WHERE UPPER(TRIM(symbol))=%s LIMIT 1", (symbol,))
                irow = cur.fetchone()
                if not irow or not irow.get("id"):
                    skipped += 1
                    continue
                instrument_id = str(irow["id"])
                touched += 1
                for period, table in PERIOD_TO_SNAPSHOT_TABLE.items():
                    period_id = _fetch_period_id(cur, instrument_id, period)
                    if not period_id:
                        continue
                    candles = _fetch_candles(cur, period_id, max_candles)
                    try:
                        _upsert_snapshot(
                            cur,
                            table_name=table,
                            instrument_id=instrument_id,
                            symbol=symbol,
                            candles=candles,
                        )
                        upserts += 1
                    except pymysql.err.ProgrammingError as e:
                        # Skip periods whose snapshot table is not migrated yet.
                        if "doesn't exist" not in str(e).lower():
                            raise
        conn.commit()
        return {
            "ok": True,
            "mode": mode if mode in (MODE_ALL, MODE_TOP_SNAPSHOT) else MODE_TOP_SNAPSHOT,
            "top_n": resolved_top_n,
            "max_candles": max_candles,
            "symbols_touched": touched,
            "snapshot_upserts": upserts,
            "symbols_skipped": skipped,
        }
    finally:
        conn.close()


if __name__ == "__main__":
    out = build_snapshots()
    print(out)

