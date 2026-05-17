"""
Daily refresh for the 10-symbol US tech universe using three MySQL tables:

- ``snapshot_demo`` — live quote row (price, volume, liquidity, change_pct)
- ``snapshot_daily`` — JSON candle history (via ``DSADemoSync``)
- ``company_facts_raw`` — SEC companyfacts + submissions (via ``fundamental_ingest``)

Run manually::

    python -m app.pipeline.tech_universe_daily
"""
from __future__ import annotations

import argparse
import logging
import time
from typing import Any

import pymysql
import pymysql.cursors

from app.data_collect.collectors.demo_data_sync import DSADemoSync
from app.data_collect.snapshot_demo_update import refresh_snapshot_demo_symbols
from app.pipeline.fundamental_ingest import SYMBOL_CIK, run_fundamental_ingest
from config.settings import settings

logger = logging.getLogger(__name__)

TECH_SYMBOLS = list(SYMBOL_CIK.keys())


def _load_instrument_ids(symbols: list[str]) -> dict[str, str]:
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    conn = pymysql.connect(**cfg)
    try:
        with conn.cursor() as cur:
            ph = ",".join(["%s"] * len(symbols))
            cur.execute(
                f"""
                SELECT id, UPPER(TRIM(symbol)) AS symbol
                FROM instruments
                WHERE UPPER(TRIM(symbol)) IN ({ph})
                """,
                symbols,
            )
            return {str(r["symbol"]): str(r["id"]) for r in (cur.fetchall() or [])}
    finally:
        conn.close()


def run_tech_universe_daily(
    *,
    symbols: list[str] | None = None,
    yf_period: str = "30d",
    use_macrotrends: bool = True,
    skip_sec: bool = False,
) -> dict[str, Any]:
    syms = [s.strip().upper() for s in (symbols or TECH_SYMBOLS) if s and str(s).strip()]
    out: dict[str, Any] = {"symbols": syms, "snapshot_demo": None, "snapshot_daily": {}, "fundamentals": None}

    logger.info("tech_universe_daily: snapshot_demo (%d symbols)", len(syms))
    out["snapshot_demo"] = refresh_snapshot_demo_symbols(syms, history_period="5d")

    id_by_sym = _load_instrument_ids(syms)
    demo = DSADemoSync(history_period=yf_period)
    try:
        for sym in syms:
            inst_id = id_by_sym.get(sym)
            if not inst_id:
                logger.warning("snapshot_daily skip — no instrument for %s", sym)
                out["snapshot_daily"][sym] = "no_instrument"
                continue
            try:
                demo.update_stock(inst_id, sym)
                out["snapshot_daily"][sym] = "ok"
                time.sleep(0.5)
            except Exception as e:
                logger.exception("snapshot_daily failed %s: %s", sym, e)
                out["snapshot_daily"][sym] = f"error:{e}"
    finally:
        demo.conn.close()

    if not skip_sec:
        logger.info("tech_universe_daily: SEC → company_facts_raw + metrics")
        run_fundamental_ingest(syms, use_macrotrends=use_macrotrends)
        out["fundamentals"] = "ok"
    else:
        out["fundamentals"] = "skipped"

    out["ok"] = True
    return out


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Daily tech universe: snapshot_demo + snapshot_daily + SEC")
    p.add_argument("--symbols", type=str, default=",".join(TECH_SYMBOLS))
    p.add_argument("--yf-period", type=str, default="30d", help="yfinance window for snapshot_daily candles")
    p.add_argument("--no-macrotrends", action="store_true")
    p.add_argument("--skip-sec", action="store_true", help="Only refresh market snapshots")
    args = p.parse_args(argv)
    wanted = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    result = run_tech_universe_daily(
        symbols=wanted,
        yf_period=args.yf_period,
        use_macrotrends=not args.no_macrotrends,
        skip_sec=args.skip_sec,
    )
    logger.info("done: %s", result)


if __name__ == "__main__":
    main()
