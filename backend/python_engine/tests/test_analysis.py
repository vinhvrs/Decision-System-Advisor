import os
import sys
import json
import asyncio
from datetime import datetime

# Thêm đường dẫn gốc vào hệ thống để import được các module app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.analyze.nlp.resolver import LanguageSmoother
from app.analyze.nlp.models import SmoothContext
from app.analyze.indicator.engine import IndicatorService  # Module bạn đã upload

class SystemTest:
    def __init__(self):
        self.smoother = LanguageSmoother()
        self.indicator_service = IndicatorService()
        self.test_messages = [
            # 1. Phủ định 1 phần: Phải trích xuất AMZN, loại bỏ AAPL
            "Don't show me AAPL, analyze AMZN instead",      

            # 2. Phủ định hoàn toàn: Decision phải báo status 'failed' hoặc không có targets
            "I don't need the RSI of GOOG",                   

            # 3. Phủ định Indicator: Trích xuất AMD, nhưng MACD phải nằm trong 'negated'
            "Analyze AMD but not with MACD",                 

            # 4. Phủ định của phủ định: Phải trích xuất MSFT thành công (Double Negation)
            "Don't ignore MSFT analysis",                    

            # 5. Loại trừ: Phải trích xuất các mã khác và đánh dấu GOOGL là loại trừ
            "Show me everything except for GOOGL"             
        ]
        self.output_file = os.path.join(os.path.dirname(__file__), "output.txt")

    async def run_test(self):
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(f"=== SYSTEM TEST REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n\n")

            for msg in self.test_messages:
                f.write(f"USER REQUEST: {msg}\n")
                
                # 1. Chạy NLP Inbound để lấy Ticker
                ctx = SmoothContext(direction='in')
                analysis = self.smoother.smooth(msg, ctx)
                
                # Lấy symbol từ kết quả phân tích entities
                tickers = analysis.entities.get('tickers', [])
                symbol = tickers[0] if tickers else None

                if not symbol:
                    f.write(f"RESULT: Could not extract ticker from message.\n")
                else:
                    f.write(f"EXTRACTED SYMBOL: {symbol}\n")
                    
                    # 2. Truy xuất dữ liệu từ Redis (Dữ liệu đã được Warmup bởi IndicatorService)
                    # Theo logic của engine.py: redis_key = f"{Config.REDIS_PREFIX}:analysis:{symbol}"
                    from config.settings import settings
                    redis_key = f"{settings.REDIS_PREFIX}:analysis:{symbol}"
                    
                    redis_data = None
                    if self.indicator_service.redis_client:
                        raw_data = self.indicator_service.redis_client.get(redis_key)
                        if raw_data:
                            redis_data = json.loads(raw_data)

                    # 3. Ghi kết quả vào file
                    if redis_data:
                        f.write(f"REDIS STATUS: Data Found\n")
                        f.write(f"TECHNICAL SUMMARY: {json.dumps(redis_data.get('technical_summary'), indent=2)}\n")
                        f.write(f"SIGNALS: {json.dumps(redis_data.get('summary'), indent=2)}\n")
                    else:
                        f.write(f"REDIS STATUS: No data found for {symbol}. (Ensure Warmup is running)\n")
                
                f.write("-" * 50 + "\n")
            
            print(f"✅ Test complete. Results saved to: {self.output_file}")

if __name__ == "__main__":
    tester = SystemTest()
    asyncio.run(tester.run_test())