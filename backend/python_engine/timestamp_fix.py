"""
Create and populate instrument_data_fix for a fixed 10-symbol pilot.

What this script does:
1) Create table `instrument_data_fix` with `timestamps` as DATETIME (same column name).
2) Add practical indexes (including unique by period + timestamps).
3) Copy rows for 10 symbols from `instrument_data`, coercing timestamp from:
   - `timestamps` field if parseable
   - else datetime suffix in `slug` (YYYY-MM-DD HH:MM:SS)

Usage:
  python -m timestamp_fix
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import pymysql

from config.settings import settings

TARGET_SYMBOLS = ["NVDA", "TSLA", "AAPL", "GOOGL", "IBM", "MSFT", "AMZN", "META", "ORCL", "AVGO"]
SOURCE_TABLE = "instrument_data"
TARGET_TABLE = "instrument_data_fix"

_DT_RE = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$")


def _parse_dt(raw: object) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%Y-%m-%d":
                dt = dt.replace(hour=0, minute=0, second=0)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return None


def _parse_dt_from_slug(slug: object) -> Optional[str]:
    if slug is None:
        return None
    m = _DT_RE.search(str(slug))
    if not m:
        return None
    return _parse_dt(m.group(1))


def _ensure_table(cur: pymysql.cursors.Cursor) -> None:
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TARGET_TABLE} (
            id CHAR(36) NOT NULL,
            instrument_period_id CHAR(36) NOT NULL,
            timestamps DATETIME NOT NULL,
            open DECIMAL(20,10) NULL,
            high DECIMAL(20,10) NULL,
            low DECIMAL(20,10) NULL,
            close DECIMAL(20,10) NULL,
            volume BIGINT UNSIGNED NULL,
            source VARCHAR(255) NULL,
            slug VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NULL,
            updated_at TIMESTAMP NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_fix_period_ts (instrument_period_id, timestamps),
            KEY idx_fix_period_ts (instrument_period_id, timestamps),
            KEY idx_fix_period_ts_vol (instrument_period_id, timestamps, volume),
            KEY idx_fix_slug (slug),
            KEY idx_fix_source (source),
            KEY idx_fix_ts (timestamps)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def main() -> None:
    conn = pymysql.connect(**settings.DB_CONFIG)
    try:
        with conn.cursor() as cur:
            _ensure_table(cur)

            placeholders = ",".join(["%s"] * len(TARGET_SYMBOLS))
            cur.execute(
                f"""
                SELECT
                    d.id, d.instrument_period_id, d.timestamps, d.open, d.high, d.low, d.close, d.volume,
                    d.source, d.slug, d.created_at, d.updated_at
                FROM {SOURCE_TABLE} d
                INNER JOIN instrument_periods p ON p.id = d.instrument_period_id
                WHERE UPPER(TRIM(p.prefix)) IN ({placeholders})
                """,
                TARGET_SYMBOLS,
            )
            rows = cur.fetchall()

        values = []
        skipped = 0
        for r in rows:
            ts = _parse_dt(r.get("timestamps")) or _parse_dt_from_slug(r.get("slug"))
            if ts is None:
                skipped += 1
                continue
            values.append(
                (
                    str(r["id"]),
                    str(r["instrument_period_id"]),
                    ts,
                    r.get("open"),
                    r.get("high"),
                    r.get("low"),
                    r.get("close"),
                    r.get("volume"),
                    r.get("source"),
                    r.get("slug"),
                    r.get("created_at"),
                    r.get("updated_at"),
                )
            )

        if not values:
            print("No rows to copy.")
            return

        with conn.cursor() as cur:
            cur.executemany(
                f"""
                INSERT INTO {TARGET_TABLE}
                    (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    open=VALUES(open),
                    high=VALUES(high),
                    low=VALUES(low),
                    close=VALUES(close),
                    volume=VALUES(volume),
                    source=VALUES(source),
                    slug=VALUES(slug),
                    updated_at=VALUES(updated_at)
                """,
                values,
            )
            conn.commit()

        print(f"Copied {len(values)} rows into {TARGET_TABLE}. Skipped {skipped} rows with invalid timestamps.")
        print("Next step: swap table names in DB so app continues using `instrument_data` without code changes.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

