"""
Fetch OHLCV candles from Yahoo Finance for an explicit symbol list and upsert into ``instrument_data``
(via the same pipeline as ``stock_sync.DSATurbo``).

Run from ``python_engine`` root, e.g.::

    python -m app.data_collect.collectors.storage.symbol_data
    python -m app.data_collect.collectors.storage.symbol_data NVDA AAPL MSFT
    python -m app.data_collect.collectors.storage.symbol_data --period 2y TSLA META
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
import uuid
from pathlib import Path
from typing import Iterable, List, Sequence

# python_engine root: parents[0] == dir of this file; walk up storage→collectors→data_collect→app→python_engine
_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import yfinance as yf  # noqa: E402
from datetime import datetime  # noqa: E402

from app.data_collect.collectors.stock_sync import DSATurbo  # noqa: E402
from config.settings import settings  # noqa: E402

logger = logging.getLogger(__name__)

DEFAULT_SYMBOLS: List[str] = [
    "NVDA",
    "TSLA",
    "AAPL",
    "GOOGL",
    "IBM",
    "MSFT",
    "AMZN",
    "META",
    "ORCL",
    "AVGO",
]


class SymbolListCollector(DSATurbo):
    """Same as ``DSATurbo`` but with a configurable Yahoo history window (default one year daily)."""

    def __init__(self, snapshot_limit: int | None = None, history_period: str = "1y") -> None:
        super().__init__(snapshot_limit=snapshot_limit)
        self.history_period = history_period

    def update_stock(self, inst_id, symbol):  # type: ignore[override]
        p_ids = self.ensure_periods(inst_id, symbol)
        try:
            sym = (symbol or "").strip().upper()
            ticker = yf.Ticker(sym)
            df = ticker.history(period=self.history_period, interval="1d", auto_adjust=True)
            if df.empty:
                logger.warning("No Yahoo history for %s", sym)
                return

            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            daily_values = []
            for dt, row in df.iterrows():
                dt_str = dt.strftime("%Y-%m-%d 00:00:00")
                slug = self.generate_slug(sym, "daily", dt)
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
                        "yfinance_symbol_data",
                        slug,
                        now_str,
                        now_str,
                    )
                )

            if daily_values:
                self._execute_upsert(daily_values)

            self.aggregate_for_symbol(sym, p_ids, df, now_str)

        except Exception as e:
            logger.exception("Error updating %s: %s", symbol, e)
            self.conn.rollback()


def _normalize_symbols(raw: Sequence[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for s in raw:
        u = (s or "").strip().upper()
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def fetch_instrument_ids(collector: DSATurbo, symbols: Iterable[str]) -> dict[str, str]:
    syms = list(symbols)
    if not syms:
        return {}
    placeholders = ",".join(["%s"] * len(syms))
    sql = f"""
        SELECT i.id, UPPER(TRIM(i.symbol)) AS symbol
        FROM instruments i
        WHERE UPPER(TRIM(i.symbol)) IN ({placeholders})
    """
    with collector.conn.cursor() as cur:
        cur.execute(sql, syms)
        rows = cur.fetchall()
    return {str(r["symbol"]): str(r["id"]) for r in rows}


def run_symbol_list(
    symbols: Sequence[str],
    *,
    history_period: str = "1y",
) -> None:
    syms = _normalize_symbols(symbols)
    if not syms:
        print("No symbols to process.")
        return

    collector = SymbolListCollector(snapshot_limit=1, history_period=history_period)
    try:
        id_by_symbol = fetch_instrument_ids(collector, syms)
        total = len(syms)
        for idx, sym in enumerate(syms, start=1):
            inst_id = id_by_symbol.get(sym)
            if not inst_id:
                print(f"[{idx}/{total}] SKIP {sym} — not found in instruments table")
                continue
            t0 = time.time()
            collector.update_stock(inst_id, sym)
            print(f"[{idx}/{total}] {sym} OK ({time.time() - t0:.2f}s)")
    finally:
        collector.conn.close()
        print("Done.")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Ingest Yahoo daily candles for specific symbols.")
    parser.add_argument(
        "symbols",
        nargs="*",
        help="Ticker symbols (default: built-in demo list)",
    )
    parser.add_argument(
        "--period",
        default="1y",
        help="yfinance history period (default: 1y), e.g. 6mo, 2y, max",
    )
    args = parser.parse_args()
    symbols = args.symbols if args.symbols else DEFAULT_SYMBOLS
    print(f"DB: {settings.DB_CONFIG.get('database')} | symbols={len(symbols)} | yahoo_period={args.period}")
    run_symbol_list(symbols, history_period=args.period)


if __name__ == "__main__":
    main()
