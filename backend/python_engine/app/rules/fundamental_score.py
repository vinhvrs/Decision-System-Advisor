"""
Heuristic fundamental scores (0–100) from normalized annual rows.

Scores are educational / relative, not investment advice. Missing metrics degrade gracefully toward neutral (50).
"""
from __future__ import annotations

import math
from typing import Any


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    if not math.isfinite(x):
        return 50.0
    return max(lo, min(hi, x))


def _cagr_score(cagr: float | None) -> float:
    if cagr is None or not math.isfinite(cagr):
        return 50.0
    # Map CAGR: -10% -> 20, 0% -> 50, +15% -> 90
    return _clamp(50.0 + float(cagr) * 220.0)


def _margin_score(m: float | None, weight: float = 100.0) -> float:
    if m is None or not math.isfinite(m):
        return 50.0
    return _clamp(float(m) * weight)


def _ratio_score(value: float | None, good: float, bad: float, invert: bool = False) -> float:
    """Map ``value`` between ``bad`` and ``good`` into 0–100."""
    if value is None or not math.isfinite(value):
        return 50.0
    v = float(value)
    if good == bad:
        return 50.0
    t = (v - bad) / (good - bad)
    if invert:
        t = 1.0 - t
    return _clamp(t * 100.0)


def compute_fundamental_scores(annual_rows_newest_first: list[dict[str, Any]]) -> dict[str, Any]:
    rows = [r for r in annual_rows_newest_first if isinstance(r, dict)]
    if not rows:
        return {
            "growth_score": 50.0,
            "profitability_score": 50.0,
            "balance_sheet_score": 50.0,
            "cash_flow_score": 50.0,
            "capital_efficiency_score": 50.0,
            "overall_score": 50.0,
            "meta": {"reason": "no annual rows"},
        }

    latest = rows[0]

    growth = _cagr_score(_f(latest.get("revenue_cagr_5y")))
    if growth == 50.0:
        growth = _cagr_score(_f(latest.get("revenue_cagr_3y")))

    profitability = (
        _margin_score(_f(latest.get("gross_margin")), 120.0) * 0.35
        + _margin_score(_f(latest.get("net_margin")), 180.0) * 0.35
        + _margin_score(_f(latest.get("roe")), 40.0) * 0.30
    )

    balance = (
        _ratio_score(_f(latest.get("current_ratio")), good=2.5, bad=0.8, invert=False) * 0.55
        + _ratio_score(_f(latest.get("debt_equity")), good=0.35, bad=2.5, invert=True) * 0.45
    )

    fcf_margin = None
    rev = _f(latest.get("revenue"))
    fcf = _f(latest.get("fcf"))
    if rev and rev != 0 and fcf is not None:
        fcf_margin = fcf / rev
    cash_flow = (
        _margin_score(fcf_margin, 90.0) * 0.55
        + _margin_score(_f(latest.get("operating_margin")), 80.0) * 0.45
    )

    capital_eff = (
        _margin_score(_f(latest.get("asset_turnover")), 55.0) * 0.55
        + _ratio_score(_f(latest.get("interest_coverage")), good=8.0, bad=1.0, invert=False) * 0.45
    )

    overall = (growth + profitability + balance + cash_flow + capital_eff) / 5.0

    meta = {
        "fiscal_year": latest.get("fiscal_year"),
        "revenue_cagr_5y": latest.get("revenue_cagr_5y"),
        "gross_margin": latest.get("gross_margin"),
        "net_margin": latest.get("net_margin"),
        "roe": latest.get("roe"),
        "current_ratio": latest.get("current_ratio"),
        "debt_equity": latest.get("debt_equity"),
        "fcf_margin": fcf_margin,
    }

    return {
        "growth_score": round(growth, 2),
        "profitability_score": round(profitability, 2),
        "balance_sheet_score": round(balance, 2),
        "cash_flow_score": round(cash_flow, 2),
        "capital_efficiency_score": round(capital_eff, 2),
        "overall_score": round(overall, 2),
        "meta": meta,
    }


def _f(v: Any) -> float | None:
    if v is None:
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    return x
