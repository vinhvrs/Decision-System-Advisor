"""
WebSocket endpoint for chatbot focus options and chat messages.

Protocol (JSON text frames):
  Client → server (on-demand options; server does not push options on connect):
    {"type": "get_chatbot_options"}  →  {"type": "chatbot_options", "options": [...]}

  Client → server:
    {"type": "chat_message", "message": "<text>", "scope": "<optional id>", "style": "standard"}
    {"type": "ping"}  →  {"type": "pong"}

  Server → client:
    {"type": "chatbot_response", "payload": <same shape as POST /api/v1/chat>}
    {"type": "chatbot_error", "message": "<reason>"}
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.auto_recommendations import get_top_buy_sell_picks
from app.services.chatbot import chatbot_service
from app.services.symbol_query import resolve_query_to_symbols

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chatbot"])

# Keep in sync with frontend `CHATBOT_SCOPE_OPTIONS` (ids and focus labels).
CHATBOT_FOCUS_OPTIONS: List[Dict[str, str]] = [
    {
        "id": "analyze",
        "title": "Results of analyze",
        "description": "Rankings, recommendations, and market snapshot context.",
        "api_focus_label": "analyze results and recommendations",
    },
    {
        "id": "news",
        "title": "News",
        "description": "Headlines, themes, and what moved the tape.",
        "api_focus_label": "market news",
    },
    {
        "id": "companies",
        "title": "Company information",
        "description": "Profiles, fundamentals, and symbol-level detail.",
        "api_focus_label": "company profiles and fundamentals",
    },
    {
        "id": "indicator",
        "title": "Indicators",
        "description": "Technical lab, indicator math, and chart context.",
        "api_focus_label": "technical indicators",
    },
    {
        "id": "strategy",
        "title": "Strategy",
        "description": "Playbooks, risk tiers, and walkthrough logic.",
        "api_focus_label": "trading strategies",
    },
]


def apply_scope_to_message(scope_id: Optional[str], user_text: str) -> str:
    if not scope_id or not str(scope_id).strip():
        return user_text
    sid = str(scope_id).strip().lower()
    for opt in CHATBOT_FOCUS_OPTIONS:
        if opt["id"] == sid:
            return f"[Focus: {opt['api_focus_label']}]\n{user_text}"
    return user_text


def _options_envelope() -> Dict[str, Any]:
    return {"type": "chatbot_options", "options": CHATBOT_FOCUS_OPTIONS}


_AUTO_PICKS_RE = re.compile(
    r"^\s*(top\s*picks?|recommendations?|show\s+(me\s+)?picks|market\s+picks|what\s+to\s+trade)\s*$",
    re.I,
)


def _is_auto_scope(scope: object) -> bool:
    if scope is None:
        return True
    s = str(scope).strip().lower()
    return s in ("", "auto")


def _wants_auto_picks_intent(text: str) -> bool:
    return bool(_AUTO_PICKS_RE.match((text or "").strip()))


@router.websocket("/ws/chatbot")
async def chatbot_websocket(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "chatbot_error", "message": "Invalid JSON"})
                )
                continue

            msg_type = data.get("type")
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            if msg_type == "get_chatbot_options":
                try:
                    await websocket.send_text(json.dumps(_options_envelope()))
                except Exception as e:
                    logger.warning("chatbot ws: failed to send options: %s", e)
                continue

            if msg_type != "chat_message":
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "chatbot_error",
                            "message": f"Unknown type: {msg_type!r}",
                        }
                    )
                )
                continue

            raw_msg = data.get("message")
            user_msg = (raw_msg or "").strip() if isinstance(raw_msg, str) else ""
            scope = data.get("scope")
            style = data.get("style") or "standard"
            style_s = style if isinstance(style, str) else "standard"
            is_auto = _is_auto_scope(scope)

            if not user_msg and not is_auto:
                await websocket.send_text(
                    json.dumps({"type": "chatbot_error", "message": "Message cannot be empty"})
                )
                continue

            try:
                if is_auto and (not user_msg or _wants_auto_picks_intent(user_msg)):
                    result = await get_top_buy_sell_picks(5)
                    await websocket.send_text(
                        json.dumps({"type": "chatbot_response", "payload": result})
                    )
                    continue

                if is_auto and user_msg:
                    symbols = await resolve_query_to_symbols(user_msg)
                    if symbols:
                        built = " ".join(symbols) + " analyze"
                        result = await chatbot_service.handle_message(
                            user_text=built,
                            style=style_s,
                        )
                        await websocket.send_text(
                            json.dumps({"type": "chatbot_response", "payload": result})
                        )
                        continue

                if is_auto:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "chatbot_response",
                                "payload": {
                                    "type": "error",
                                    "response": (
                                        "No symbol or company matched. Try a ticker (e.g. NVDA), "
                                        "a company name, leave the box empty for top BUY/SELL picks, "
                                        'or type "top picks".'
                                    ),
                                },
                            }
                        )
                    )
                    continue

                built = apply_scope_to_message(
                    scope if isinstance(scope, str) else None,
                    user_msg,
                )
                result = await chatbot_service.handle_message(
                    user_text=built,
                    style=style_s,
                )
                await websocket.send_text(
                    json.dumps({"type": "chatbot_response", "payload": result})
                )
            except Exception as e:
                logger.exception("chatbot ws: handle_message failed")
                await websocket.send_text(
                    json.dumps({"type": "chatbot_error", "message": str(e) or "Chat failed"})
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("chatbot ws: loop error: %s", e)
