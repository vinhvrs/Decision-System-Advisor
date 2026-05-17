"""
Shared HTTP headers for SEC data.sec.gov (User-Agent is required).
"""
from __future__ import annotations

import os


def sec_user_agent() -> str:
    return os.environ.get(
        "SEC_USER_AGENT",
        "DSA-Fundamentals/1.0 (admin@decisionstocksadvisor.com)",
    ).strip() or "DSA-Fundamentals/1.0 (admin@decisionstocksadvisor.com)"


def sec_headers() -> dict[str, str]:
    return {
        "User-Agent": sec_user_agent(),
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }
