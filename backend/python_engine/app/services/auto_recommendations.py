"""Top mixed BUY/SELL picks from cached analysis (liquidity-ranked universe)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

from app.analyze.analysis_cache import analysis_cache_service
from app.services.chatbot import chatbot_service

logger = logging.getLogger(__name__)


def _conf(item: Tuple[str, Dict[str, Any]]) -> float:
    try:
        return float(item[1].get("confidence") or 0)
    except (TypeError, ValueError):
        return 0.0


async def get_top_buy_sell_picks(total: int = 5) -> Dict[str, Any]:
    """
    Up to ``total`` names: prefer 3 BUY + 2 SELL by confidence; fill remaining slots
    from whichever side has capacity.
    """
    total = max(1, min(int(total), 20))
    symbols = await analysis_cache_service.get_top_symbols_from_ranking(
        ranking_key="liquidity:ranking:daily",
        limit=150,
    )
    buys: List[Tuple[str, Dict[str, Any]]] = []
    sells: List[Tuple[str, Dict[str, Any]]] = []

    for sym in symbols:
        data = await analysis_cache_service.get_analysis(sym)
        if not data or not isinstance(data, dict):
            continue
        rec = str(data.get("recommendation") or "HOLD").upper().strip()
        if rec == "BUY":
            buys.append((sym, data))
        elif rec == "SELL":
            sells.append((sym, data))

    buys.sort(key=_conf, reverse=True)
    sells.sort(key=_conf, reverse=True)

    want_buy, want_sell = 3, 2
    if total < 5:
        want_buy = (total + 1) // 2
        want_sell = total - want_buy

    picked: List[Tuple[str, Dict[str, Any], str]] = []
    used = set()

    for sym, dat in buys[:want_buy]:
        if len(picked) >= total:
            break
        if sym not in used:
            picked.append((sym, dat, "BUY"))
            used.add(sym)

    for sym, dat in sells[:want_sell]:
        if len(picked) >= total:
            break
        if sym not in used:
            picked.append((sym, dat, "SELL"))
            used.add(sym)

    rest: List[Tuple[str, Dict[str, Any], str]] = [
        (s, d, "BUY") for s, d in buys[want_buy:] if s not in used
    ]
    rest.extend((s, d, "SELL") for s, d in sells[want_sell:] if s not in used)
    rest.sort(
        key=lambda x: _conf((x[0], x[1])),
        reverse=True,
    )

    for sym, dat, side in rest:
        if len(picked) >= total:
            break
        if sym in used:
            continue
        picked.append((sym, dat, side))
        used.add(sym)

    if not picked:
        return {
            "type": "error",
            "response": (
                "No BUY/SELL signals found in the analysis cache yet. "
                "Ensure ranking sync and auto-analyze have run."
            ),
        }

    results = []
    for sym, data, _side in picked[:total]:
        results.append(
            {
                "symbol": sym,
                "response": chatbot_service._normalize_response_payload(sym, data),
            }
        )

    intro = (
        f"Top {len(results)} signals (Auto): mixed BUY/SELL from liquidity-ranked names "
        "with cached analysis."
    )
    return {
        "type": "advice_multi",
        "period": "daily",
        "summary": intro,
        "results": results,
    }
