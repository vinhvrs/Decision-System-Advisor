import json
import asyncio
import logging
from typing import Any, Dict, List, Optional

from config.settings import settings


class AnalysisCacheService:
    def __init__(self):
        self.redis_client = settings.redis_client()
        self.logger = logging.getLogger(__name__)
        self.ttl_seconds = 60 * 60 * 3  # 3h

    def _analysis_key(self, symbol: str) -> str:
        return f"{settings.REDIS_PREFIX}:analysis:{(symbol or '').strip().upper()}"

    async def get_analysis(self, symbol: str) -> Optional[Dict[str, Any]]:
        try:
            raw = await asyncio.to_thread(
                self.redis_client.get,
                self._analysis_key(symbol),
            )
            if not raw:
                return None
            return json.loads(raw)
        except Exception as e:
            self.logger.error(f"Redis get_analysis error for {symbol}: {e}", exc_info=True)
            return None

    async def set_analysis(self, symbol: str, payload: Dict[str, Any]) -> bool:
        key = self._analysis_key(symbol)

        try:
            if not isinstance(payload, dict):
                self.logger.error(
                    f"set_analysis rejected non-dict payload for {symbol}: {type(payload)}"
                )
                return False

            if not payload:
                self.logger.warning(f"set_analysis received empty payload for {symbol}")
                return False

            safe_payload_json = json.dumps(payload, default=str, ensure_ascii=False)

            def _write_and_verify():
                result = self.redis_client.set(
                    key,
                    safe_payload_json,
                    ex=self.ttl_seconds,
                )
                saved_value = self.redis_client.get(key)
                return result, saved_value

            result, saved_value = await asyncio.to_thread(_write_and_verify)

            if not result:
                self.logger.error(f"Redis SET returned falsy for {symbol}, key={key}")
                return False

            if not saved_value:
                self.logger.error(f"Redis saved empty/null value for {symbol}, key={key}")
                return False

            if saved_value == "{}":
                self.logger.error(
                    f"Redis value became empty object for {symbol}, key={key}. "
                    f"Possible overwrite detected."
                )

            self.logger.info(
                f"Saved analysis cache for {symbol}, key={key}, "
                f"json_len={len(safe_payload_json)}, saved_len={len(saved_value)}"
            )
            return True

        except Exception as e:
            self.logger.error(f"Redis set_analysis error for {symbol}: {e}", exc_info=True)
            return False

    async def get_top_symbols_from_ranking(
        self,
        ranking_key: str = "liquidity:ranking:daily",
        limit: int = 100,
    ) -> List[str]:
        try:
            members = await asyncio.to_thread(
                self.redis_client.zrevrange,
                ranking_key,
                0,
                limit - 1,
                withscores=True,
            )
            return [str(m[0]).upper() for m in members if m and m[0]]
        except Exception as e:
            self.logger.error(f"Redis get_top_symbols_from_ranking error: {e}", exc_info=True)
            return []

    async def exists(self, symbol: str) -> bool:
        try:
            exists = await asyncio.to_thread(
                self.redis_client.exists,
                self._analysis_key(symbol),
            )
            return bool(exists)
        except Exception as e:
            self.logger.error(f"Redis exists error for {symbol}: {e}", exc_info=True)
            return False


analysis_cache_service = AnalysisCacheService()