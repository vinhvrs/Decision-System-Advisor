import logging
from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext, SmoothResult
# from app.analyze.indicators.engine import IndicatorService

class AnalyzeEngine:
    def __init__(self):
        self.smoother = LanguageSmoother()
        # self.data_service = IndicatorService() 
        self.logger = logging.getLogger(__name__)

    def process_request(self, user_input: str, style: str = "standard") -> str:
        """Run inbound NLP, optional data fetch, then outbound phrasing."""
        # 1) Inbound context
        ctx = SmoothContext(direction='in', style_preset=style)
        
        # 2) NLP pass
        analysis: SmoothResult = self.smoother.smooth(user_input, ctx)
        
        # Missing ticker when data is required
        if ctx.get('decision', {}).get('error') == 'missing_ticker':
            return self._generate_response("Please specify a ticker", ctx)

        # 3) Data layer (placeholder hooks)
        data_payload = self._fetch_financial_data(analysis)

        # 4) Outbound phrasing
        return self._generate_response(data_payload, ctx)

    def _fetch_financial_data(self, analysis: SmoothResult) -> str:
        """Placeholder: load quotes/indicators from providers using intent + tickers."""
        intent = analysis.intent
        tickers = analysis.entities.get('tickers', [])
        
        if not tickers:
            return ""

        # Example routing:
        # if intent == 'price_request':
        #    return self.data_service.get_price(tickers[0])
        # elif intent == 'indicator_request':
        #    return self.data_service.calculate_indicators(tickers[0], analysis.entities.get('indicators'))
        
        return f"Technical data for {', '.join(tickers)}" # Mockup string

    def _generate_response(self, raw_content: str, ctx: SmoothContext) -> str:
        """Outbound pass: ComposeResponse + post-processor."""
        ctx.direction = 'out'
        # ComposeResponse + TextProcessor
        result = self.smoother.smooth(raw_content, ctx)
        return result.output_text

# Singleton instance
analyze_engine = AnalyzeEngine()