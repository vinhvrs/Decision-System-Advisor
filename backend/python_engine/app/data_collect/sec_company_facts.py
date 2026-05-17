"""Fetch SEC XBRL company facts JSON."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.data_collect.sec_http import sec_headers

logger = logging.getLogger(__name__)


def format_cik(cik: str) -> str:
    digits = "".join(ch for ch in str(cik) if ch.isdigit())
    return digits.zfill(10)


def fetch_company_facts(cik: str, timeout: float = 90.0) -> dict[str, Any]:
    padded = format_cik(cik)
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json"
    with httpx.Client(timeout=timeout, headers=sec_headers(), follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()
