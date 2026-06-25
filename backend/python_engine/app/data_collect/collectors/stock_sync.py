import hashlib
import logging
import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime, timedelta
from typing import Optional
import os
import sys

# Repo root for config import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from config.settings import settings

logger = logging.getLogger(__name__)

# Symbol universe for DSATurbo sync follows DEV_MODE (snapshot_demo or instrument_snapshot).
from app.config.dsa_tables import table as dsa_table


def snapshot_symbol_table() -> str:
    return dsa_table("instrument_snapshot")


def ensure_snapshot_symbol_table(conn: pymysql.connections.Connection) -> None:
    table_name = snapshot_symbol_table()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = %s
            LIMIT 1
            """,
            (table_name,),
        )
        if not cur.fetchone():
            raise RuntimeError(
                f"Table `{table_name}` not found in this database. "
                "Create and populate it before running stock sync."
            )


# Backward-compatible alias
ensure_snapshot_demo_table = ensure_snapshot_symbol_table
SNAPSHOT_SYMBOL_TABLE = snapshot_symbol_table()


def _doc_id_corporate(symbol: str, title: str, published_at, url: str) -> str:
    raw = f"{(symbol or '').strip().upper()}|{title}|{published_at}|{url}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _save_corporate_knowledge_doc(
    conn,
    doc_id: str,
    symbol: str,
    title: str,
    content: str,
    published_at,
) -> None:
    """Persist Yahoo Finance corporate actions for display only (no price / inference pipeline)."""
    now = datetime.now()
    hash_key = doc_id if len(doc_id) == 32 else hashlib.md5(str(doc_id).encode("utf-8")).hexdigest()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT IGNORE INTO knowledge_docs
            (id, hash_key, title, content, published_at, image, category, symbol, source, author, language, created_at, updated_at, is_processed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                doc_id,
                hash_key,
                title,
                content,
                published_at,
                None,
                "article",
                symbol,
                "YFinance_Action",
                None,
                "en",
                now,
                now,
                0,
            ),
        )


def _corporate_actions_frame(tk: yf.Ticker) -> pd.DataFrame:
    """Yahoo dividends/splits; ``tk.actions`` can raise on delisted/invalid symbols (yfinance bug)."""
    try:
        actions = tk.actions
        if actions is not None and not actions.empty:
            return actions
    except AttributeError:
        pass
    except Exception as e:
        logger.debug("tk.actions failed for %s: %s", getattr(tk, "ticker", "?"), e)

    frames: list[pd.DataFrame] = []
    try:
        divs = tk.dividends
        if divs is not None and not divs.empty:
            d = divs.to_frame(name="Dividends")
            d["Stock Splits"] = 0.0
            frames.append(d)
    except Exception:
        pass
    try:
        splits = tk.splits
        if splits is not None and not splits.empty:
            s = splits.to_frame(name="Stock Splits")
            s["Dividends"] = 0.0
            frames.append(s)
    except Exception:
        pass
    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames).sort_index()
    if "Dividends" not in out.columns:
        out["Dividends"] = 0.0
    if "Stock Splits" not in out.columns:
        out["Stock Splits"] = 0.0
    return out


def sync_corporate_actions(
    symbol: str,
    company_name: str,
    start_dt: Optional[datetime] = None,
    end_dt: Optional[datetime] = None,
) -> None:
    """
    Yahoo Finance dividends / splits → ``knowledge_docs`` only (display in UI).
    """
    _ = company_name
    logger.info("Corporate actions (DB only): %s", symbol)
    try:
        tk = yf.Ticker(symbol)
        actions = _corporate_actions_frame(tk)
        if actions.empty:
            return

        if start_dt is not None:
            idx = actions.index
            if idx.tz is not None and start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=idx.tz)
            actions = actions[actions.index >= start_dt]
        if end_dt is not None:
            idx = actions.index
            if idx.tz is not None and end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=idx.tz)
            actions = actions[actions.index <= end_dt]

        if actions.empty:
            return

        conn = _db_connect()
        try:
            for date, row in actions.iterrows():
                event_type = "Dividend" if row.get("Dividends", 0) > 0 else "Stock Split"
                value = row.get("Dividends", 0) if event_type == "Dividend" else row.get("Stock Splits", 0)
                title = f"[{symbol}] Corporate Action: {event_type} of {value}"
                doc_id = _doc_id_corporate(symbol, title, date, "YFinance_Action")
                _save_corporate_knowledge_doc(
                    conn,
                    doc_id=doc_id,
                    symbol=symbol,
                    title=title,
                    content=f"Official corporate action data from Yahoo Finance: {event_type} of {value}",
                    published_at=date,
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        msg = str(e).lower()
        if isinstance(e, AttributeError) and "_dividends" in msg:
            logger.warning("Corporate actions skipped for %s (invalid/delisted symbol): %s", symbol, e)
        else:
            logger.warning("Corporate action error for %s: %s", symbol, e)


class DSATurbo:
    def __init__(
        self,
        snapshot_limit: Optional[int] = None,
        *,
        backfill_days: Optional[int] = None,
        history_period: str = "7d",
    ):
        """
        ``snapshot_limit``: max rows from ``snapshot_demo`` ordered by volume.
        ``None`` → ``settings.TOP_N`` (capped by how many rows exist in ``snapshot_demo``).

        ``backfill_days``: if set, fetch daily bars from (now − N days) through today (overrides ``history_period``).

        ``history_period``: yfinance ``period`` when ``backfill_days`` is ``None`` (scheduled sync uses default ``7d``).
        """
        try:
            self.snapshot_limit = snapshot_limit
            self.backfill_days = backfill_days
            self.history_period = history_period
            self.db_config = settings.DB_CONFIG.copy()
            self.db_config['cursorclass'] = pymysql.cursors.DictCursor
            self.conn = pymysql.connect(**self.db_config)
            self.conn.autocommit(False) 
            print(f"Connected to DB: {self.db_config['database']}")
        except Exception as e:
            print(f"DB connection error: {e}")
            exit(1)

    def generate_slug(self, symbol, period, dt_obj):
        """Slug: symbol-period-YYYY-MM-DD 00:00:00 (e.g. aapl-daily-2023-10-27 00:00:00)."""
        time_part = dt_obj.strftime('%Y-%m-%d 00:00:00')
        return f"{symbol.lower()}-{period.lower()}-{time_part}"

    def fetch_symbols(self):
        with self.conn.cursor() as cur:
            ensure_snapshot_demo_table(self.conn)
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

    def ensure_periods(self, inst_id, symbol):
        periods = ['daily', 'weekly', 'monthly', 'yearly']
        p_ids = {}
        with self.conn.cursor() as cur:
            for p in periods:
                p_slug = f"{symbol.lower()}-{p}"
                cur.execute("""
                    INSERT INTO instrument_periods (id, instrument_id, period, market, slug, prefix) 
                    VALUES (%s, %s, %s, 'stock', %s, %s)
                    ON DUPLICATE KEY UPDATE id=id
                """, (str(uuid.uuid4()), inst_id, p, p_slug, symbol.lower()))
                
                cur.execute("SELECT id FROM instrument_periods WHERE slug=%s", (p_slug,))
                result = cur.fetchone()
                p_ids[p] = result['id']
        self.conn.commit()
        return p_ids

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        try:
            ticker = yf.Ticker(symbol)
            if self.backfill_days is not None:
                start = (datetime.now() - timedelta(days=max(1, int(self.backfill_days)))).strftime("%Y-%m-%d")
                df = ticker.history(start=start, interval="1d", auto_adjust=True)
            else:
                df = ticker.history(period=self.history_period, interval="1d", auto_adjust=True)
            if df.empty: return

            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Daily rows
            daily_values = []
            for dt, row in df.iterrows():
                dt_str = dt.strftime('%Y-%m-%d 00:00:00')
                # Slug includes period name
                slug = self.generate_slug(symbol, 'daily', dt)
                
                daily_values.append((
                    str(uuid.uuid4()), p_ids['daily'], dt_str, 
                    float(row['Open']), float(row['High']), float(row['Low']), float(row['Close']), 
                    int(row['Volume']), 'yfinance_v3.5', slug,
                    now_str, now_str
                ))

            if daily_values:
                self._execute_upsert(daily_values)

            # Resampled weekly / monthly / yearly
            self.aggregate_for_symbol(symbol, p_ids, df, now_str)

        except Exception as e:
            print(f"Error {symbol}: {e}")
            self.conn.rollback()

    def _execute_upsert(self, values):
        with self.conn.cursor() as cur:
            sql = """INSERT INTO instrument_data 
                     (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug, created_at, updated_at)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                     ON DUPLICATE KEY UPDATE 
                        open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                        close=VALUES(close), volume=VALUES(volume), 
                        updated_at=VALUES(updated_at)"""
            cur.executemany(sql, values)
        self.conn.commit()

    def aggregate_for_symbol(self, symbol, p_ids, df, now_str):
        df.index = pd.to_datetime(df.index)
        # W-MON week start Monday; MS month start; YS year start
        rules = {'weekly': 'W-MON', 'monthly': 'MS', 'yearly': 'YS'}
        
        for p_type, rule in rules.items():
            agg = df.resample(rule).agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
            
            agg_values = []
            for ts, row in agg.iterrows():
                dt_str = ts.strftime('%Y-%m-%d 00:00:00')
                # Slug encodes aggregation period
                slug = self.generate_slug(symbol, p_type, ts)
                
                agg_values.append((
                    str(uuid.uuid4()), p_ids[p_type], dt_str, 
                    float(row['Open']), float(row['High']), float(row['Low']), float(row['Close']), 
                    int(row['Volume']), 'agg_v3.5', slug,
                    now_str, now_str
                ))
            
            if agg_values:
                self._execute_upsert(agg_values)

    def run(self):
        start_turbo = time.time()
        instruments = self.fetch_symbols()
        total = len(instruments)
        window = (
            f"{self.backfill_days}d calendar backfill"
            if self.backfill_days is not None
            else f"period={self.history_period}"
        )
        print(f"Starting Turbo Sync v3.5 ({window}) for {total} symbols...")
        
        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst['symbol'].upper()
            self.update_stock(inst['id'], sym)
            elapsed = time.time() - start_time
            print(f"[{idx+1}/{total}] {sym} synced ({elapsed:.2f}s)")
            
        self.conn.close()
        print(f"Done. Total time: {(time.time() - start_turbo)/60:.2f} minutes.")

if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(
        description="Turbo sync: Yahoo daily → instrument_data for symbols listed in snapshot_demo."
    )
    p.add_argument(
        "--days",
        type=int,
        default=None,
        metavar="N",
        help="Calendar days of history (e.g. 30). If omitted, uses --period (default 7d).",
    )
    p.add_argument(
        "--period",
        default="7d",
        help="yfinance period when --days is not set (default: 7d)",
    )
    args = p.parse_args()
    DSA_TURBO = DSATurbo(
        backfill_days=args.days,
        history_period=args.period,
    )
    DSA_TURBO.run()