import logging
from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext, SmoothResult
# Giả định các service dữ liệu của bạn
# from app.analyze.indicators.engine import IndicatorService 

class AnalyzeEngine:
    def __init__(self):
        self.smoother = LanguageSmoother()
        # self.data_service = IndicatorService() 
        self.logger = logging.getLogger(__name__)

    def process_request(self, user_input: str, style: str = "standard") -> str:
        """
        Quy trình xử lý yêu cầu tổng thể (giống workflow chính trong PHP)
        """
        # 1. Khởi tạo Context cho lượt vào (Inbound)
        ctx = SmoothContext(direction='in', style_preset=style)
        
        # 2. NLP Analysis: Phân tích Intent, Entities và đưa ra Decision
        # (Đối chiếu LanguageSmoother.php -> smooth() lượt 1)
        analysis: SmoothResult = self.smoother.smooth(user_input, ctx)
        
        # Nếu có lỗi nghiêm trọng (ví dụ: thiếu Ticker cho yêu cầu cần dữ liệu)
        # DecisionBuilder trong pipeline đã đánh dấu lỗi này vào ctx.memory
        if ctx.get('decision', {}).get('error') == 'missing_ticker':
            return self._generate_response("Please specify a ticker", ctx)

        # 3. Data Execution: Lấy dữ liệu dựa trên kết quả phân tích
        # (Bước này tương ứng với việc gọi Provider/Repository trong PHP)
        data_payload = self._fetch_financial_data(analysis)

        # 4. Final Response Construction: Tạo câu trả lời hoàn chỉnh (Outbound)
        # (Đối chiếu LanguageSmoother.php -> smooth() lượt 2)
        return self._generate_response(data_payload, ctx)

    def _fetch_financial_data(self, analysis: SmoothResult) -> str:
        """
        Thực thi lấy dữ liệu thực tế dựa trên Intent và Tickers đã nhận diện
        """
        intent = analysis.intent
        tickers = analysis.entities.get('tickers', [])
        
        if not tickers:
            return ""

        # Ví dụ logic điều hướng:
        # if intent == 'price_request':
        #    return self.data_service.get_price(tickers[0])
        # elif intent == 'indicator_request':
        #    return self.data_service.calculate_indicators(tickers[0], analysis.entities.get('indicators'))
        
        return f"Technical data for {', '.join(tickers)}" # Mockup string

    def _generate_response(self, raw_content: str, ctx: SmoothContext) -> str:
        """
        Chạy Pipeline Outbound để làm mượt văn bản trả về
        """
        ctx.direction = 'out'
        # smooth() lượt về sẽ chạy qua ComposeResponse và PostProcessor
        result = self.smoother.smooth(raw_content, ctx)
        return result.output_text

# Singleton instance
analyze_engine = AnalyzeEngine()