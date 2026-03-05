import logging
from typing import Dict, Any

from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext
from app.services.embedding.main import EmbeddingService
from app.services.context.qdrant_retriever import QdrantRetriever
from app.services.context.elastic_retriever import ElasticRetriever
from app.services.context.merger import ContextMerger
from app.connect.qdrant_client import QdrantService

class ChatBotService:
    def __init__(self):
        # 1. NLP Engine
        self.smoother = LanguageSmoother()
        
        # 2. RAG Components
        self.embedding = EmbeddingService()
        self.qdrant_retriever = QdrantRetriever(QdrantService())
        self.elastic_retriever = ElasticRetriever()
        self.merger = ContextMerger()
        
        self.logger = logging.getLogger(__name__)

    async def handle_message(self, user_text: str, style: str = "standard") -> Dict[str, Any]:
        """
        Luồng xử lý tin nhắn chính (End-to-End)
        """
        try:
            # GIAI ĐOẠN 1: Phân tích ý định (Inbound NLP)
            ctx = SmoothContext(direction='in', style_preset=style)
            analysis = self.smoother.smooth(user_text, ctx)
            
            # Kiểm tra lỗi logic ngay lập tức (ví dụ: thiếu mã cổ phiếu)
            if ctx.has_error():
                return {
                    "status": "error",
                    "response": self._outbound_finalize("Please provide a specific ticker symbol (e.g., AAPL).", ctx),
                    "meta": analysis.decision
                }

            # GIAI ĐOẠN 2: Truy xuất kiến thức (Hybrid RAG)
            # Chuyển text đã chuẩn hóa sang vector
            vector = await self.embedding.embed(analysis.clean_text)
            symbol = analysis.entities.get('tickers', [None])[0]
            
            # Chạy song song tìm kiếm Vector và Keyword
            import asyncio
            v_task = asyncio.create_task(
                self.qdrant_retriever.search(vector, limit=5, symbol=symbol)
            )
            e_task = asyncio.create_task(
                self.elastic_retriever.search(analysis.clean_text, limit=5, symbol=symbol)
            )
            
            v_results, e_results = await asyncio.gather(v_task, e_task)
            
            # Hợp nhất và xếp hạng (Weighting & Recency Boost)
            knowledge_base = self.merger.merge(v_results, e_results)

            # GIAI ĐOẠN 3: Tổng hợp câu trả lời (Outbound)
            # Ở đây bạn có thể gọi LLM hoặc dùng Rule-based composer tùy Strategy
            raw_answer = self._generate_answer_logic(analysis, knowledge_base)
            
            final_response = self._outbound_finalize(raw_answer, ctx)

            return {
                "status": "success",
                "response": final_response,
                "intent": analysis.intent,
                "entities": analysis.entities,
                "source_count": len(knowledge_base)
            }

        except Exception as e:
            self.logger.error(f"ChatBot Error: {str(e)}")
            return {"status": "error", "response": "An unexpected error occurred. Please try again later."}

    def _generate_answer_logic(self, analysis: Any, knowledge: list) -> str:
        """
        Logic kết hợp dữ liệu thô từ Knowledge Base thành câu văn.
        Tương đương với việc chuẩn bị payload cho OpenAI/Claude hoặc Local Composer.
        """
        if not knowledge:
            return "No recent data found for this request."
            
        # Lấy nội dung từ top results
        context_text = " ".join([item['payload'].get('content', '') for item in knowledge[:3]])
        return context_text # Trả về để Outbound pipeline làm mượt

    def _outbound_finalize(self, text: str, ctx: SmoothContext) -> str:
        """
        Chạy pipeline làm mượt đầu ra (Glossary, Punctuation, Style)
        """
        ctx.direction = 'out'
        result = self.smoother.smooth(text, ctx)
        return result.output_text

# Khởi tạo service dùng chung
chatbot_service = ChatBotService()