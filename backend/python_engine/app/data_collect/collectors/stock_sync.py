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

# Symbol universe for DSATurbo sync follows the DEV_MODE-resolved snapshot table.
from app.config.dsa_tables import table as dsa_table
from app.data_collect.history_policy import choose_history_fetch_plan


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


SNAPSHOT_SYMBOL_TABLE = snapshot_symbol_table()

DEFAULT_HISTORY_PRIORITY_SYMBOLS = (
    "AMD", "ADBE", "CRM", "CSCO", "ASML",
    "INTU", "QCOM", "NOW", "PANW", "SNOW",
)


def history_priority_symbols() -> list[str]:
    raw = os.environ.get(
        "HISTORY_PRIORITY_SYMBOLS",
        ",".join(DEFAULT_HISTORY_PRIORITY_SYMBOLS),
    )
    return list(dict.fromkeys(
        s.strip().upper()
        for s in raw.split(",")
        if s and s.strip()
    ))


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
        symbols: Optional[list[str]] = None,
    ):
        """
        ``snapshot_limit``: requested rows from the DEV_MODE-resolved market snapshot universe.
        Sparse snapshots are filled from the stock instrument catalog up to this limit.

        ``backfill_days``: if set, fetch daily bars from (now − N days) through today (overrides ``history_period``).

        ``history_period``: yfinance ``period`` when ``backfill_days`` is ``None`` (scheduled sync uses default ``7d``).
        """
        try:
            self.snapshot_limit = snapshot_limit
            self.backfill_days = backfill_days
            self.history_period = history_period
            self.bootstrap_min_bars = max(
                2,
                int(os.environ.get("HISTORY_BOOTSTRAP_MIN_BARS", "180")),
            )
            self.bootstrap_days = max(
                30,
                int(os.environ.get("HISTORY_BOOTSTRAP_DAYS", "3650")),
            )
            self.symbols = list(dict.fromkeys(
                str(symbol).strip().upper()
                for symbol in (symbols or [])
                if symbol and str(symbol).strip()
            ))
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
            ensure_snapshot_symbol_table(self.conn)

            if self.symbols:
                placeholders = ",".join(["%s"] * len(self.symbols))
                cur.execute(
                    f"""
                    SELECT id, symbol
                    FROM instruments
                    WHERE type = 'stock'
                      AND UPPER(TRIM(symbol)) IN ({placeholders})
                    """,
                    self.symbols,
                )
                by_symbol = {
                    str(row["symbol"]).strip().upper(): row
                    for row in (cur.fetchall() or [])
                    if row.get("symbol")
                }
                # Preserve the caller's requested order and ignore unknown symbols.
                return [by_symbol[sym] for sym in self.symbols if sym in by_symbol]

            limit = (
                self.snapshot_limit
                if self.snapshot_limit is not None
                else getattr(settings, "TOP_N", 500)
            )
            limit = max(1, min(int(limit), 500))

            # Prefer the ranked snapshot universe, but do not let an old/sparse
            # snapshot permanently cap OHLC persistence below the requested board
            # size. Fill the remainder from the stock instrument catalog.
            sql = f"""
                SELECT i.id, i.symbol
                FROM {SNAPSHOT_SYMBOL_TABLE} s
                JOIN instruments i ON s.instrument_id = i.id
                WHERE i.type = 'stock'
                ORDER BY s.volume DESC, i.symbol ASC
                LIMIT %s
            """
            cur.execute(sql, (limit,))
            rows = list(cur.fetchall() or [])

            if len(rows) >= limit:
                return rows

            selected_ids = {str(row["id"]) for row in rows if row.get("id")}
            selected_symbols = {
                str(row["symbol"]).strip().upper()
                for row in rows
                if row.get("symbol")
            }
            remaining = limit - len(rows)
            if remaining <= 0:
                return rows

            # First recover the board symbols that the realtime layer historically
            # allowed even when they had no persisted OHLC.
            priority = [
                sym for sym in history_priority_symbols()
                if sym not in selected_symbols
            ]
            if priority and remaining > 0:
                ph = ",".join(["%s"] * len(priority))
                cur.execute(
                    f"""
                    SELECT id, symbol
                    FROM instruments
                    WHERE type = 'stock'
                      AND UPPER(TRIM(symbol)) IN ({ph})
                    ORDER BY symbol ASC
                    """,
                    priority,
                )
                for row in (cur.fetchall() or []):
                    iid = str(row.get("id") or "")
                    sym = str(row.get("symbol") or "").strip().upper()
                    if not iid or iid in selected_ids or sym in selected_symbols:
                        continue
                    rows.append(row)
                    selected_ids.add(iid)
                    selected_symbols.add(sym)
                    remaining -= 1
                    if remaining <= 0:
                        return rows

            # Then bootstrap any remaining stock instruments. Once daily OHLC
            # exists, snapshot/ranking can rank them normally.
            if selected_ids:
                placeholders = ",".join(["%s"] * len(selected_ids))
                cur.execute(
                    f"""
                    SELECT id, symbol
                    FROM instruments
                    WHERE type = 'stock'
                      AND id NOT IN ({placeholders})
                    ORDER BY symbol ASC
                    LIMIT %s
                    """,
                    (*selected_ids, remaining),
                )
            else:
                cur.execute(
                    """
                    SELECT id, symbol
                    FROM instruments
                    WHERE type = 'stock'
                    ORDER BY symbol ASC
                    LIMIT %s
                    """,
                    (remaining,),
                )

            rows.extend(cur.fetchall() or [])
            return rows

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

    def persisted_daily_bar_count(self, daily_period_id: str) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM instrument_data WHERE instrument_period_id=%s",
                (daily_period_id,),
            )
            row = cur.fetchone() or {}
        try:
            return max(0, int(row.get("n") or 0))
        except (TypeError, ValueError):
            return 0

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        try:
            ticker = yf.Ticker(symbol)
            existing_daily_bars = self.persisted_daily_bar_count(p_ids["daily"])
            plan = choose_history_fetch_plan(
                existing_daily_bars=existing_daily_bars,
                backfill_days=self.backfill_days,
                history_period=self.history_period,
                bootstrap_min_bars=self.bootstrap_min_bars,
                bootstrap_days=self.bootstrap_days,
            )

            if plan.days is not None:
                fetch_days = int(plan.days)
                start = (datetime.now() - timedelta(days=fetch_days)).strftime("%Y-%m-%d")
                df = ticker.history(start=start, interval="1d", auto_adjust=True)
                fetch_mode = (
                    f"{plan.mode}:{fetch_days}d existing={existing_daily_bars} "
                    f"min={self.bootstrap_min_bars}"
                )
            else:
                fetch_period = str(plan.period or self.history_period)
                df = ticker.history(period=fetch_period, interval="1d", auto_adjust=True)
                fetch_mode = f"{plan.mode}:{fetch_period}"

            logger.info("OHLC sync %s mode=%s", symbol, fetch_mode)
            if df.empty:
                logger.warning("OHLC sync %s returned no daily bars (%s)", symbol, fetch_mode)
                return

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
            else (
                f"coverage-aware: bootstrap={self.bootstrap_days}d "
                f"until >= {self.bootstrap_min_bars} daily bars; "
                f"then incremental period={self.history_period}"
            )
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
        description="Turbo sync: Yahoo daily → instrument_data for the resolved market universe."
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
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum snapshot/catalog symbols to sync (e.g. 40).",
    )
    p.add_argument(
        "--symbols",
        default="",
        help="Comma-separated exact symbols for targeted backfill; overrides --limit universe selection.",
    )
    args = p.parse_args()
    wanted = [
        s.strip().upper()
        for s in str(args.symbols or "").split(",")
        if s.strip()
    ]
    DSA_TURBO = DSATurbo(
        snapshot_limit=args.limit,
        backfill_days=args.days,
        history_period=args.period,
        symbols=wanted or None,
    )
    DSA_TURBO.run()