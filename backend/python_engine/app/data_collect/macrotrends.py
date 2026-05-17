"""
Optional MacroTrends reference layer (HTML charts). SEC remains source of truth in ingest.

Fetches annual series from public chart pages, e.g.:
  https://www.macrotrends.net/stocks/charts/AAPL/apple/revenue
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Chart slug segment (lowercase) per ticker — matches MacroTrends URL paths.
SYMBOL_CHART_SLUG: dict[str, str] = {
    "AAPL": "apple",
    "MSFT": "microsoft",
    "NVDA": "nvidia",
    "TSLA": "tesla",
    "GOOGL": "alphabet",
    "META": "meta-platforms",
    "AMZN": "amazon",
    "IBM": "ibm",
    "ORCL": "oracle",
    "AVGO": "broadcom",
}

# metric path -> annual row field(s) to fill when SEC value is missing
METRIC_PATHS: dict[str, str] = {
    "revenue": "revenue",
    "net-income": "net_income",
    "gross-profit": "gross_profit",
    "operating-income": "operating_income",
    "total-assets": "assets",
    "total-liabilities": "liabilities",
    "shareholders-equity": "equity",
    "cash-on-hand": "cash",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}


def _parse_money_cell(text: str) -> float | None:
    t = (text or "").strip().replace(",", "").replace("$", "")
    if not t or t in ("—", "-", "N/A"):
        return None
    mult = 1.0
    if t.endswith("B"):
        mult = 1e9
        t = t[:-1]
    elif t.endswith("M"):
        mult = 1e6
        t = t[:-1]
    elif t.endswith("K"):
        mult = 1e3
        t = t[:-1]
    try:
        return float(t) * mult
    except ValueError:
        return None


def _parse_annual_table(soup: BeautifulSoup) -> dict[int, float]:
    """Find first markdown-style annual table: year | value (millions on MT pages)."""
    out: dict[int, float] = {}
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        header = " ".join(rows[0].get_text(" ", strip=True).lower())
        if "annual" not in header and "year" not in header:
            # MT often has 2-col tables without explicit header row text
            pass
        for tr in rows[1:]:
            cells = [c.get_text(strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            year_m = re.match(r"^(\d{4})$", cells[0].strip())
            if not year_m:
                continue
            fy = int(year_m.group(1))
            val = _parse_money_cell(cells[1])
            if val is None:
                continue
            # MacroTrends tables are labeled "Millions of US $" — scale if values look small
            if val < 1e6 and "million" in header:
                val *= 1e6
            elif val < 1e6 and val > 0:
                val *= 1e6
            out[fy] = val
        if out:
            break
    return out


def fetch_macrotrends_metric(symbol: str, metric_path: str, session: httpx.Client) -> dict[int, float]:
    sym = symbol.strip().upper()
    slug = SYMBOL_CHART_SLUG.get(sym, sym.lower())
    url = f"https://www.macrotrends.net/stocks/charts/{sym}/{slug}/{metric_path}"
    try:
        r = session.get(url, headers=HEADERS, timeout=45, follow_redirects=True)
        if r.status_code != 200:
            logger.warning("MacroTrends HTTP %s for %s %s", r.status_code, sym, metric_path)
            return {}
        soup = BeautifulSoup(r.text, "html.parser")
        return _parse_annual_table(soup)
    except Exception as e:
        logger.warning("MacroTrends fetch failed %s %s: %s", sym, metric_path, e)
        return {}


def fetch_macrotrends_bundle(symbol: str) -> dict[str, Any] | None:
    """
    Return { "annual_by_field": { "revenue": {2024: 1.2e11, ...}, ... }, "source": "macrotrends" }.
  """
    sym = symbol.strip().upper()
    if sym not in SYMBOL_CHART_SLUG:
        return None

    annual_by_field: dict[str, dict[int, float]] = {}
    with httpx.Client() as session:
        for path, field in METRIC_PATHS.items():
            series = fetch_macrotrends_metric(sym, path, session)
            if series:
                annual_by_field[field] = series
            time.sleep(1.2)

    if not annual_by_field:
        return None

    return {"symbol": sym, "annual_by_field": annual_by_field, "source": "macrotrends"}


def apply_macrotrends_gap_fill(annual_rows: list[dict[str, Any]], bundle: dict[str, Any] | None) -> None:
    """Fill NULL SEC annual metrics from MacroTrends; never overwrite non-null SEC values."""
    if not bundle or not annual_rows:
        return
    by_field: dict[str, dict[int, float]] = bundle.get("annual_by_field") or {}
    if not by_field:
        return

    by_fy = {int(r["fiscal_year"]): r for r in annual_rows if r.get("fiscal_year") is not None}
    for field, series in by_field.items():
        for fy, val in series.items():
            row = by_fy.get(int(fy))
            if not row:
                continue
            if row.get(field) is None:
                row[field] = val
                if row.get("source") == "SEC":
                    row["source"] = "SEC+MacroTrends"
