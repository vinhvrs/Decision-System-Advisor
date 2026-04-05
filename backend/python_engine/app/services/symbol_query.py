"""Resolve user text to stock symbols: NLP tickers first, then company_profile lookup."""

from __future__ import annotations

import asyncio
import logging
from typing import List

import pymysql

from app.analyze.nlp.models import SmoothContext
from app.analyze.nlp.resolver import LanguageSmoother
from config.settings import settings

logger = logging.getLogger(__name__)

_smoother = LanguageSmoother()


def _db_resolve_company_or_symbol(q: str) -> List[str]:
    q = (q or "").strip()
    if len(q) < 2:
        return []
    conn = None
    try:
        conn = pymysql.connect(**settings.DB_CONFIG)
        with conn.cursor() as cur:
            like_prefix = f"{q}%"
            like_anywhere = f"%{q}%"
            cur.execute(
                """
                SELECT symbol FROM company_profile
                WHERE UPPER(TRIM(symbol)) = UPPER(TRIM(%s))
                   OR UPPER(TRIM(symbol)) LIKE UPPER(%s)
                   OR LOWER(company_name) LIKE LOWER(%s)
                ORDER BY
                  CASE WHEN UPPER(TRIM(symbol)) = UPPER(TRIM(%s)) THEN 0 ELSE 1 END,
                  CHAR_LENGTH(TRIM(symbol))
                LIMIT 8
                """,
                (q, like_prefix, like_anywhere, q),
            )
            rows = cur.fetchall() or []
        out: List[str] = []
        seen = set()
        for r in rows:
            sym = (r.get("symbol") or "").strip().upper()
            if sym and sym not in seen:
                seen.add(sym)
                out.append(sym)
        return out
    except Exception as e:
        logger.warning("symbol_query DB lookup failed: %s", e)
        return []
    finally:
        if conn:
            conn.close()


async def resolve_query_to_symbols(query: str) -> List[str]:
    """Return ordered unique symbols for a free-text query (ticker tokens or company name)."""
    query = (query or "").strip()
    if not query:
        return []

    def _from_nlp() -> List[str]:
        ctx = SmoothContext(direction="in", style_preset="standard")
        result = _smoother.smooth(query, ctx)
        tickers = (result.entities or {}).get("tickers") or []
        return list(dict.fromkeys(str(t).strip().upper() for t in tickers if t))

    tickers = await asyncio.to_thread(_from_nlp)
    if tickers:
        return tickers

    return await asyncio.to_thread(_db_resolve_company_or_symbol, query)
