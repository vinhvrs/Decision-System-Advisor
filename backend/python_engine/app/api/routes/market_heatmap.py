"""Curated heatmap from indexed daily candles, never mixed-unit snapshot liquidity."""

import json
import math
from datetime import datetime, timedelta, timezone
import pymysql
from fastapi import APIRouter
from app.config.market_universe import ASSETS
from app.config.dsa_tables import table
from config.settings import settings

router = APIRouter()
CACHE_KEY = "market:heatmap:v1"


def positive(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and n > 0 else None
    except (ValueError, TypeError, OverflowError):
        return None


def utc(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def heatmap_row(asset, metadata, recent):
    last = recent[0] if recent else {}
    previous = recent[1] if len(recent) > 1 else {}
    price, prior = positive(last.get("close")), positive(previous.get("close"))
    change = (
        (price / prior - 1) * 100 if price is not None and prior is not None else None
    )
    volume = positive(last.get("volume"))
    # Dollar volume is a comparable estimate only for share-volume stock/ETF feeds.
    turnover = (
        price * volume
        if asset.market in ("stock", "etf") and price and volume
        else None
    )
    stamp = last.get("timestamps")
    bar = metadata.get("last_bar_at")
    return {
        "symbol": asset.symbol,
        "name": asset.name,
        "market": asset.market,
        "sector": metadata.get("sector") or "Unclassified",
        "price": price,
        "previous_close": prior,
        "change_pct": round(change, 4) if change is not None else None,
        "session_date": stamp.date().isoformat() if stamp else None,
        "previous_session_date": previous["timestamps"].date().isoformat()
        if previous.get(
0timestamps")
        else None,
        "as_of": utc(mªþ timedelta(minutes=30)) if bar else None,
        "last_sync_at": utc(metadata.get("last_sync_at")),
        "market_cap": positive(metadata.get("market_cap"))
        if asset.market == "stock"
        else None,
        "traded_value": turnover,
        "coverage_partial": bool(last.get("coverage_partial")),
        "session_final": bool(last["is_final"])
        if last.get("is_final") is not None
        else None,
        "provider_error": bool(metadata.get("last_error")),
    }
