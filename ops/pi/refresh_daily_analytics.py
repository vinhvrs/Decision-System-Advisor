"""Maintain a separate, source-labelled Yahoo daily window for public demo analytics."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import math
import time

import yfinance as yf

from app.config.market_universe import ASSETS
from app.config.source_policy import require_yahoo_dev
from app.metrics.storage import connection

TABLE = "market_analytics_daily_bars"


def fetch(asset):
    end = datetime.now(ZoneInfo(asset.timezone)).date()
    start = end - timedelta(days=1950)
    data = yf.Ticker(asset.symbol).history(
        start=start.isoformat(), end=end.isoformat(), interval="1d",
        auto_adjust=True, actions=False, timeout=15, raise_errors=True,
    )
    records = {}
    observed = datetime.now(timezone.utc).replace(tzinfo=None)
    for date, item in data.iterrows():
        day = date.date()
        if not start <= day < end:
            continue
        o, h, low, c = (float(item[key]) for key in ("Open", "High", "Low", "Close"))
        if not all(math.isfinite(v) and v > 0 for v in (o, h, low, c)) or not (low <= min(o, c) <= max(o, c) <= h):
            continue
        volume = float(item["Volume"])
        volume = int(volume) if asset.volume_type != "NONE" and math.isfinite(volume) and volume > 0 else None
        records[day] = (asset.symbol, day, o, c, h, low, volume, "YFINANCE_DEV", observed)
    if not records:
        raise ValueError("empty_daily_history")
    return list(records.values())


def main():
    require_yahoo_dev()
    with connection() as conn, conn.cursor() as cur:
        cur.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
            symbol VARCHAR(16) NOT NULL, timestamps DATE NOT NULL,
            open DECIMAL(30,12) NULL, close DECIMAL(30,12) NOT NULL, high DECIMAL(30,12) NOT NULL, low DECIMAL(30,12) NOT NULL,
            volume BIGINT UNSIGNED NULL, source VARCHAR(32) NOT NULL, retrieved_at DATETIME NOT NULL,
            PRIMARY KEY (symbol, timestamps)
        ) ENGINE=InnoDB""")
        cur.execute(f"SHOW COLUMNS FROM {TABLE} LIKE 'open'")
        if cur.fetchone() is None:
            cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN open DECIMAL(30,12) NULL AFTER timestamps")
    completed = 0
    for asset in ASSETS:
        try:
            bars = fetch(asset)
            with connection() as conn, conn.cursor() as cur:
                cur.executemany(f"""INSERT INTO {TABLE}
                    (symbol,timestamps,open,close,high,low,volume,source,retrieved_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE open=VALUES(open), close=VALUES(close), high=VALUES(high), low=VALUES(low),
                    volume=VALUES(volume),source=VALUES(source),retrieved_at=VALUES(retrieved_at)""", bars)
            completed += 1
            print(f"{asset.symbol}: {len(bars)} stored, latest {max(row[1] for row in bars)}", flush=True)
        except Exception as exc:
            print(f"{asset.symbol}: {type(exc).__name__}; retained prior data", flush=True)
        time.sleep(0.35)
    print(f"Completed {completed}/{len(ASSETS)} symbols.", flush=True)
    raise SystemExit(int(completed != len(ASSETS)))


if __name__ == "__main__":
    main()
