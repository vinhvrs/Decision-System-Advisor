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

    def get_top_volume_symbols(self, limit=5):
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

            symbols = []
            for r in rows:
                if isinstance(r, dict):
                    symbols.append(str(r["symbol"]).strip().upper())
                else:
                    symbols.append(str(r[0]).strip().upper())

            return symbols

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

            symbol = (symbol or "").strip().upper()
            period = (period or "").strip().lower()
            print(f"DEBUG candles: symbol={symbol}, period={period}")

            with conn.cursor() as cur:
                cur.execute(query, (symbol, period))
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]

            conn.close()

            df = pd.DataFrame(rows, columns=cols)
            if df.empty:
                return pd.DataFrame()

            df.columns = [c.lower() for c in df.columns]

            numeric_cols = ["open", "high", "low", "close", "volume"]
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")

            # Nếu timestamps parse được thì sort theo thời gian thật
            if "timestamps" in df.columns:
                parsed_ts = pd.to_datetime(df["timestamps"], errors="coerce")
                if parsed_ts.notna().sum() > 0:
                    df["timestamps"] = parsed_ts
                    df = df.sort_values("timestamps", ascending=True).reset_index(drop=True)
                else:
                    # fallback: hiện query đã DESC nên đảo lại để cũ -> mới
                    df = df.iloc[::-1].reset_index(drop=True)
            else:
                df = df.iloc[::-1].reset_index(drop=True)

            df.dropna(subset=["close"], inplace=True)
            df.reset_index(drop=True, inplace=True)

            return df

        except Exception as e:
            print(f"❌ Lỗi truy xuất nến cho {symbol}: {e}")
            return pd.DataFrame()

    @staticmethod
    def _cross_up(prev_fast, prev_slow, curr_fast, curr_slow) -> bool:
        return (prev_fast <= prev_slow) and (curr_fast > curr_slow)

    @staticmethod
    def _cross_down(prev_fast, prev_slow, curr_fast, curr_slow) -> bool:
        return (prev_fast >= prev_slow) and (curr_fast < curr_slow)

    @staticmethod
    def _safe_float(value, default=0.0):
        try:
            if pd.isna(value):
                return default
            return float(value)
        except Exception:
            return default

    def process_and_cache(self, symbol: str):
        symbol = (symbol or "").strip().upper()
        df = self.get_candles_from_db(symbol, period="daily")

        # Cần đủ dữ liệu cho SMA50 / BB20 / MACD26
        if df.empty or len(df) < 60:
            print(f"⚠️ {symbol}: Không đủ dữ liệu ({len(df)} nến)")
            return

        try:
            # Core indicators
            df.ta.sma(length=14, append=True)
            df.ta.ema(length=14, append=True)
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2.0, append=True)
            df.ta.stoch(k=14, d=3, smooth_k=3, append=True)

            # For crossover checks
            df.ta.sma(length=20, append=True)
            df.ta.sma(length=50, append=True)
            df.ta.ema(length=12, append=True)
            df.ta.ema(length=26, append=True)

            # Chỉ cần fill NaN nhẹ ở bước lấy giá trị, không fill toàn bộ bừa bãi
            if len(df) < 2:
                print(f"⚠️ {symbol}: Không đủ 2 dòng để kiểm tra crossover")
                return

            prev = df.iloc[-2]
            last = df.iloc[-1]

            close_prev = self._safe_float(prev.get("close"))
            close_curr = self._safe_float(last.get("close"))

            # --- SMA / EMA current values ---
            sma14 = self._safe_float(last.get("SMA_14"))
            ema14 = self._safe_float(last.get("EMA_14"))
            rsi14 = self._safe_float(last.get("RSI_14"))

            sma20_prev = self._safe_float(prev.get("SMA_20"))
            sma20_curr = self._safe_float(last.get("SMA_20"))
            sma50_prev = self._safe_float(prev.get("SMA_50"))
            sma50_curr = self._safe_float(last.get("SMA_50"))

            ema12_prev = self._safe_float(prev.get("EMA_12"))
            ema12_curr = self._safe_float(last.get("EMA_12"))
            ema26_prev = self._safe_float(prev.get("EMA_26"))
            ema26_curr = self._safe_float(last.get("EMA_26"))

            # --- MACD ---
            macd_val = self._safe_float(last.get("MACD_12_26_9"))
            macd_signal = self._safe_float(last.get("MACDs_12_26_9"))
            macd_hist = self._safe_float(last.get("MACDh_12_26_9"))

            # --- Bollinger Bands ---
            bb_lower_col = next((c for c in df.columns if c.startswith("BBL_")), None)
            bb_middle_col = next((c for c in df.columns if c.startswith("BBM_")), None)
            bb_upper_col = next((c for c in df.columns if c.startswith("BBU_")), None)

            bbl_prev = self._safe_float(prev.get(bb_lower_col)) if bb_lower_col else 0.0
            bbm_prev = self._safe_float(prev.get(bb_middle_col)) if bb_middle_col else 0.0
            bbu_prev = self._safe_float(prev.get(bb_upper_col)) if bb_upper_col else 0.0

            bbl_curr = self._safe_float(last.get(bb_lower_col)) if bb_lower_col else 0.0
            bbm_curr = self._safe_float(last.get(bb_middle_col)) if bb_middle_col else 0.0
            bbu_curr = self._safe_float(last.get(bb_upper_col)) if bb_upper_col else 0.0

            # --- Stochastic ---
            stoch_k = self._safe_float(last.get("STOCHk_14_3_3"))
            stoch_d = self._safe_float(last.get("STOCHd_14_3_3"))

            # --- MA crossover signals ---
            ma_signals = {
                "sma_20_50": {
                    "fast": round(sma20_curr, 2),
                    "slow": round(sma50_curr, 2),
                    "golden_cross": False,
                    "death_cross": False,
                    "trend": "unknown",
                },
                "ema_12_26": {
                    "fast": round(ema12_curr, 2),
                    "slow": round(ema26_curr, 2),
                    "bull_cross": False,
                    "bear_cross": False,
                    "trend": "unknown",
                },
            }

            if sma20_curr > 0 and sma50_curr > 0 and sma20_prev > 0 and sma50_prev > 0:
                ma_signals["sma_20_50"]["golden_cross"] = self._cross_up(
                    sma20_prev, sma50_prev, sma20_curr, sma50_curr
                )
                ma_signals["sma_20_50"]["death_cross"] = self._cross_down(
                    sma20_prev, sma50_prev, sma20_curr, sma50_curr
                )
                ma_signals["sma_20_50"]["trend"] = "bullish" if sma20_curr > sma50_curr else "bearish"

            if ema12_curr > 0 and ema26_curr > 0 and ema12_prev > 0 and ema26_prev > 0:
                ma_signals["ema_12_26"]["bull_cross"] = self._cross_up(
                    ema12_prev, ema26_prev, ema12_curr, ema26_curr
                )
                ma_signals["ema_12_26"]["bear_cross"] = self._cross_down(
                    ema12_prev, ema26_prev, ema12_curr, ema26_curr
                )
                ma_signals["ema_12_26"]["trend"] = "bullish" if ema12_curr > ema26_curr else "bearish"

            # --- Bollinger signals ---
            bb_width = (bbu_curr - bbl_curr) if (bbu_curr > 0 and bbl_curr > 0) else 0.0
            bandwidth_pct = (bb_width / bbm_curr * 100.0) if bbm_curr > 0 else 0.0

            bollinger_signals = {
                "break_above_upper": (bbu_curr > 0) and (close_curr > bbu_curr),
                "break_below_lower": (bbl_curr > 0) and (close_curr < bbl_curr),
                "reentry_from_above": (bbu_prev > 0 and bbu_curr > 0) and (close_prev > bbu_prev) and (close_curr <= bbu_curr),
                "reentry_from_below": (bbl_prev > 0 and bbl_curr > 0) and (close_prev < bbl_prev) and (close_curr >= bbl_curr),
                "bandwidth_pct": round(bandwidth_pct, 2),
                "squeeze": (bandwidth_pct > 0) and (bandwidth_pct < 5.0),
                "position": (
                    "above_upper" if (bbu_curr > 0 and close_curr > bbu_curr)
                    else "below_lower" if (bbl_curr > 0 and close_curr < bbl_curr)
                    else "above_middle" if (bbm_curr > 0 and close_curr >= bbm_curr)
                    else "below_middle"
                ),
            }

            # Optional summary signals
            summary = {
                "price_vs_sma14": "above" if (sma14 > 0 and close_curr > sma14) else "below",
                "price_vs_ema14": "above" if (ema14 > 0 and close_curr > ema14) else "below",
                "rsi_state": (
                    "overbought" if rsi14 >= 70
                    else "oversold" if rsi14 <= 30
                    else "neutral"
                ),
                "macd_state": (
                    "bullish" if macd_val > macd_signal
                    else "bearish" if macd_val < macd_signal
                    else "neutral"
                ),
            }

            result = {
                "symbol": symbol,
                "price": round(close_curr, 2),
                "indicators": {
                    "sma": round(sma14, 2),
                    "ema": round(ema14, 2),
                    "sma_20": round(sma20_curr, 2),
                    "sma_50": round(sma50_curr, 2),
                    "ema_12": round(ema12_curr, 2),
                    "ema_26": round(ema26_curr, 2),
                    "rsi": round(rsi14, 2),
                    "macd": {
                        "macd": round(macd_val, 6),
                        "signal": round(macd_signal, 6),
                        "histogram": round(macd_hist, 6),
                    },
                    "bollinger_bands": {
                        "lower": round(bbl_curr, 2),
                        "middle": round(bbm_curr, 2),
                        "upper": round(bbu_curr, 2),
                    },
                    "stochastic": {
                        "k": round(stoch_k, 2),
                        "d": round(stoch_d, 2),
                    },
                    "ma_signals": ma_signals,
                    "bollinger_signals": bollinger_signals,
                    "summary": summary,
                },
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

            redis_key = f"{Config.REDIS_PREFIX}:analysis:{symbol}"
            if self.redis_client:
                self.redis_client.set(redis_key, json.dumps(result), ex=300)

        except Exception as e:
            print(f"❌ Lỗi tính toán {symbol}: {e}")

    def run_warmup(self):
        print(f"🚀 Warmup started at {time.strftime('%H:%M:%S')}")
        symbols = self.get_top_volume_symbols(5)

        if not symbols:
            print("❌ Không tìm thấy mã nào để phân tích.")
            return

        for s in symbols:
            self.process_and_cache(s)

        print("🏁 Warmup finished.")


if __name__ == "__main__":
    service = IndicatorService()
    service.run_warmup()