import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List

import pandas as pd
import pymysql

from app.services.embedding.embedding_service import EmbeddingService
from app.services.context.qdrant_retriever import QdrantRetriever
from app.services.context.elastic_retriever import ElasticRetriever
from app.services.context.merger import ContextMerger
from app.connect.qdrant_client import QdrantService
from app.analyze.indicator.engine import IndicatorService
from app.analyze.analysis_cache import analysis_cache_service
from config.settings import Config

class AutoAnalyzeService:
    def __init__(self):
        self.embedding = EmbeddingService()
        self.qdrant_retriever = QdrantRetriever(QdrantService())
        self.elastic_retriever = ElasticRetriever()
        self.merger = ContextMerger()
        self.indicator_service = IndicatorService()
        self.logger = logging.getLogger(__name__)

    async def analyze_symbol(self, symbol: str, clean_text: str) -> Dict[str, Any]:
        symbol = (symbol or "").strip().upper()

        try:
            # 1. Collect embedding + technical analysis in parallel
            tasks = [
                self.embedding.embed(clean_text),
                self._fetch_technical_data(symbol),
            ]
            vector, tech_data = await asyncio.gather(*tasks)

            if not tech_data:
                # DB candles missing (e.g. symbol not in local DB) but Laravel / batch jobs may
                # still have summary:analysis:{SYMBOL} in Redis — use that instead of failing.
                redis_snapshot = await analysis_cache_service.get_analysis(symbol)
                if redis_snapshot and isinstance(redis_snapshot, dict):
                    hl = redis_snapshot.get("highlights")
                    ind = redis_snapshot.get("indicators")
                    if hl is not None or (isinstance(ind, dict) and ind):
                        self.logger.info(
                            "No SQL candles for %s; using existing Redis analysis snapshot",
                            symbol,
                        )
                        return redis_snapshot

                return self._build_error_payload(symbol, "Technical dataset is missing.")

            # 2. RAG retrieval
            rag_tasks = [
                self.qdrant_retriever.search(vector, limit=3, symbol=symbol),
                self.elastic_retriever.search(clean_text, limit=3, symbol=symbol),
            ]
            v_results, e_results = await asyncio.gather(*rag_tasks)
            knowledge_base = self.merger.merge(v_results, e_results)

            # 3. Build final advice payload
            advice_payload = await self._build_advice_payload(
                tech_data=tech_data,
                symbol=symbol,
                knowledge_base=knowledge_base,
            )

            return advice_payload

        except Exception as e:
            self.logger.error(f"AutoAnalyzeService.analyze_symbol error for {symbol}: {e}", exc_info=True)
            return self._build_error_payload(symbol, str(e))

    async def _build_advice_payload(
        self,
        tech_data: Dict[str, Any],
        symbol: str,
        knowledge_base: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Build final JSON output from:
        - technical payload produced by IndicatorService
        - RAG knowledge base
        - SQL inference suggestions
        """
        ind = tech_data.get("indicators", {}) or {}
        sum_data = ind.get("summary", {}) or {}
        ema_cross = ind.get("ema_20_100", {}) or {}
        macd_data = ind.get("macd", {}) or {}
        bb_data = ind.get("bollinger_bands", {}) or {}
        stoch_data = ind.get("stochastic", {}) or {}
        confidence_data = tech_data.get("confidence", {}) or {}

        price = tech_data.get("price")
        rsi = ind.get("rsi")
        macd_val = macd_data.get("macd")
        macd_sig = macd_data.get("signal")
        lower_bb = bb_data.get("lower")
        middle_bb = bb_data.get("middle")
        upper_bb = bb_data.get("upper")

        score = 0
        highlights: List[str] = []
        warnings: List[str] = []

        # 1. Trend
        trend_status = sum_data.get("trend_20_100") or sum_data.get("trend") or "neutral"
        if trend_status == "bullish":
            score += 30
            highlights.append("Trend is bullish based on the 20/100 EMA structure.")
        elif trend_status == "bearish":
            score -= 30
            highlights.append("Trend is bearish based on the 20/100 EMA structure.")
        else:
            highlights.append("Trend is neutral with no strong directional edge.")

        # 2. RSI
        if isinstance(rsi, (int, float)):
            rsi_diff = 50 - rsi
            score += int(rsi_diff * 0.4)

            if rsi < 30:
                warnings.append(f"RSI ({rsi:.1f}) is deeply oversold.")
            elif rsi > 70:
                warnings.append(f"RSI ({rsi:.1f}) is overbought.")

        # 3. MACD
        if isinstance(macd_val, (int, float)) and isinstance(macd_sig, (int, float)):
            if macd_val > macd_sig:
                score += 8
                highlights.append("MACD is above the signal line (Bullish momentum).")
            elif macd_val < macd_sig:
                score -= 8
                highlights.append("MACD is below the signal line (Bearish momentum).")

        # 4. News influence
        if knowledge_base:
            for item in knowledge_base[:2]:
                payload_data = item.get("payload", {}) or {}
                snippet = payload_data.get("title") or payload_data.get("text", "")
                if snippet:
                    highlights.append(f"Recent News: {snippet[:100]}...")
                    score += 5 if trend_status == "bullish" else -5

        # 5. Recommendation
        recommendation = "HOLD"
        if score >= 30:
            recommendation = "BUY"
        elif score <= -30:
            recommendation = "SELL"

        # Prefer confidence from indicator engine if present
        confidence_score = confidence_data.get("score")
        if not isinstance(confidence_score, (int, float)):
            confidence_score = min(abs(score) + 55, 95)

        # Message
        if recommendation == "BUY":
            message = f"{symbol} shows a constructive setup. Trend is {trend_status}."
        elif recommendation == "SELL":
            message = f"{symbol} shows a weak structure. Trend is {trend_status}."
        else:
            message = f"{symbol} does not show a dominant direction right now."

        response_payload = {
            "symbol": symbol,
            "recommendation": recommendation,
            "confidence": self._safe_number(confidence_score),
            "message": message,
            "price": price,
            "indicators": {
                "rsi": {
                    "value": self._safe_number(rsi),
                    "status": (
                        "Oversold" if isinstance(rsi, (int, float)) and rsi < 30
                        else "Overbought" if isinstance(rsi, (int, float)) and rsi > 70
                        else "Neutral"
                    ),
                },
                "macd": {
                    "macd": self._safe_number(macd_val),
                    "signal": self._safe_number(macd_sig),
                    "histogram": self._safe_number(macd_data.get("histogram")),
                },
                "ema_20_100": {
                    "ema_20": self._safe_number(ema_cross.get("ema_20")),
                    "ema_100": self._safe_number(ema_cross.get("ema_100")),
                    "signal": ema_cross.get("signal"),
                },
                "stochastic": {
                    "k": self._safe_number(stoch_data.get("k")),
                    "d": self._safe_number(stoch_data.get("d")),
                },
                "bollinger_bands": {
                    "lower": self._safe_number(lower_bb),
                    "middle": self._safe_number(middle_bb),
                    "upper": self._safe_number(upper_bb),
                },
                "summary": {
                    "trend": trend_status,
                    "score": score,
                    "indicator_confidence": confidence_data,
                },
            },
            "highlights": highlights,
            "warnings": warnings,
            "suggested_actions": await self._fetch_sql_inference_data(symbol),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        # success = await analysis_cache_service.set_analysis(symbol, response_payload)
        # if success:
        #     self.logger.info(f"✅ Saved cache for {symbol}")
        # else:
        #     self.logger.error(f"❌ Failed to save cache for {symbol}")

        return response_payload

    async def _fetch_sql_inference_data(self, symbol: str) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT recommendation, title, published_at
                    FROM knowledge_inference_results
                    WHERE symbol = %s
                    ORDER BY published_at DESC
                    LIMIT 1
                    """,
                    (symbol,),
                )
                return cursor.fetchall()
        except Exception as e:
            self.logger.error(f"SQL Inference Fetch Error for {symbol}: {e}", exc_info=True)
            return []
        finally:
            if conn:
                conn.close()

    async def _fetch_technical_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        New flow:
        1. Load candle data from DB
        2. Convert to DataFrame
        3. Call indicator engine build_analysis_payload(symbol, df)
        """
        try:
            return await asyncio.to_thread(self._build_technical_payload_from_db, symbol)
        except Exception as e:
            self.logger.error(f"Indicator Engine Error for {symbol}: {e}", exc_info=True)
            return None

    def _build_technical_payload_from_db(self, symbol: str) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        d.open,
                        d.high,
                        d.low,
                        d.close,
                        d.volume,
                        d.timestamps
                    FROM instrument_data d
                    JOIN instrument_periods p ON d.instrument_period_id = p.id
                    JOIN instruments i ON p.instrument_id = i.id
                    WHERE i.symbol = %s
                      AND p.period = 'daily'
                    ORDER BY d.timestamps DESC
                    LIMIT 300
                    """,
                    (symbol,),
                )
                rows = cursor.fetchall()

            if not rows:
                self.logger.warning(f"No candle data found for {symbol}")
                return None

            df = pd.DataFrame(rows)
            return self.indicator_service.build_analysis_payload(symbol, df)

        except Exception as e:
            self.logger.error(f"_build_technical_payload_from_db failed for {symbol}: {e}", exc_info=True)
            return None
        finally:
            if conn:
                conn.close()

    def _safe_number(self, value: Any) -> Optional[float]:
        try:
            return float(value) if value is not None else None
        except Exception:
            return None

    def _build_error_payload(self, symbol: str, error_msg: str) -> Dict[str, Any]:
        return {
            "symbol": symbol,
            "recommendation": "HOLD",
            "confidence": 55,
            "message": f"System error analyzing {symbol}: {error_msg}",
            "price": None,
            "indicators": {},
            "highlights": [],
            "warnings": ["System currently unavailable."],
            "suggested_actions": [],
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


auto_analyze_service = AutoAnalyzeService()