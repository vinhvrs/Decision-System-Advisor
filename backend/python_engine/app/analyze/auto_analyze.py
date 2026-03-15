import logging
import asyncio
import pymysql
from typing import Dict, Any, Optional, List

from app.services.embedding.embedding_service import EmbeddingService
from app.services.context.qdrant_retriever import QdrantRetriever
from app.services.context.elastic_retriever import ElasticRetriever
from app.services.context.merger import ContextMerger
from app.connect.qdrant_client import QdrantService
from app.analyze.indicator.engine import IndicatorService
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
        symbol = symbol.upper()

        try:
            tasks = [
                self.embedding.embed(clean_text),
                self._fetch_technical_data(symbol),
            ]
            vector, tech_data = await asyncio.gather(*tasks)

            if not tech_data:
                return {
                    "symbol": symbol,
                    "response": {
                        "recommendation": "HOLD",
                        "confidence": 55,
                        "message": f"No technical data available for {symbol}.",
                        "highlights": [],
                        "warnings": ["Technical dataset is missing."],
                        "suggested_actions": [],
                    },
                }

            rag_tasks = [
                self.qdrant_retriever.search(vector, limit=3, symbol=symbol),
                self.elastic_retriever.search(clean_text, limit=3, symbol=symbol),
            ]
            v_results, e_results = await asyncio.gather(*rag_tasks)
            knowledge_base = self.merger.merge(v_results, e_results)

            advice_payload = await self._build_advice_payload(
                tech_data=tech_data,
                symbol=symbol,
                knowledge_base=knowledge_base,
            )

            return {
                "symbol": symbol,
                "response": advice_payload,
            }

        except Exception as e:
            self.logger.error(f"AutoAnalyzeService.analyze_symbol error for {symbol}: {e}")
            return {
                "symbol": symbol,
                "response": {
                    "recommendation": "HOLD",
                    "confidence": 55,
                    "message": f"Internal error while analyzing {symbol}.",
                    "highlights": [],
                    "warnings": ["System error during analysis."],
                    "suggested_actions": [],
                },
            }

    async def _build_advice_payload(self, tech_data: Dict, symbol: str, knowledge_base: List[Dict]) -> Dict:
        """
        Build technical conclusion using the old scoring style,
        but adapted to the actual cached/output structure.
        Output fields remain exactly:
        - recommendation
        - confidence
        - message
        - highlights
        - warnings
        - suggested_actions
        """
        ind = tech_data.get("indicators", {})
        sum_data = ind.get("summary", {}) or {}
        ema_cross = ind.get("ema_20_100", {}) or {}
        macd_data = ind.get("macd", {}) or {}
        bb_data = ind.get("bollinger_bands", {}) or {}

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
            highlights.append("Trend is neutral with no strong directional edge from moving averages.")

        # 2. RSI
        if rsi is not None and isinstance(rsi, (int, float)):
            rsi_diff = 50 - rsi
            score += int(rsi_diff * 0.4)

            if rsi < 30:
                warnings.append(
                    f"RSI ({rsi:.1f}) is deeply oversold, which may support a technical rebound but also signals weak momentum."
                )
            elif rsi < 35:
                warnings.append(
                    f"RSI ({rsi:.1f}) is near oversold territory, suggesting rebound potential."
                )
            elif rsi > 70:
                warnings.append(
                    f"RSI ({rsi:.1f}) is overbought, increasing pullback risk."
                )
            elif rsi > 65:
                warnings.append(
                    f"RSI ({rsi:.1f}) is elevated, which may limit short-term upside."
                )
            else:
                highlights.append(f"RSI ({rsi:.1f}) is in a relatively neutral range.")

        # 3. MACD
        if macd_val is not None and macd_sig is not None:
            if macd_val > macd_sig:
                score += 8
                highlights.append("MACD is above the signal line, indicating improving bullish momentum.")
            elif macd_val < macd_sig:
                score -= 8
                highlights.append("MACD is below the signal line, indicating weakening short-term momentum.")
            else:
                highlights.append("MACD is flat versus the signal line, showing limited momentum confirmation.")

            # Extra penalty if MACD gap is meaningfully weak
            try:
                if macd_val < macd_sig and abs(macd_val - macd_sig) > 1.0:
                    score -= 3
            except Exception:
                pass

        # 4. EMA crossover signal
        cross_signal = ema_cross.get("signal")
        if cross_signal == "golden_cross":
            score += 25
            highlights.append("Golden Cross detected on EMA 20/100, strengthening the bullish case.")
        elif cross_signal == "death_cross":
            score -= 25
            highlights.append("Death Cross detected on EMA 20/100, reinforcing downside risk.")
        elif cross_signal == "neutral":
            highlights.append("No strong EMA crossover signal is currently active.")

        # 5. Bollinger Bands
        if (
            price is not None
            and isinstance(price, (int, float))
            and lower_bb is not None
            and middle_bb is not None
            and upper_bb is not None
        ):
            if price <= lower_bb:
                score += 6
                warnings.append(
                    f"Price ({price:.2f}) is testing or falling below the lower Bollinger Band, which may indicate short-term oversold conditions."
                )
            elif price >= upper_bb:
                score -= 6
                warnings.append(
                    f"Price ({price:.2f}) is near or above the upper Bollinger Band, which may indicate stretched upside."
                )
            elif price < middle_bb:
                highlights.append(
                    f"Price ({price:.2f}) is below the Bollinger midline ({middle_bb:.2f}), so short-term recovery still needs confirmation."
                )
            else:
                highlights.append(
                    f"Price ({price:.2f}) is holding above the Bollinger midline ({middle_bb:.2f}), which supports price stability."
                )

        # Extra combined oversold note
        if (
            rsi is not None
            and isinstance(rsi, (int, float))
            and rsi < 35
            and price is not None
            and isinstance(price, (int, float))
            and lower_bb is not None
            and isinstance(lower_bb, (int, float))
            and price <= lower_bb
        ):
            warnings.append(
                "Multiple oversold signals are appearing together, which may lead to a rebound but also reflects current weakness."
            )

        # 6. News / context
        if knowledge_base:
            news_count = 0
            for item in knowledge_base:
                if news_count >= 2:
                    break

                payload_data = item.get("payload", {}) or {}
                snippet = (
                    payload_data.get("title")
                    or payload_data.get("content")
                    or payload_data.get("text", "")
                )

                if snippet:
                    clean_snippet = snippet[:120] + "..." if len(snippet) > 120 else snippet
                    highlights.append(f"Recent News: {clean_snippet}")
                    news_count += 1

                    if trend_status == "bullish":
                        score += 5
                    elif trend_status == "bearish":
                        score -= 5

        # 7. Recommendation
        recommendation = "HOLD"
        if score >= 30:
            recommendation = "BUY"
        elif score <= -30:
            recommendation = "SELL"

        # 8. Confidence
        confidence = min(abs(score) + 55, 95)

        # 9. Message
        if recommendation == "BUY":
            message = (
                f"{symbol} shows a constructive technical setup. "
                f"The broader trend remains {trend_status}, and current signals support selective accumulation."
            )
        elif recommendation == "SELL":
            message = (
                f"{symbol} shows a weak technical structure. "
                f"The broader trend remains {trend_status}, and momentum signals suggest downside risk is still present."
            )
        else:
            if trend_status == "bullish" and macd_val is not None and macd_sig is not None and macd_val < macd_sig:
                message = (
                    f"{symbol} remains in a bullish broader trend, but short-term momentum is still weak. "
                    f"Holding is more reasonable than aggressively buying at this stage."
                )
            elif trend_status == "bearish":
                message = (
                    f"{symbol} is still under pressure from a bearish broader trend. "
                    f"Holding is cautious, but confirmation is needed before expecting recovery."
                )
            else:
                message = (
                    f"{symbol} does not show a dominant technical direction right now. "
                    f"The setup is mixed, so waiting for stronger confirmation is the safer approach."
                )

        # 10. Suggested actions
        suggested_actions = await self._fetch_sql_inference_data(symbol)

        return {
            "recommendation": recommendation,
            "confidence": confidence,
            "message": message,
            "highlights": highlights,
            "warnings": warnings,
            "suggested_actions": suggested_actions,
        }

    async def _fetch_sql_inference_data(self, symbol: str) -> List[Dict]:
        conn = None
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            with conn.cursor() as cursor:
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
            self.logger.error(f"SQL Inference Fetch Error: {e}")
            return await asyncio.to_thread(
                self.indicator_service.get_inference_results,
                symbol,
            )
        finally:
            if conn:
                conn.close()

    async def _fetch_technical_data(self, symbol: Optional[str]) -> Optional[Dict]:
        """
        Fallback to indicator engine.
        Redis read is handled by analysis_cache_service in chatbot flow.
        """
        if not symbol:
            return None
        try:
            return await asyncio.to_thread(self.indicator_service.process_and_cache, symbol)
        except Exception as e:
            self.logger.error(f"Indicator Engine Error for {symbol}: {e}")
            return None


auto_analyze_service = AutoAnalyzeService()