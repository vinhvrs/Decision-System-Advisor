import logging
import json
import redis
import asyncio
import pymysql
from typing import Dict, Any, Optional, List

from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext
from app.services.embedding.embedding_service import EmbeddingService
from app.services.context.qdrant_retriever import QdrantRetriever
from app.services.context.elastic_retriever import ElasticRetriever
from app.services.context.merger import ContextMerger
from app.connect.qdrant_client import QdrantService
from app.analyze.indicator.engine import IndicatorService
from app.analyze.composer.phrase_repository import PhraseRepository
from app.analyze.composer.clause_builder import ClauseBuilder
from config.settings import Config, settings

class ChatBotService:
    def __init__(self):
        # 1. NLP Engine for Inbound/Outbound processing
        self.smoother = LanguageSmoother()
        
        # 2. RAG Components
        self.embedding = EmbeddingService()
        self.qdrant_retriever = QdrantRetriever(QdrantService())
        self.elastic_retriever = ElasticRetriever()
        self.merger = ContextMerger()
        
        # 3. Technical Engine for Cache-Aside logic
        self.indicator_service = IndicatorService()
        
        # 4. Redis Client
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=getattr(settings, 'REDIS_PASSWORD', None),
            decode_responses=True
        )
        self.logger = logging.getLogger(__name__)

    async def handle_message(self, user_text: str, style: str = "standard") -> Dict[str, Any]:
        """
        Quy trình xử lý Hybrid: NLP -> Technical Data + Elastic/Qdrant -> Decision Engine -> JSON Advice
        """
        try:
            # PHASE 1: Phân tích NLP (Intent & Entities)
            ctx = SmoothContext(direction='in', style_preset=style)
            inbound_result = self.smoother.smooth(user_text, ctx)
            
            if ctx.has_error() or not inbound_result.entities.get('tickers'):
                return {
                    "type": "error",
                    "response": "Please provide a valid stock ticker (e.g., NVDA) for analysis."
                }

            # PHASE 2: Truy xuất dữ liệu (Parallel Retrieval)
            symbol = inbound_result.entities.get('tickers')[0].upper()
            
            # 2.1 Lấy Data kỹ thuật & Vector hóa câu hỏi cùng lúc
            tasks = [
                self.embedding.embed(inbound_result.clean_text),
                self._fetch_technical_data(symbol),
            ]
            vector, tech_data = await asyncio.gather(*tasks)
            
            print(f"DEBUG TECH DATA FOR {symbol}: ", json.dumps(tech_data, indent=2))
            
            if not tech_data:
                return {"type": "error", "message": f"No technical data available for {symbol}."}

            # 2.2 Gọi Hybrid Search (Elastic + Qdrant) để tìm tin tức liên quan
            rag_tasks = [
                self.qdrant_retriever.search(vector, limit=3, symbol=symbol),
                self.elastic_retriever.search(inbound_result.clean_text, limit=3, symbol=symbol)
            ]
            v_results, e_results = await asyncio.gather(*rag_tasks)
            
            # Trộn và tính điểm kết quả RAG
            knowledge_base = self.merger.merge(v_results, e_results)

            # PHASE 3: Decision Engine (Truyền cả Tech Data và Knowledge Base vào)
            advice_payload = await self._build_advice_payload(tech_data, symbol, knowledge_base)

            # PHASE 4: Format JSON chuẩn hóa
            return {
                "type": "advice",
                "period": "daily",
                "results": [
                    {
                        "symbol": symbol,
                        "response": advice_payload
                    }
                ]
            }

        except Exception as e:
            self.logger.error(f"ChatBot Error: {str(e)}")
            return {"type": "error", "message": "Internal server error."}

    async def _build_advice_payload(self, tech_data: Dict, symbol: str, knowledge_base: List[Dict]) -> Dict:
        """
        Xây dựng kết luận kỹ thuật chi tiết. Đã áp dụng Dynamic Scoring (RSI + MACD)
        """
        ind = tech_data.get('indicators', {})
        sum_data = ind.get('summary', {})
        ema_cross = ind.get('ema_20_100', {})
        rsi = ind.get('rsi')
        
        score = 0
        highlights = []
        warnings = []

        # 1. Đánh giá Xu hướng (Trend)
        trend_status = sum_data.get('trend_20_100') or sum_data.get('trend')
        if trend_status == "bullish":
            score += 30
            highlights.append("Trend is bullish based on moving averages.")
        elif trend_status == "bearish":
            score -= 30
            highlights.append("Trend is bearish based on moving averages.")

        # 2. Đánh giá RSI (Tính điểm động - Dynamic Scoring)
        if rsi is not None and isinstance(rsi, (int, float)):
            # RSI càng nhỏ (<50), điểm cộng càng cao (Oversold). Càng lớn (>50), điểm trừ càng nhiều.
            rsi_diff = 50 - rsi 
            score += int(rsi_diff * 0.4) # Tỉ lệ 0.4 giúp điểm mượt mà (VD: RSI 30 -> +8đ, RSI 70 -> -8đ)

            if rsi < 35:
                warnings.append(f"RSI ({rsi:.1f}) indicates oversold conditions (rebound potential).")
            elif rsi > 65:
                warnings.append(f"RSI ({rsi:.1f}) indicates overbought conditions (correction risk).")

        # 3. Đánh giá MACD (Chỉ báo Động lượng mới thêm vào)
        macd_data = ind.get('macd', {})
        macd_val = macd_data.get('macd')
        macd_sig = macd_data.get('signal')
        
        if macd_val is not None and macd_sig is not None:
            if macd_val > macd_sig:
                score += 8
                highlights.append("MACD is tracking above the signal line (Bullish momentum).")
            elif macd_val < macd_sig:
                score -= 8
                highlights.append("MACD is tracking below the signal line (Bearish momentum).")

        # 4. Đánh giá Crossover (EMA 20/100)
        if ema_cross.get('signal') == "golden_cross":
            score += 25
            highlights.append("Golden Cross detected (20 EMA above 100 EMA).")
        elif ema_cross.get('signal') == "death_cross":
            score -= 25
            highlights.append("Death Cross detected (20 EMA below 100 EMA).")

        # 5. Tích hợp News/Context từ RAG vào Highlights
        if knowledge_base:
            news_count = 0
            for item in knowledge_base:
                if news_count >= 2:
                    break
                
                payload_data = item.get('payload', {})
                snippet = payload_data.get('title') or payload_data.get('content') or payload_data.get('text', '')
                
                if snippet:
                    clean_snippet = snippet[:120] + "..." if len(snippet) > 120 else snippet
                    highlights.append(f"Recent News: {clean_snippet}")
                    news_count += 1
                    
                    # Cộng/Trừ nhẹ điểm tin cậy dựa trên trend hiện tại
                    score += 5 if trend_status == "bullish" else -5 

        # 6. Xác định Khuyến nghị & Độ tin cậy (Confidence)
        recommendation = "HOLD"
        if score >= 30: recommendation = "BUY"
        elif score <= -30: recommendation = "SELL"
        
        # Scale về 55-95%. Nhờ tính điểm động ở trên, số này sẽ không bị tròn nữa.
        confidence = min(abs(score) + 55, 95) 

        # 7. Tạo Message văn bản từ Thư viện
        intro = ClauseBuilder.pick(PhraseRepository.intro(recommendation), symbol)
        safe_trend = trend_status if trend_status else "neutral"
        message = f"{intro} the broader trend remains {safe_trend}, momentum indicators are mostly neutral."

        # 8. suggest actions based on historical inference data from SQL
        suggested_actions = await self._fetch_sql_inference_data(symbol)

        return {
            "recommendation": recommendation,
            "confidence": confidence,
            "message": message,
            "highlights": highlights,
            "warnings": warnings,
            "suggested_actions": suggested_actions
        }
        
    async def _fetch_sql_inference_data(self, symbol: str) -> List[Dict]:
        """
        Truy vấn dữ liệu từ bảng knowledge_inference_results trong SQL.
        """
        conn = None
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            with conn.cursor() as cursor:
                cursor.execute("SELECT recommendation, title, published_at "
                                "FROM knowledge_inference_results "
                                "WHERE symbol = %s ORDER BY published_at DESC LIMIT 1", (symbol,))
                return cursor.fetchall()
        except Exception as e:
            self.logger.error(f"SQL Inference Fetch Error: {e}")
            return await asyncio.to_thread(self.indicator_service.get_inference_results, symbol)
        finally:
            if conn:
                conn.close()

    async def _fetch_technical_data(self, symbol: Optional[str]) -> Optional[Dict]:
        """Cache-Aside Logic: Redis (3hr TTL) -> Indicator Engine"""
        if not symbol: return None
        redis_key = f"{settings.REDIS_PREFIX}:analysis:{symbol.upper()}"
        
        try:
            raw = self.redis_client.get(redis_key)
            if raw: return json.loads(raw)
            return await asyncio.to_thread(self.indicator_service.process_and_cache, symbol)
        except Exception as e:
            self.logger.error(f"Redis/Engine Error: {e}")
            return None

    def _outbound_finalize(self, text: str, ctx: SmoothContext) -> str:
        """Sử dụng Phrase Library cho các phản hồi văn bản"""
        ctx.direction = 'out'
        result = self.smoother.smooth(text, ctx)
        return result.output_text

chatbot_service = ChatBotService()