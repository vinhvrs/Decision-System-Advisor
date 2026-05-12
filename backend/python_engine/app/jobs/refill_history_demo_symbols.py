import os
import sys
from typing import Dict, List

import pymysql
import yfinance as yf
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
from app.data_collect.collectors.demo_data_sync import DSADemoSync
from config.settings import settings


# Must match:
# - frontend: `DEMO_HISTORY_ADVICE_BASE` in `trading/history/page.tsx`
# - backend: `SYMBOLS` in `history_advice.py`
SYMBOLS: List[str] = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "V", "JNJ"]

# If we don't have enough daily points, UI sparklines/charts can appear empty and fall back to "derived" visuals.
MIN_DAILY_ROWS = 60

# Long backfill to ensure we have a full history window for the demo.
BACKFILL_DAYS = 3650


def db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def get_instrument_id(conn, symbol: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM instruments WHERE symbol=%s LIMIT 1", (symbol,))
        row = cur.fetchone()
        return row["id"] if row else None


def get_daily_rows(conn, symbol: str) -> int:
    with conn.cursor() as cur:
        sql = """
          SELECT COUNT(*) AS daily_rows
          FROM instruments i
          JOIN instrument_period_demo ip ON ip.instrument_id = i.id
          JOIN instrument_data_demo d ON d.instrument_period_id = ip.id
          WHERE ip.period = 'daily' AND i.symbol = %s
        """
        cur.execute(sql, (symbol,))
        row = cur.fetchone()
        return int(row["daily_rows"] or 0)


def main() -> None:
    conn = db_connect()
    try:
        daily_rows_by_symbol: Dict[str, int] = {s: get_daily_rows(conn, s) for s in SYMBOLS}

        missing = [s for s in SYMBOLS if daily_rows_by_symbol.get(s, 0) < MIN_DAILY_ROWS]
        print("Daily rows (before):")
        for s in SYMBOLS:
            print(f"  {s}: {daily_rows_by_symbol.get(s, 0)}")

        if not missing:
            print(f"All demo symbols have >= {MIN_DAILY_ROWS} daily rows. No refill needed.")
            return

        print(f"Refilling missing/insufficient symbols (min_daily_rows={MIN_DAILY_ROWS}): {missing}")

        demo = DSADemoSync(backfill_days=BACKFILL_DAYS)
        try:
            for sym in missing:
                inst_id = get_instrument_id(conn, sym)
                if not inst_id:
                    print(f"  [skip] {sym}: instrument not found in `instruments` table")
                    continue

                # Quick sanity check: if yfinance returns empty, DB won't be refilled either.
                test_start = (datetime.now() - timedelta(days=120)).strftime("%Y-%m-%d")
                try:
                    df_test = yf.Ticker(sym).history(start=test_start, interval="1d", auto_adjust=True)
                    print(f"  [yfinance] {sym}: empty={df_test.empty} rows={len(df_test)} (start={test_start})")
                except Exception as e:
                    print(f"  [yfinance] {sym}: smoke-test error: {e}")

                print(f"  [refill] {sym} (instrument_id={inst_id}) ...")
                demo.update_stock(inst_id, sym)
                daily_rows_by_symbol[sym] = get_daily_rows(conn, sym)
                print(f"  [done] {sym}: daily_rows={daily_rows_by_symbol[sym]}")
        finally:
            try:
                demo.conn.close()
            except Exception:
                pass
    finally:
        conn.close()


if __name__ == "__main__":
    main()

