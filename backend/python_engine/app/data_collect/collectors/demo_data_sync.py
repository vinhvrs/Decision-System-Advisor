"""
Demo mirror sync: Yahoo daily bars → ``instrument_data_demo`` + JSON rows in
``snapshot_daily``, ``snapshot_monthly``, ``snapshot_annual``.

Symbol universe: ``snapshot_demo`` (same as ``stock_sync.DSATurbo``).
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import pymysql
import yfinance as yf

from config.settings import settings
from snapshot_build import _max_candles, _upsert_snapshot

from app.data_collect.collectors.stock_sync import (
    SNAPSHOT_SYMBOL_TABLE,
    ensure_snapshot_demo_table,
)

logger = logging.getLogger(__name__)

INSTRUMENT_PERIOD_DEMO = "instrument_period_demo"
INSTRUMENT_DATA_DEMO = "instrument_data_demo"

DEMO_SNAPSHOT_TABLES = (
    "snapshot_daily",
    "snapshot_monthly",
    "snapshot_annual",
)

REQUIRED_TABLES = (
    SNAPSHOT_SYMBOL_TABLE,
    INSTRUMENT_PERIOD_DEMO,
    INSTRUMENT_DATA_DEMO,
) + DEMO_SNAPSHOT_TABLES


def ensure_demo_sync_tables(conn: pymysql.connections.Connection) -> None:
    """Require all demo target tables to exist in the active schema."""
    missing: List[str] = []
    with conn.cursor() as cur:
        for name in REQUIRED_TABLES:
            cur.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = %s
                LIMIT 1
                """,
                (name,),
            )
            if not cur.fetchone():
                missing.append(name)
    if missing:
        raise RuntimeError(
            "Missing table(s) in this database: "
            + ", ".join(f"`{n}`" for n in missing)
            + ". Run migrations / create them before demo sync."
        )


def _snapshot_symbol(symbol: str) -> str:
    """``snapshot_*`` columns use ``varchar(16)``."""
    s = (symbol or "").strip().upper()
    return s[:16] if len(s) > 16 else s


def _df_to_candles(df: pd.DataFrame, *, max_candles: int) -> List[Dict[str, Any]]:
    """Oldest → newest candle list for JSON snapshot tables."""
    if df is None or df.empty:
        return []
    work = df.sort_index()
    rows: List[Dict[str, Any]] = []
    for dt, row in work.iterrows():
        dt_str = pd.Timestamp(dt).strftime("%Y-%m-%d 00:00:00")
        rows.append(
            {
                "timestamp": dt_str,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]),
            }
        )
    if len(rows) > max_candles:
        rows = rows[-max_candles:]
    return rows


class DSADemoSync:
    def __init__(
        self,
        snapshot_limit: Optional[int] = None,
        *,
        backfill_days: Optional[int] = None,
        history_period: str = "7d",
    ):
        """
        ``snapshot_limit``: max rows from ``snapshot_demo`` ordered by volume.
        ``None`` → ``settings.TOP_N``.

        ``backfill_days``: if set, fetch daily bars from (now − N days) through today.

        ``history_period``: yfinance ``period`` when ``backfill_days`` is ``None``.
        """
        try:
            self.snapshot_limit = snapshot_limit
            self.backfill_days = backfill_days
            self.history_period = history_period
            self.db_config = settings.DB_CONFIG.copy()
            self.db_config["cursorclass"] = pymysql.cursors.DictCursor
            self.conn = pymysql.connect(**self.db_config)
            self.conn.autocommit(False)
            print(f"Connected to DB: {self.db_config['database']}")
        except Exception as e:
            print(f"DB connection error: {e}")
            raise SystemExit(1) from e

    def generate_slug(self, symbol: str, period: str, dt_obj) -> str:
        time_part = dt_obj.strftime("%Y-%m-%d 00:00:00")
        return f"{symbol.lower()}-{period.lower()}-{time_part}"

    def fetch_symbols(self):
        ensure_snapshot_demo_table(self.conn)
        ensure_demo_sync_tables(self.conn)
        with self.conn.cursor() as cur:
            sql = f"""
                SELECT i.id, i.symbol
                FROM {SNAPSHOT_SYMBOL_TABLE} s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.volume DESC
                LIMIT %s
            """
            limit = (
                self.snapshot_limit
                if self.snapshot_limit is not None
                else getattr(settings, "TOP_N", 500)
            )
            cur.execute(sql, (limit,))
            return cur.fetchall()

    def ensure_periods_demo(self, inst_id, symbol):
        periods = ["daily", "weekly", "monthly", "yearly"]
        p_ids = {}
        with self.conn.cursor() as cur:
            for p in periods:
                p_slug = f"{symbol.lower()}-{p}"
                cur.execute(
                    f"""
                    INSERT INTO {INSTRUMENT_PERIOD_DEMO}
                        (id, instrument_id, period, market, slug, prefix)
                    VALUES (%s, %s, %s, 'stock', %s, %s)
                    ON DUPLICATE KEY UPDATE id=id
                    """,
                    (str(uuid.uuid4()), inst_id, p, p_slug, symbol.lower()),
                )
                cur.execute(
                    f"SELECT id FROM {INSTRUMENT_PERIOD_DEMO} WHERE slug=%s",
                    (p_slug,),
                )
                result = cur.fetchone()
                p_ids[p] = result["id"]
        self.conn.commit()
        return p_ids

    def _execute_upsert_demo(self, values):
        with self.conn.cursor() as cur:
            sql = f"""INSERT INTO {INSTRUMENT_DATA_DEMO}
                     (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug, created_at, updated_at)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                     ON DUPLICATE KEY UPDATE
                        open=VALUES(open), high=VALUES(high), low=VALUES(low),
                        close=VALUES(close), volume=VALUES(volume),
                        updated_at=VALUES(updated_at)"""
            cur.executemany(sql, values)
        self.conn.commit()

    def _upsert_demo_snapshots(
        self,
        instrument_id: str,
        symbol: str,
        df: pd.DataFrame,
    ) -> None:
        if df is None or df.empty:
            return
        max_candles = _max_candles()
        sym_snap = _snapshot_symbol(symbol)

        daily_candles = _df_to_candles(df, max_candles=max_candles)

        idx = pd.to_datetime(df.index)
        df_m = df.copy()
        df_m.index = idx
        monthly = df_m.resample("MS").agg(
            {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}
        )
        monthly = monthly.dropna(how="any")
        yearly = df_m.resample("YS").agg(
            {"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"}
        )
        yearly = yearly.dropna(how="any")

        monthly_candles = _df_to_candles(monthly, max_candles=max_candles)
        yearly_candles = _df_to_candles(yearly, max_candles=max_candles)

        with self.conn.cursor() as cur:
            if daily_candles:
                _upsert_snapshot(
                    cur,
                    table_name="snapshot_daily",
                    instrument_id=str(instrument_id),
                    symbol=sym_snap,
                    candles=daily_candles,
                )
            if monthly_candles:
                _upsert_snapshot(
                    cur,
                    table_name="snapshot_monthly",
                    instrument_id=str(instrument_id),
                    symbol=sym_snap,
                    candles=monthly_candles,
                )
            if yearly_candles:
                _upsert_snapshot(
                    cur,
                    table_name="snapshot_annual",
                    instrument_id=str(instrument_id),
                    symbol=sym_snap,
                    candles=yearly_candles,
                )
        self.conn.commit()

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods_demo(inst_id, symbol)
        try:
            ticker = yf.Ticker(symbol)
            if self.backfill_days is not None:
                start = (
                    datetime.now() - timedelta(days=max(1, int(self.backfill_days)))
                ).strftime("%Y-%m-%d")
                df = ticker.history(start=start, interval="1d", auto_adjust=True)
            else:
                df = ticker.history(period=self.history_period, interval="1d", auto_adjust=True)
            if df.empty:
                return

            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            daily_values = []
            for dt, row in df.iterrows():
                dt_str = dt.strftime("%Y-%m-%d 00:00:00")
                slug = self.generate_slug(symbol, "daily", dt)
                daily_values.append(
                    (
                        str(uuid.uuid4()),
                        p_ids["daily"],
                        dt_str,
                        float(row["Open"]),
                        float(row["High"]),
                        float(row["Low"]),
                        float(row["Close"]),
                        int(row["Volume"]),
                        "yfinance_v3.5",
                        slug,
                        now_str,
                        now_str,
                    )
                )

            if daily_values:
                self._execute_upsert_demo(daily_values)

            self.aggregate_for_symbol(symbol, p_ids, df, now_str)
            self._upsert_demo_snapshots(inst_id, symbol, df)

        except Exception as e:
            print(f"Error {symbol}: {e}")
            self.conn.rollback()

    def aggregate_for_symbol(self, symbol, p_ids, df, now_str):
        df.index = pd.to_datetime(df.index)
        rules = {"weekly": "W-MON", "monthly": "MS", "yearly": "YS"}

        for p_type, rule in rules.items():
            agg = (
                df.resample(rule)
                .agg(
                    {
                        "Open": "first",
                        "High": "max",
                        "Low": "min",
                        "Close": "last",
                        "Volume": "sum",
                    }
                )
                .dropna()
            )

            agg_values = []
            for ts, row in agg.iterrows():
                dt_str = ts.strftime("%Y-%m-%d 00:00:00")
                slug = self.generate_slug(symbol, p_type, ts)
                agg_values.append(
                    (
                        str(uuid.uuid4()),
                        p_ids[p_type],
                        dt_str,
                        float(row["Open"]),
                        float(row["High"]),
                        float(row["Low"]),
                        float(row["Close"]),
                        int(row["Volume"]),
                        "agg_v3.5",
                        slug,
                        now_str,
                        now_str,
                    )
                )

            if agg_values:
                self._execute_upsert_demo(agg_values)

    def run(self):
        start_t = time.time()
        instruments = self.fetch_symbols()
        total = len(instruments)
        window = (
            f"{self.backfill_days}d calendar backfill"
            if self.backfill_days is not None
            else f"period={self.history_period}"
        )
        print(f"Starting Demo Sync ({window}) for {total} symbols → {INSTRUMENT_DATA_DEMO} + snapshots…")

        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst["symbol"].upper()
            self.update_stock(inst["id"], sym)
            elapsed = time.time() - start_time
            print(f"[{idx + 1}/{total}] {sym} synced ({elapsed:.2f}s)")

        self.conn.close()
        print(f"Done. Total time: {(time.time() - start_t) / 60:.2f} minutes.")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(
        description=(
            "Demo sync: Yahoo daily → instrument_data_demo and snapshot_daily / "
            "snapshot_monthly / snapshot_annual for symbols in snapshot_demo."
        )
    )
    p.add_argument(
        "--days",
        type=int,
        default=None,
        metavar="N",
        help="Calendar days of history. If omitted, uses --period (default 7d).",
    )
    p.add_argument(
        "--period",
        default="7d",
        help="yfinance period when --days is not set (default: 7d)",
    )
    args = p.parse_args()
    DSADemoSync(
        backfill_days=args.days,
        history_period=args.period,
    ).run()
