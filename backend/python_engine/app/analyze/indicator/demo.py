import pandas as pd
import pandas_ta as ta
import pymysql
import redis
import json
import time
from config.settings import Config

class IndicatorService:
    def __init__(self):
        try:
            self.redis_client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
                socket_timeout=5,
            )
            self.redis_client.ping()
            print("✅ Redis Connected")
        except Exception as e:
            print(f"❌ Redis Connection Failed: {e}")
            self.redis_client = None

    def get_top_volume_symbols(self, limit=20): # Tăng limit để lấy được cả BTC/ETH
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            query = """
                SELECT i.symbol
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.volume DESC
                LIMIT %s
            """
            with conn.cursor() as cur:
                cur.execute(query, (int(limit),))
                rows = cur.fetchall()
            conn.close()
            return [str(r["symbol"] if isinstance(r, dict) else r[0]).strip().upper() for r in rows]
        except Exception as e:
            print(f"❌ Lỗi lấy Top Symbols: {e}")
            return []

    def get_candles_from_db(self, symbol: str, period: str = "daily") -> pd.DataFrame:
        try:
            conn = pymysql.connect(**Config.DB_CONFIG)
            query = """
                SELECT d.open, d.high, d.low, d.close, d.volume, d.timestamps
                FROM instrument_data d
                JOIN instrument_periods p ON d.instrument_period_id = p.id
                JOIN instruments i ON p.instrument_id = i.id
                WHERE i.symbol = %s AND p.period = %s
                ORDER BY d.timestamps DESC
                LIMIT 300
            """
            with conn.cursor() as cur:
                cur.execute(query, (symbol.upper(), period.lower()))
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
            conn.close()

            df = pd.DataFrame(rows, columns=cols)
            if df.empty: return pd.DataFrame()
            
            df.columns = [c.lower() for c in df.columns]
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            
            df = df.iloc[::-1].reset_index(drop=True) # Đảo nến về cũ -> mới
            return df.dropna(subset=["close"])
        except Exception as e:
            print(f"❌ Lỗi truy xuất nến {symbol}: {e}")
            return pd.DataFrame()

    @staticmethod
    def _safe_float(value, default=0.0):
        try:
            return float(value) if not pd.isna(value) else default
        except: return default

    def process_and_cache(self, symbol: str):
        df = self.get_candles_from_db(symbol)
        if df.empty or len(df) < 50: return

        try:
            # Tính toán kỹ thuật
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2.0, append=True)
            df.ta.sma(length=20, append=True)
            df.ta.sma(length=50, append=True)

            last = df.iloc[-1]
            rsi = self._safe_float(last.get("RSI_14"))
            macd_val = self._safe_float(last.get("MACD_12_26_9"))
            macd_sig = self._safe_float(last.get("MACDs_12_26_9"))
            sma20 = self._safe_float(last.get("SMA_20"))
            sma50 = self._safe_float(last.get("SMA_50"))

            # Logic tạo Khuyến nghị (Decision Logic)
            recommendation = "NEUTRAL"
            reason = "No strong signal"
            
            if rsi < 30 and macd_val > macd_sig:
                recommendation = "BUY"
                reason = "Oversold with bullish MACD"
            elif rsi > 70 and macd_val < macd_sig:
                recommendation = "SELL"
                reason = "Overbought with bearish MACD"
            elif sma20 > sma50:
                recommendation = "STRONG BUY" if rsi < 50 else "BUY"
                reason = "Golden trend (SMA20 > SMA50)"

            # CẤU TRÚC JSON PHẢI KHỚP VỚI TEST_ANALYSIS.PY
            result = {
                "symbol": symbol,
                "price": round(self._safe_float(last.get("close")), 2),
                "technical_summary": { # Khớp với test_analysis.py
                    "rsi": round(rsi, 2),
                    "macd": {
                        "val": round(macd_val, 4),
                        "signal": round(macd_sig, 4)
                    },
                    "ma_trend": "bullish" if sma20 > sma50 else "bearish"
                },
                "summary": { # Khớp với test_analysis.py
                    "action": recommendation,
                    "reason": reason,
                    "confidence_score": 85 if recommendation != "NEUTRAL" else 50
                },
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }

            redis_key = f"{Config.REDIS_PREFIX}:analysis:{symbol}"
            if self.redis_client:
                self.redis_client.set(redis_key, json.dumps(result), ex=3600)
                print(f"✅ Updated {symbol} in Redis.")

        except Exception as e:
            print(f"❌ Lỗi xử lý {symbol}: {e}")

    def run_warmup(self):
        print(f"🚀 Warmup started...")
        symbols = self.get_top_volume_symbols(30)
        for s in symbols:
            self.process_and_cache(s)
        print("🏁 Warmup finished.")

if __name__ == "__main__":
    service = IndicatorService()
    service.run_warmup()