import os
import random
import sys
from datetime import UTC, datetime, timedelta
from typing import Iterable

import pymysql

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
from config.settings import settings


SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "V", "JNJ"]


def db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def clamp_score(value: float) -> float:
    return max(1.0, min(5.0, round(value, 2)))


def calc_advice(value: float, quality: float, growth: float, momentum: float, stability: float, sentiment: float) -> str:
    total = (value + quality + growth + momentum + stability + sentiment) / 6.0
    if total >= 4.1 and stability >= 3.6 and quality >= 4.0:
        return "BUY"
    if total >= 3.4:
        return "HOLD"
    return "WATCH"


def iter_rows(start_days_ago: int = 360, step_days: int = 30, points: int = 12) -> Iterable[tuple]:
    rng = random.Random(20260505)
    now = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    base_by_symbol = {
        "AAPL": (4.1, 4.8, 4.2, 3.6, 4.7, 4.0),
        "MSFT": (4.0, 4.9, 4.4, 3.7, 4.8, 4.1),
        "GOOGL": (4.2, 4.6, 4.2, 3.6, 4.5, 3.8),
        "AMZN": (3.7, 4.4, 4.6, 3.8, 4.1, 4.0),
        "NVDA": (2.8, 4.7, 4.9, 4.4, 3.4, 4.3),
        "TSLA": (3.0, 3.8, 4.1, 3.2, 2.8, 3.5),
        "META": (3.8, 4.5, 4.0, 3.6, 4.2, 3.8),
        "JPM": (4.1, 4.3, 3.5, 3.0, 4.4, 3.6),
        "V": (3.9, 4.7, 4.0, 3.4, 4.6, 3.8),
        "JNJ": (4.0, 4.4, 3.1, 2.7, 4.8, 3.4),
    }

    for i in range(points):
        as_of = now - timedelta(days=start_days_ago - i * step_days)
        for sym in SYMBOLS:
            b_value, b_quality, b_growth, b_momentum, b_stability, b_sentiment = base_by_symbol[sym]
            drift = (i / max(1, points - 1)) * 0.22
            value = clamp_score(b_value + rng.uniform(-0.16, 0.16) + drift * 0.35)
            quality = clamp_score(b_quality + rng.uniform(-0.10, 0.10))
            growth = clamp_score(b_growth + rng.uniform(-0.18, 0.18) + drift * 0.55)
            momentum = clamp_score(b_momentum + rng.uniform(-0.24, 0.24) + drift * 0.65)
            stability = clamp_score(b_stability + rng.uniform(-0.12, 0.12))
            sentiment = clamp_score(b_sentiment + rng.uniform(-0.20, 0.20) + drift * 0.20)
            advice = calc_advice(value, quality, growth, momentum, stability, sentiment)
            note = (
                "Good long-horizon setup."
                if advice == "BUY"
                else "Balanced profile; keep position sizing disciplined."
                if advice == "HOLD"
                else "Higher uncertainty; monitor before adding."
            )
            created_at = datetime.now(UTC).replace(tzinfo=None)
            updated_at = created_at
            yield (
                as_of,
                sym,
                value,
                quality,
                growth,
                momentum,
                stability,
                sentiment,
                advice,
                note,
                created_at,
                updated_at,
            )


def ensure_table(conn):
    sql = """
    CREATE TABLE IF NOT EXISTS history_advice (
      as_of_ts DATETIME NOT NULL,
      symbol VARCHAR(16) NOT NULL,
      value_score DECIMAL(4,2) NOT NULL,
      quality_score DECIMAL(4,2) NOT NULL,
      growth_score DECIMAL(4,2) NOT NULL,
      momentum_score DECIMAL(4,2) NOT NULL,
      stability_score DECIMAL(4,2) NOT NULL,
      sentiment_score DECIMAL(4,2) NOT NULL,
      advice ENUM('BUY','HOLD','WATCH') NOT NULL,
      note VARCHAR(255) NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      PRIMARY KEY (as_of_ts, symbol),
      KEY idx_history_advice_symbol (symbol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def upsert_rows(conn, rows: list[tuple]):
    sql = """
    INSERT INTO history_advice (
      as_of_ts, symbol, value_score, quality_score, growth_score, momentum_score, stability_score, sentiment_score,
      advice, note, created_at, updated_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
      value_score = VALUES(value_score),
      quality_score = VALUES(quality_score),
      growth_score = VALUES(growth_score),
      momentum_score = VALUES(momentum_score),
      stability_score = VALUES(stability_score),
      sentiment_score = VALUES(sentiment_score),
      advice = VALUES(advice),
      note = VALUES(note),
      updated_at = VALUES(updated_at)
    """
    with conn.cursor() as cur:
        cur.executemany(sql, rows)
    conn.commit()


def main():
    rows = list(iter_rows())
    conn = db_connect()
    try:
        ensure_table(conn)
        upsert_rows(conn, rows)
        print(f"history_advice synced: {len(rows)} rows for {len(SYMBOLS)} symbols.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
