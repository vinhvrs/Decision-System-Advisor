from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services.data_sources import (
    SourceError,
    alpha_earnings,
    alpha_estimates,
    configured_sources,
    finnhub_earnings_calendar,
    fred_latest,
    massive_option_chain,
    probe_source,
)

router = APIRouter(tags=["external-data"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/api/v1/source-health")
def source_health(probe: bool = Query(False)):
    rows = configured_sources()
    if probe:
        rows = [probe_source(row["source_code"]) | {
            "configured": row["configured"],
            "credential": row["credential"],
        } for row in rows]
    return {"generated_at": _now(), "sources": rows}


@router.get("/api/v1/data-health")
def data_health(probe: bool = Query(False)):
    rows = configured_sources()
    observed: list[dict[str, Any]] = []
    covered = 0
    for row in rows:
        status = "CONFIGURED" if row["configured"] else "NOT_CONFIGURED"
        if probe:
            checked = probe_source(row["source_code"])
            status = checked.get("status", status)
            last_error = checked.get("error")
        else:
            last_error = None
        if status in ("AVAILABLE", "CONFIGURED"):
            covered += 1
        observed.append({
            "source_code": row["source_code"],
            "status": status,
            "last_data_at": None,
            "last_error": last_error,
        })
    quality = "AVAILABLE" if covered == len(rows) else "PARTIAL" if covered else "UNAVAILABLE"
    return {
        "quality": quality,
        "generated_at": _now(),
        "pipeline": {"covered": covered, "total": len(rows)},
        "sources": observed,
    }


@router.get("/api/v1/macro/dashboard")
def macro_dashboard():
    # FRED is used here as a normalized macro read layer. Series that are not
    # cleared for redistribution must remain disabled at deployment policy level.
    catalog = {
        "UST2Y": "DGS2",
        "UST10Y": "DGS10",
        "UST30Y": "DGS30",
        "FEDFUNDS": "DFF",
        "SOFR": "SOFR",
        "HY_OAS": "BAMLH0A0HYM2",
        "IG_OAS": "BAMLC0A0CM",
        "REAL10Y": "DFII10",
    }
    data = []
    for code, series_id in catalog.items():
        try:
            payload = fred_latest(series_id)
            obs = (payload.get("observations") or [None])[0]
            raw = None if not obs else obs.get("value")
            value = None if raw in (None, ".", "") else float(raw)
            data.append({
                "series_code": code,
                "value": value,
                "quality": "AVAILABLE" if value is not None else "UNAVAILABLE",
                "unit": "percent",
                "source": f"FRED:{series_id}",
                "observed_at": None if not obs else obs.get("date"),
                "reason": None if value is not None else "No current observation",
            })
        except Exception as exc:
            data.append({
                "series_code": code,
                "value": None,
                "quality": "UNAVAILABLE",
                "unit": "percent",
                "source": f"FRED:{series_id}",
                "reason": str(exc)[:180],
            })

    by_code = {row["series_code"]: row for row in data}
    spreads = []
    if by_code.get("UST10Y", {}).get("value") is not None and by_code.get("UST2Y", {}).get("value") is not None:
        spreads.append({
            "series_code": "UST10Y_MINUS_UST2Y",
            "value": by_code["UST10Y"]["value"] - by_code["UST2Y"]["value"],
            "quality": "DERIVED",
            "unit": "percentage_points",
            "source": "DERIVED:FRED",
            "observed_at": _now(),
        })
    return {
        "data": data,
        "spreads": spreads,
        "generated_at": _now(),
        "quality": "AVAILABLE" if any(x["value"] is not None for x in data) else "UNAVAILABLE",
    }


@router.get("/api/v1/estimates/{symbol}")
def estimates(symbol: str):
    try:
        payload = alpha_estimates(symbol)
    except SourceError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {
        "symbol": symbol.upper(),
        "source": "alpha_vantage",
        "quality": "AVAILABLE" if payload else "UNAVAILABLE",
        "data": payload,
    }


@router.get("/api/v1/earnings/{symbol}")
def earnings(symbol: str):
    result: dict[str, Any] = {
        "symbol": symbol.upper(),
        "generated_at": _now(),
        "sources": {},
    }
    try:
        result["sources"]["alpha_vantage"] = alpha_earnings(symbol)
    except Exception as exc:
        result["sources"]["alpha_vantage"] = {"error": str(exc)[:180]}
    try:
        result["sources"]["finnhub_calendar"] = finnhub_earnings_calendar(symbol)
    except Exception as exc:
        result["sources"]["finnhub_calendar"] = {"error": str(exc)[:180]}
    result["quality"] = "AVAILABLE" if any("error" not in value for value in result["sources"].values()) else "UNAVAILABLE"
    return result


@router.get("/api/v1/options/{symbol}")
def options(symbol: str, limit: int = Query(250, ge=1, le=250)):
    try:
        payload = massive_option_chain(symbol, limit=limit)
    except SourceError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    rows = payload.get("results") or []
    normalized = []
    for item in rows:
        details = item.get("details") or {}
        greeks = item.get("greeks") or {}
        day = item.get("day") or {}
        quote = item.get("last_quote") or {}
        normalized.append({
            "ticker": details.get("ticker"),
            "underlying": symbol.upper(),
            "expiration_date": details.get("expiration_date"),
            "strike_price": details.get("strike_price"),
            "contract_type": details.get("contract_type"),
            "implied_volatility": item.get("implied_volatility"),
            "open_interest": item.get("open_interest"),
            "delta": greeks.get("delta"),
            "gamma": greeks.get("gamma"),
            "theta": greeks.get("theta"),
            "vega": greeks.get("vega"),
            "bid": quote.get("bid"),
            "ask": quote.get("ask"),
            "volume": day.get("volume"),
            "source": "massive_opra",
        })
    return {
        "symbol": symbol.upper(),
        "source": "massive",
        "quality": "AVAILABLE" if normalized else "UNAVAILABLE",
        "count": len(normalized),
        "data": normalized,
        "next_url": payload.get("next_url"),
    }
