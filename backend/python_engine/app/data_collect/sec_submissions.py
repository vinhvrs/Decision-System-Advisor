"""Fetch SEC submissions JSON (filings index + company metadata)."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.data_collect.sec_http import sec_headers
from app.data_collect.sec_company_facts import format_cik

logger = logging.getLogger(__name__)


def fetch_submissions(cik: str, timeout: float = 90.0) -> dict[str, Any]:
    padded = format_cik(cik)
    url = f"https://data.sec.gov/submissions/CIK{padded}.json"
    with httpx.Client(timeout=timeout, headers=sec_headers(), follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()
