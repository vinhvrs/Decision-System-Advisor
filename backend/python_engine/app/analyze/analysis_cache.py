import json
import asyncio
import logging
from typing import Any, Dict, List, Optional

import redis
from config.settings import settings


class AnalysisCacheService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=getattr(settings, "REDIS_PASSWORD", None),
            decode_responses=True,
        )
        self.logger = logging.getLogger(__name__)
        self.ttl_seconds = 60 * 60 * 3  # 3h

    def _analysis_key(self, symbol: str) -> str:
        return f"{settings.REDIS_PREFIX}:analysis:{symbol.upper()}"

    async def get_analysis(self, symbol: str) -> Optional[Dict[str, Any]]:
        try:
            raw = self.redis_client.get(self._analysis_key(symbol))
            if not raw:
                return None
            return json.loads(raw)
        except Exception as e:
            self.logger.error(f"Redis get_analysis error for {symbol}: {e}")
            return None

    async def set_analysis(self, symbol: str, payload: Dict[str, Any]) -> bool:
        try:
            self.redis_client.setex(
                self._analysis_key(symbol),
                self.ttl_seconds,
                json.dumps(payload),
            )
            return True
        except Exception as e:
            self.logger.error(f"Redis set_analysis error for {symbol}: {e}")
            return False

    async def get_top_symbols_from_ranking(
        self,
        ranking_key: str = "liquidity:ranking:daily",
        limit: int = 100,
    ) -> List[str]:
        try:
            members = self.redis_client.zrevrange(ranking_key, 0, limit - 1)
            return [m.upper() for m in members if m]
        except Exception as e:
            self.logger.error(f"Redis get_top_symbols_from_ranking error: {e}")
            return []

    async def exists(self, symbol: str) -> bool:
        try:
            return bool(self.redis_client.exists(self._analysis_key(symbol)))
        except Exception as e:
            self.logger.error(f"Redis exists error for {symbol}: {e}")
            return False


analysis_cache_service = AnalysisCacheService()