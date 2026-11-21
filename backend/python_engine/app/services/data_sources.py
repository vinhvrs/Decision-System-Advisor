from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any

import httpx

from config.settings import settings

_TIMEOUT = 12.0


class SourceError(RuntimeError):
    pass


def _get(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = client.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict):
                return data
            return {"data": data}
    except Exception as exc:
        raise SourceError(str(exc)) from exc


def _post(url: str, *, json: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = client.post(url, json=json, headers=headers)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict):
                return data
            return {"data": data}
    except Exception as exc:
        raise SourceError(str(exc)) from exc


def configured_sources() -> list[dict[str, Any]]:
    return [
        {"source_code": "sec", "configured": True, "credential": "not_required"},
        {"source_code": "treasury", "configured": True, "credential": "not_required"},
        {"source_code": "gdelt", "configured": True, "credential": "not_required"},
        {"source_code": "cftc", "configured": True, "credential": "optional"},
        {"source_code": "bls", "configured": bool(settings.BLS_API_KEY), "credential": "recommended"},
        {"source_code": "bea", "configured": bool(settings.BEA_API_KEY), "credential": "required"},
        {"source_code": "eia", "configured": bool(settings.EIA_API_KEY), "credential": "required"},
        {"source_code": "fred", "configured": bool(settings.FRED_API_KEY), "credential": "required"},
        {"source_code": "massive", "configured": bool(settings.MASSIVE_API_KEY), "credential": "required"},
        {"source_code": "alpha_vantage", "configured": bool(settings.ALPHA_VANTAGE_API_KEY), "credential": "required"},
        {"source_code": "finnhub", "configured": bool(settings.FINNHUB_API_KEY), "credential": "required"},
        {"source_code": "fmp", "configured": bool(settings.FMP_API_KEY), "credential": "required"},
    ]


def probe_source(source_code: str) -> dict[str, Any]:
    code = source_code.strip().lower()
    try:
        if code == "bls":
            payload = {
                "seriesid": ["LNS14000000"],
                "startyear": str(date.today().year - 1),
                "endyear": str(date.today().year),
            }
            if settings.BLS_API_KEY:
                payload["registrationkey"] = settings.BLS_API_KEY
            data = _post("https://api.bls.gov/publicAPI/v2/timeseries/data/", json=payload)
            ok = data.get("status") == "REQUEST_SUCCEEDED"
        elif code == "bea":
            if not settings.BEA_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://apps.bea.gov/api/data", params={
                "UserID": settings.BEA_API_KEY,
                "method": "GETDATASETLIST",
                "ResultFormat": "JSON",
            })
            ok = "BEAAPI" in data
        elif code == "eia":
            if not settings.EIA_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://api.eia.gov/v2/", params={"api_key": settings.EIA_API_KEY})
            ok = "response" in data
        elif code == "fred":
            if not settings.FRED_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://api.stlouisfed.org/fred/series", params={
                "series_id": "DGS10",
                "api_key": settings.FRED_API_KEY,
                "file_type": "json",
            })
            ok = bool(data.get("seriess"))
        elif code == "massive":
            if not settings.MASSIVE_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://api.massive.com/v3/reference/tickers/AAPL", params={"apiKey": settings.MASSIVE_API_KEY})
            ok = data.get("status") in ("OK", "DELAYED") or bool(data.get("results"))
        elif code == "alpha_vantage":
            if not settings.ALPHA_VANTAGE_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://www.alphavantage.co/query", params={
                "function": "OVERVIEW", "symbol": "AAPL", "apikey": settings.ALPHA_VANTAGE_API_KEY
            })
            ok = bool(data.get("Symbol"))
        elif code == "finnhub":
            if not settings.FINNHUB_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://finnhub.io/api/v1/quote", params={"symbol": "AAPL", "token": settings.FINNHUB_API_KEY})
            ok = isinstance(data.get("c"), (int, float))
        elif code == "fmp":
            if not settings.FMP_API_KEY:
                return {"source_code": code, "status": "NOT_CONFIGURED"}
            data = _get("https://financialmodelingprep.com/stable/profile", params={"symbol": "AAPL", "apikey": settings.FMP_API_KEY})
            rows = data.get("data", data) if isinstance(data, dict) else data
            ok = bool(rows)
        elif code == "sec":
            data = _get("https://data.sec.gov/submissions/CIK0000320193.json", headers={"User-Agent": settings.SEC_USER_AGENT})
            ok = data.get("cik") is not None
        elif code == "cftc":
            headers = {"X-App-Token": settings.CFTC_APP_TOKEN} if settings.CFTC_APP_TOKEN else None
            data = _get("https://publicreporting.cftc.gov/resource/jun7-fc8e.json", params={"$limit": 1}, headers=headers)
            ok = bool(data.get("data", data))
        elif code == "gdelt":
            data = _get("https://api.gdeltproject.org/api/v2/doc/doc", params={
                "query": "markets", "mode": "ArtList", "maxrecords": 1, "format": "json"
            })
            ok = bool(data)
        elif code == "treasury":
            data = _get("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/avg_interest_rates", params={"page[size]": 1})
            ok = bool(data.get("data"))
        else:
            return {"source_code": code, "status": "UNKNOWN_SOURCE"}
        return {"source_code": code, "status": "AVAILABLE" if ok else "DEGRADED"}
    except SourceError as exc:
        return {"source_code": code, "status": "ERROR", "error": str(exc)[:240]}


def alpha_estimates(symbol: str) -> dict[str, Any]:
    if not settings.ALPHA_VANTAGE_API_KEY:
        raise SourceError("ALPHA_VANTAGE_API_KEY is not configured")
    return _get("https://www.alphavantage.co/query", params={
        "function": "EARNINGS_ESTIMATES",
        "symbol": symbol.upper(),
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    })


def alpha_earnings(symbol: str) -> dict[str, Any]:
    if not settings.ALPHA_VANTAGE_API_KEY:
        raise SourceError("ALPHA_VANTAGE_API_KEY is not configured")
    return _get("https://www.alphavantage.co/query", params={
        "function": "EARNINGS",
        "symbol": symbol.upper(),
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    })


def finnhub_earnings_calendar(symbol: str | None = None, *, days: int = 90) -> dict[str, Any]:
    if not settings.FINNHUB_API_KEY:
        raise SourceError("FINNHUB_API_KEY is not configured")
    start = date.today()
    end = start + timedelta(days=max(1, min(days, 365)))
    params: dict[str, Any] = {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "token": settings.FINNHUB_API_KEY,
    }
    if symbol:
        params["symbol"] = symbol.upper()
    return _get("https://finnhub.io/api/v1/calendar/earnings", params=params)


def massive_option_chain(symbol: str, *, limit: int = 250) -> dict[str, Any]:
    if not settings.MASSIVE_API_KEY:
        raise SourceError("MASSIVE_API_KEY is not configured")
    return _get(f"https://api.massive.com/v3/snapshot/options/{symbol.upper()}", params={
        "limit": max(1, min(limit, 250)),
        "apiKey": settings.MASSIVE_API_KEY,
    })


def fred_latest(series_id: str) -> dict[str, Any]:
    if not settings.FRED_API_KEY:
        raise SourceError("FRED_API_KEY is not configured")
    return _get("https://api.stlouisfed.org/fred/series/observations", params={
        "series_id": series_id,
        "api_key": settings.FRED_API_KEY,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 1,
    })
