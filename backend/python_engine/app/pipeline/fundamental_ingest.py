"""
Ingest SEC companyfacts + submissions for configured US tech symbols and persist to MySQL.

Run (from ``backend/python_engine``):

    python -m app.pipeline.fundamental_ingest
    python -m app.pipeline.fundamental_ingest --symbols AAPL,MSFT

Requires ``backend/.env`` database credentials and ``SEC_USER_AGENT`` (or default in ``sec_http``).
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Iterable

import pymysql
import pymysql.cursors

from app.analyze.fundamentals import (
    build_annual_tables,
    build_quarterly_tables,
    enrich_annual_with_filing_dates,
    parse_filings_from_submissions,
    parse_issuer_profile,
)
from app.data_collect.macrotrends import apply_macrotrends_gap_fill, fetch_macrotrends_bundle
from app.data_collect.sec_company_facts import fetch_company_facts
from app.data_collect.sec_submissions import fetch_submissions
from app.rules.fundamental_score import compute_fundamental_scores
from config.settings import settings

logger = logging.getLogger(__name__)

SYMBOL_CIK: dict[str, str] = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "NVDA": "0001045810",
    "TSLA": "0001318605",
    "GOOGL": "0001652044",
    "META": "0001326801",
    "AMZN": "0001018724",
    "IBM": "0000051143",
    "ORCL": "0001341439",
    "AVGO": "0001730168",
}

FILING_FORMS = {
    "10-K",
    "10-K/A",
    "10-Q",
    "10-Q/A",
    "8-K",
    "8-K/A",
    "20-F",
    "20-F/A",
}


def _conn():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _upsert_raw(cur, symbol: str, cik: str, payload_type: str, payload: dict[str, Any]) -> None:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    cur.execute(
        """
        INSERT INTO company_facts_raw (symbol, cik, payload_type, raw_json, fetched_at, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            cik = VALUES(cik),
            raw_json = VALUES(raw_json),
            fetched_at = VALUES(fetched_at),
            updated_at = VALUES(updated_at)
        """,
        (symbol.upper(), cik, payload_type, raw, _now(), _now(), _now()),
    )


def _upsert_issuer_profile(cur, symbol: str, cik: str, submissions: dict[str, Any]) -> None:
    row = parse_issuer_profile(submissions, symbol, cik)
    if not row:
        return
    sym = row["symbol"].upper()
    ts = _now()
    tickers_json = json.dumps(row.get("tickers") or [], separators=(",", ":"))
    exchanges_json = json.dumps(row.get("exchanges") or [], separators=(",", ":"))
    cur.execute(
        """
        INSERT INTO fundamental_issuer_profile (
            symbol, cik, company_name, tickers, exchanges, exchange, sic, sic_description, fiscal_year_end, created_at, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            cik=VALUES(cik),
            company_name=VALUES(company_name),
            tickers=VALUES(tickers),
            exchanges=VALUES(exchanges),
            exchange=VALUES(exchange),
            sic=VALUES(sic),
            sic_description=VALUES(sic_description),
            fiscal_year_end=VALUES(fiscal_year_end),
            updated_at=VALUES(updated_at)
        """,
        (
            sym,
            row.get("cik"),
            row.get("company_name"),
            tickers_json,
            exchanges_json,
            row.get("exchange"),
            row.get("sic"),
            row.get("sic_description"),
            row.get("fiscal_year_end"),
            ts,
            ts,
        ),
    )


def _delete_metrics_for_symbol(cur, symbol: str) -> None:
    sym = symbol.upper()
    cur.execute("DELETE FROM fundamental_data_annual WHERE symbol=%s", (sym,))
    cur.execute("DELETE FROM fundamental_data_quarterly WHERE symbol=%s", (sym,))
    cur.execute("DELETE FROM company_filings WHERE symbol=%s", (sym,))


def _insert_filings(cur, rows: Iterable[dict[str, Any]]) -> None:
    sql = """
        INSERT INTO company_filings (symbol, form, accession_number, filing_date, report_date, primary_document, filing_url, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            filing_date=VALUES(filing_date),
            report_date=VALUES(report_date),
            primary_document=VALUES(primary_document),
            filing_url=VALUES(filing_url),
            updated_at=VALUES(updated_at)
    """
    ts = _now()
    for r in rows:
        form = str(r.get("form") or "")
        if form and form not in FILING_FORMS:
            continue
        cur.execute(
            sql,
            (
                r["symbol"],
                form,
                r["accession_number"],
                r.get("filing_date"),
                r.get("report_date"),
                r.get("primary_document"),
                r.get("filing_url"),
                ts,
                ts,
            ),
        )


ANNUAL_COLS = [
    "symbol",
    "fiscal_year",
    "period_end",
    "filing_date",
    "source",
    "revenue",
    "net_income",
    "gross_profit",
    "operating_income",
    "eps_diluted",
    "assets",
    "liabilities",
    "equity",
    "cash",
    "total_debt",
    "current_assets",
    "current_liabilities",
    "inventory",
    "accounts_receivable",
    "cost_of_revenue",
    "operating_cash_flow",
    "capex",
    "fcf",
    "interest_expense",
    "dividends_paid",
    "shares_outstanding",
    "public_float",
    "gross_margin",
    "operating_margin",
    "net_margin",
    "roe",
    "debt_equity",
    "current_ratio",
    "asset_turnover",
    "dso",
    "dio",
    "interest_coverage",
    "revenue_cagr_3y",
    "revenue_cagr_5y",
    "revenue_cagr_10y",
    "net_income_cagr_3y",
    "net_income_cagr_5y",
    "net_income_cagr_10y",
    "fcf_cagr_3y",
    "fcf_cagr_5y",
    "fcf_cagr_10y",
]


def _insert_annual_rows(cur, symbol: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    sym = symbol.upper()
    placeholders = ",".join(["%s"] * len(ANNUAL_COLS))
    sql = f"INSERT INTO fundamental_data_annual ({','.join(ANNUAL_COLS)}, created_at, updated_at) VALUES ({placeholders},%s,%s)"
    ts = _now()
    for r in rows:
        values = (sym,) + tuple(r.get(c) for c in ANNUAL_COLS[1:])
        cur.execute(sql, values + (ts, ts))


def _insert_quarterly_rows(cur, symbol: str, rows: list[dict[str, Any]]) -> None:
    cols = [
        "symbol",
        "fiscal_year",
        "fiscal_quarter",
        "period_end",
        "filing_date",
        "source",
        "revenue",
        "net_income",
        "gross_profit",
        "operating_income",
        "eps_diluted",
        "assets",
        "liabilities",
        "equity",
        "cash",
        "total_debt",
        "current_assets",
        "current_liabilities",
        "inventory",
        "accounts_receivable",
        "cost_of_revenue",
        "operating_cash_flow",
        "capex",
        "fcf",
        "interest_expense",
        "dividends_paid",
        "shares_outstanding",
        "gross_margin",
        "operating_margin",
        "net_margin",
        "roe",
        "debt_equity",
        "current_ratio",
    ]
    if not rows:
        return
    sym = symbol.upper()
    ph = ",".join(["%s"] * len(cols))
    sql = f"INSERT INTO fundamental_data_quarterly ({','.join(cols)}, created_at, updated_at) VALUES ({ph},%s,%s)"
    ts = _now()
    for r in rows:
        values = (sym,) + tuple(r.get(c) for c in cols[1:])
        cur.execute(sql, values + (ts, ts))


def _upsert_score(cur, symbol: str, payload: dict[str, Any]) -> None:
    sym = symbol.upper()
    meta = json.dumps(payload.get("meta") or {}, separators=(",", ":"), ensure_ascii=False)
    ts = _now()
    cur.execute(
        """
        INSERT INTO fundamental_scores (
            symbol, growth_score, profitability_score, balance_sheet_score, cash_flow_score,
            capital_efficiency_score, overall_score, meta, computed_at, created_at, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            growth_score=VALUES(growth_score),
            profitability_score=VALUES(profitability_score),
            balance_sheet_score=VALUES(balance_sheet_score),
            cash_flow_score=VALUES(cash_flow_score),
            capital_efficiency_score=VALUES(capital_efficiency_score),
            overall_score=VALUES(overall_score),
            meta=VALUES(meta),
            computed_at=VALUES(computed_at),
            updated_at=VALUES(updated_at)
        """,
        (
            sym,
            payload.get("growth_score"),
            payload.get("profitability_score"),
            payload.get("balance_sheet_score"),
            payload.get("cash_flow_score"),
            payload.get("capital_efficiency_score"),
            payload.get("overall_score"),
            meta,
            ts,
            ts,
            ts,
        ),
    )


def ingest_symbol(conn, symbol: str, cik: str, *, use_macrotrends: bool = True) -> None:
    sym = symbol.upper()
    logger.info("ingest %s CIK %s", sym, cik)
    facts = fetch_company_facts(cik)
    time.sleep(0.25)
    submissions = fetch_submissions(cik)
    time.sleep(0.25)

    with conn.cursor() as cur:
        _upsert_raw(cur, sym, cik, "companyfacts", facts)
        _upsert_raw(cur, sym, cik, "submissions", submissions)
        _delete_metrics_for_symbol(cur, sym)

        annual = build_annual_tables(facts)
        enrich_annual_with_filing_dates(annual, facts)
        if use_macrotrends:
            try:
                bundle = fetch_macrotrends_bundle(sym)
                apply_macrotrends_gap_fill(annual, bundle)
            except Exception as e:
                logger.warning("MacroTrends gap-fill skipped for %s: %s", sym, e)
        _insert_annual_rows(cur, sym, annual)

        quarterly = build_quarterly_tables(facts)
        _insert_quarterly_rows(cur, sym, quarterly)

        filings = parse_filings_from_submissions(submissions, sym, cik)
        _insert_filings(cur, filings)
        _upsert_issuer_profile(cur, sym, cik, submissions)

        annual_sorted = sorted(annual, key=lambda r: int(r["fiscal_year"]), reverse=True)
        scores = compute_fundamental_scores(annual_sorted)
        _upsert_score(cur, sym, scores)

    conn.commit()


def run_fundamental_ingest(
    symbols: Iterable[str] | None = None,
    *,
    use_macrotrends: bool = True,
) -> None:
    """Ingest all configured symbols (or subset). Used by CLI and scheduled job."""
    wanted = (
        {s.strip().upper() for s in symbols if s and str(s).strip()}
        if symbols is not None
        else set(SYMBOL_CIK.keys())
    )
    pairs = [(s, c) for s, c in SYMBOL_CIK.items() if s in wanted]
    if not pairs:
        raise ValueError("No valid symbols requested.")
    conn = _conn()
    try:
        for sym, cik in pairs:
            try:
                ingest_symbol(conn, sym, cik, use_macrotrends=use_macrotrends)
                time.sleep(1.0)
            except Exception as e:
                logger.exception("failed %s: %s", sym, e)
                conn.rollback()
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser()
    p.add_argument(
        "--symbols",
        type=str,
        default=",".join(SYMBOL_CIK.keys()),
        help="Comma-separated symbols (default: all 10 tech names).",
    )
    p.add_argument(
        "--no-macrotrends",
        action="store_true",
        help="Skip MacroTrends gap-fill (SEC only).",
    )
    args = p.parse_args(argv)
    wanted = {s.strip().upper() for s in args.symbols.split(",") if s.strip()}
    run_fundamental_ingest(wanted, use_macrotrends=not args.no_macrotrends)


if __name__ == "__main__":
    main()
