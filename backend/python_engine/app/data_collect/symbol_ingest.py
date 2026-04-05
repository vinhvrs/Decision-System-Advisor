"""
How many symbols participate in scheduled news + corporate ingest.

- ``all``: every row in ``company_profile`` (fallback: ``instruments``), same as legacy behavior.
- ``top_snapshot`` (option 1 / thesis demo): top N tickers by ``instrument_snapshot.volume``.

Override with env ``SYMBOL_INGEST_MODE`` and ``SYMBOL_INGEST_TOP_N``, or pass explicit args from callers.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

MODE_ALL = "all"
MODE_TOP_SNAPSHOT = "top_snapshot"


def normalize_symbol_ingest_mode(mode: str) -> str:
    m = (mode or "").strip().lower()
    if m in ("1", "option1", "demo", "top_snapshot", "top20"):
        return MODE_TOP_SNAPSHOT
    return MODE_ALL


def ingest_params_from_env() -> Tuple[str, int]:
    mode = normalize_symbol_ingest_mode(os.environ.get("SYMBOL_INGEST_MODE", MODE_ALL))
    n = max(1, int(os.environ.get("SYMBOL_INGEST_TOP_N", "20")))
    return mode, n


def resolve_ingest_scope(
    symbol_scope: Optional[str] = None,
    top_n: Optional[int] = None,
) -> Tuple[str, int]:
    """When args are None, use env (defaults: all symbols, top_n=20 if mode is snapshot)."""
    if symbol_scope is None and top_n is None:
        return ingest_params_from_env()
    mode = normalize_symbol_ingest_mode(
        symbol_scope if symbol_scope is not None else os.environ.get("SYMBOL_INGEST_MODE", MODE_ALL)
    )
    if top_n is not None:
        n = max(1, top_n)
    else:
        n = max(1, int(os.environ.get("SYMBOL_INGEST_TOP_N", "20")))
    return mode, n


def fetch_companies_for_ingest(
    conn,
    *,
    symbol_scope: str,
    top_n: int,
) -> List[Dict]:
    cfg = symbol_scope if normalize_symbol_ingest_mode(symbol_scope) == MODE_TOP_SNAPSHOT else MODE_ALL
    with conn.cursor() as cursor:
        if cfg == MODE_TOP_SNAPSHOT:
            # Aggregate by instrument so ORDER BY volume is valid (MySQL rejects ORDER BY s.volume with SELECT DISTINCT …).
            cursor.execute(
                """
                SELECT
                    UPPER(TRIM(i.symbol)) AS symbol,
                    MAX(COALESCE(NULLIF(TRIM(cp.company_name), ''), UPPER(TRIM(i.symbol)))) AS company_name
                FROM instrument_snapshot s
                INNER JOIN instruments i ON s.instrument_id = i.id
                LEFT JOIN company_profile cp ON UPPER(TRIM(cp.symbol)) = UPPER(TRIM(i.symbol))
                WHERE i.symbol IS NOT NULL AND TRIM(i.symbol) != ''
                GROUP BY i.id, UPPER(TRIM(i.symbol))
                ORDER BY MAX(s.volume) DESC
                LIMIT %s
                """,
                (top_n,),
            )
            rows = cursor.fetchall()
            if rows:
                return rows
            cursor.execute(
                """
                SELECT DISTINCT UPPER(TRIM(symbol)) AS symbol,
                       UPPER(TRIM(symbol)) AS company_name
                FROM instruments
                WHERE symbol IS NOT NULL AND TRIM(symbol) != ''
                ORDER BY symbol
                LIMIT %s
                """,
                (top_n,),
            )
            return cursor.fetchall()

        cursor.execute(
            """
            SELECT DISTINCT UPPER(TRIM(symbol)) AS symbol,
                   COALESCE(NULLIF(TRIM(company_name), ''), UPPER(TRIM(symbol))) AS company_name
            FROM company_profile
            WHERE symbol IS NOT NULL AND TRIM(symbol) != ''
            ORDER BY symbol
            """
        )
        rows = cursor.fetchall()
        if rows:
            return rows
        try:
            cursor.execute(
                """
                SELECT DISTINCT UPPER(TRIM(symbol)) AS symbol,
                       UPPER(TRIM(symbol)) AS company_name
                FROM instruments
                WHERE symbol IS NOT NULL AND TRIM(symbol) != ''
                ORDER BY symbol
                LIMIT 500
                """
            )
            return cursor.fetchall()
        except Exception:
            return []


def snapshot_limit_for_stock_sync(symbol_scope: str, top_n: int) -> Optional[int]:
    """``DSATurbo`` uses ``settings.TOP_N`` when this returns None."""
    if normalize_symbol_ingest_mode(symbol_scope) == MODE_TOP_SNAPSHOT:
        return top_n
    return None
