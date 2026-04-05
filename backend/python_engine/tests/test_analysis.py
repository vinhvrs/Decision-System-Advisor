import os
import sys
import json
import asyncio
from datetime import datetime

# Add repo root so `app` imports resolve
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext
from app.analyze.indicator.engine import IndicatorService

class SystemTest:
    def __init__(self):
        self.smoother = LanguageSmoother()
        self.indicator_service = IndicatorService()
        self.test_messages = [
            # 1) Partial negation: expect AMZN, not AAPL
            "Analyze AMZN ",      

            # 2) Full negation: failed decision or no targets
            "I don't need the RSI of GOOG",                   

            # 3) Negate indicator: AMD tickers, MACD in negated list
            "Analyze AMD but not with MACD",                 

            # 4) Double negation: still extract MSFT
            "Don't ignore MSFT analysis",                    

            # 5) Exclusion: other symbols ok, GOOGL excluded
            "Show me everything except for GOOGL"             
        ]
        self.output_file = os.path.join(os.path.dirname(__file__), "output.txt")

    async def run_test(self):
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(f"=== SYSTEM TEST REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n\n")

            for msg in self.test_messages:
                f.write(f"USER REQUEST: {msg}\n")
                
                # 1) NLP inbound -> tickers
                ctx = SmoothContext(direction='in')
                analysis = self.smoother.smooth(msg, ctx)
                
                # First extracted ticker
                tickers = analysis.entities.get('tickers', [])
                symbol = tickers[0] if tickers else None

                if not symbol:
                    f.write(f"RESULT: Could not extract ticker from message.\n")
                else:
                    f.write(f"EXTRACTED SYMBOL: {symbol}\n")
                    
                    # 2) Redis cache (warmup from IndicatorService): key pattern analysis:{symbol}
                    from config.settings import settings
                    redis_key = f"{settings.REDIS_PREFIX}:analysis:{symbol}"
                    
                    redis_data = None
                    if self.indicator_service.redis_client:
                        raw_data = self.indicator_service.redis_client.get(redis_key)
                        if raw_data:
                            redis_data = json.loads(raw_data)

                    # 3) Write snapshot to file
                    if redis_data:
                        f.write(f"REDIS STATUS: Data Found\n")
                        f.write(f"INDICATORS: {json.dumps(redis_data.get('indicators'), indent=2)}\n")
                        f.write(f"SIGNALS: {json.dumps(redis_data.get('summary'), indent=2)}\n")
                        f.write(f"UPDATED AT: {redis_data.get('updated_at')}\n")
                    else:
                        f.write(f"REDIS STATUS: No data found for {symbol}. (Ensure Warmup is running)\n")
                
                f.write("-" * 50 + "\n")
            
            print(f"Test complete. Results saved to: {self.output_file}")

if __name__ == "__main__":
    tester = SystemTest()
    asyncio.run(tester.run_test())