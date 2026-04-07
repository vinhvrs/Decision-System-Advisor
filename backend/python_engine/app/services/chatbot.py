import logging
import re
from typing import Dict, Any, List

from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext
from app.analyze.analysis_cache import analysis_cache_service
from app.analyze.auto_analyze import auto_analyze_service

# WebSocket scoped messages look like: "[Focus: market news]\nAMD"
# Entity extraction must not run on the focus line or it treats Focus/MARKET/NEWS as tickers.
_FOCUS_PREFIX_RE = re.compile(r"^\[Focus:[^\]]+\]\s*\n?", re.IGNORECASE)


def _text_for_entity_extraction(user_text: str) -> str:
    t = (user_text or "").strip()
    m = _FOCUS_PREFIX_RE.match(t)
    if not m:
        return t
    return t[m.end() :].strip()


class ChatBotService:
    def __init__(self):
        self.smoother = LanguageSmoother()
        self.logger = logging.getLogger(__name__)

    async def handle_message(self, user_text: str, style: str = "standard") -> Dict[str, Any]:
        try:
            ctx = SmoothContext(direction="in", style_preset=style)
            text_for_nlp = _text_for_entity_extraction(user_text)
            inbound_result = self.smoother.smooth(text_for_nlp, ctx)

            tickers: List[str] = inbound_result.entities.get("tickers") or []
            if ctx.has_error() or not tickers:
                return {
                    "type": "error",
                    "response": "Please provide a valid stock ticker (e.g., NVDA) for analysis.",
                }

            results: List[Dict[str, Any]] = []

            for raw_symbol in tickers:
                symbol = (raw_symbol or "").strip().upper()
                if not symbol:
                    continue

                response_payload: Dict[str, Any]

                # 1. Try Redis first
                cached_data = await analysis_cache_service.get_analysis(symbol)

                if cached_data and isinstance(cached_data, dict):
                    self.logger.info(f"Cache hit for {symbol}")
                    response_payload = self._normalize_response_payload(symbol, cached_data)
                else:
                    self.logger.info(f"Cache miss for {symbol}, calling auto analyze")

                    analyzed_payload = await auto_analyze_service.analyze_symbol(
                        symbol=symbol,
                        clean_text=inbound_result.clean_text,
                    )

                    response_payload = self._normalize_response_payload(symbol, analyzed_payload)

                    # Save only non-empty payloads with the expected shape
                    if self._is_cacheable_payload(response_payload):
                        success = await analysis_cache_service.set_analysis(symbol, response_payload)
                        if success:
                            self.logger.info(f"Saved fresh analysis to Redis for {symbol}")
                        else:
                            self.logger.error(f"Failed to save fresh analysis for {symbol}")
                    else:
                        self.logger.warning(f"Skipped Redis save for {symbol} because payload is not cacheable")

                results.append({
                    "symbol": symbol,
                    "response": response_payload,
                })

            if not results:
                return {
                    "type": "error",
                    "response": "No valid ticker could be processed.",
                }

            return {
                "type": "advice_multi" if len(results) > 1 else "advice",
                "period": "daily",
                "results": results,
            }

        except Exception as e:
            self.logger.error(f"ChatBot Error: {str(e)}", exc_info=True)
            return {
                "type": "error",
                "message": "Internal server error.",
            }

    def _normalize_response_payload(self, symbol: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            payload = {}

        raw_indicators = payload.get("indicators") or {}
        raw_summary = raw_indicators.get("summary") or {}

        default_indicator_confidence = {
            "score": payload.get("confidence", 55),
            "label": "medium" if payload.get("confidence", 55) >= 55 else "low",
            "signals": {},
        }

        default_indicators: Dict[str, Any] = {
            "rsi": {
                "value": None,
                "status": "Neutral",
            },
            "macd": {
                "macd": None,
                "signal": None,
                "histogram": None,
            },
            "ema_20_100": {
                "ema_20": None,
                "ema_100": None,
                "signal": "neutral",
            },
            "stochastic": {
                "k": None,
                "d": None,
            },
            "bollinger_bands": {
                "lower": None,
                "middle": None,
                "upper": None,
            },
            "summary": {
                "trend": "neutral",
                "score": 0,
                "indicator_confidence": default_indicator_confidence,
            },
        }

        merged_indicators = {**default_indicators}
        for key, val in raw_indicators.items():
            if isinstance(val, dict):
                merged_indicators[key] = {**merged_indicators.get(key, {}), **val}
            else:
                merged_indicators[key] = val

        # ensure summary nested structure is always complete
        merged_summary = {
            **default_indicators["summary"],
            **(merged_indicators.get("summary") or {}),
        }

        raw_indicator_confidence = raw_summary.get("indicator_confidence") or {}
        merged_summary["indicator_confidence"] = {
            **default_indicator_confidence,
            **raw_indicator_confidence,
        }

        merged_indicators["summary"] = merged_summary

        normalized = {
            "symbol": payload.get("symbol", symbol),
            "recommendation": payload.get("recommendation", "HOLD"),
            "confidence": payload.get("confidence", 55),
            "message": payload.get("message", f"{symbol} does not show a dominant direction right now."),
            "price": payload.get("price"),
            "indicators": merged_indicators,
            "highlights": payload.get("highlights", []),
            "warnings": payload.get("warnings", []),
            "suggested_actions": payload.get("suggested_actions", []),
            "updated_at": payload.get("updated_at"),
        }

        return normalized

    def _is_cacheable_payload(self, payload: Dict[str, Any]) -> bool:
        """Return True only for well-formed payloads; skip {} or malformed dicts."""
        if not isinstance(payload, dict) or not payload:
            return False

        required_keys = {
            "recommendation",
            "confidence",
            "message",
            "price",
            "indicators",
            "highlights",
            "warnings",
            "suggested_actions",
            "updated_at",
        }

        if not required_keys.issubset(payload.keys()):
            return False

        indicators = payload.get("indicators")
        if not isinstance(indicators, dict):
            return False

        return True


# Shared singleton
chatbot_service = ChatBotService()
