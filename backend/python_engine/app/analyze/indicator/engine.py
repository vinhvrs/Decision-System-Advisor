import time
from typing import Dict, Any, Optional

import pandas as pd
import pandas_ta

from app.config.indicator_runtime import IndicatorRuntime, get_indicator_runtime

class IndicatorService:
    """
    Pure indicator calculator.
    Input DataFrame columns: open, high, low, close, volume; optional timestamps.

    Steps:
        1. Normalize input
        2. Compute technical indicators
        3. Build legacy-shaped output
        4. Rule-based confidence score
    """

    MIN_REQUIRED_CANDLES = 100

    def __init__(self, runtime: Optional[IndicatorRuntime] = None):
        self._runtime = runtime

    def _params(self) -> IndicatorRuntime:
        return self._runtime or get_indicator_runtime()

    @staticmethod
    def _safe_float(value, default: float = 0.0) -> float:
        try:
            if pd.isna(value):
                return default
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _cross_up(prev_fast, prev_slow, curr_fast, curr_slow) -> bool:
        return (prev_fast <= prev_slow) and (curr_fast > curr_slow)

    @staticmethod
    def _cross_down(prev_fast, prev_slow, curr_fast, curr_slow) -> bool:
        return (prev_fast >= prev_slow) and (curr_fast < curr_slow)

    def prepare_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize OHLCV frame: lowercase columns, coerce numeric,
        sort by timestamps ascending, drop rows with null close.
        """
        if df is None or df.empty:
            return pd.DataFrame()

        df = df.copy()
        df.columns = [str(c).strip().lower() for c in df.columns]

        numeric_cols = ["open", "high", "low", "close", "volume"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        if "timestamps" in df.columns:
            df["timestamps"] = pd.to_datetime(df["timestamps"], errors="coerce")
            df = df.sort_values("timestamps", ascending=True).reset_index(drop=True)
        else:
            df = df.reset_index(drop=True)

        df = df.dropna(subset=["close"]).reset_index(drop=True)
        return df

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute RSI/MACD/stoch/EMA/Bollinger columns via pandas_ta."""
        p = self._params()
        df = self.prepare_dataframe(df)
        if df.empty:
            return df

        if len(df) < self.MIN_REQUIRED_CANDLES:
            return pd.DataFrame()

        df = df.copy()

        # Momentum
        df.ta.rsi(length=p.rsi_period, append=True)
        df.ta.macd(
            fast=p.macd_fast_period,
            slow=p.macd_slow_period,
            signal=p.macd_signal_period,
            append=True,
        )
        df.ta.stoch(
            k=p.stochastic_k_period,
            d=p.stochastic_d_period,
            smooth_k=p.stochastic_smooth_k,
            append=True,
        )

        # Trend
        df.ta.ema(length=p.ema_fast_period, append=True)
        df.ta.ema(length=p.ema_slow_period, append=True)

        # Volatility
        df.ta.bbands(length=p.bollinger_period, std=p.bollinger_std_dev_multiplier, append=True)

        return df

    def _resolve_states(self, prev_row: pd.Series, last_row: pd.Series, df: pd.DataFrame) -> Dict[str, Any]:
        """Derive crossover and zone states from the last two rows."""
        p = self._params()
        ema_fast_col = f"EMA_{p.ema_fast_period}"
        ema_slow_col = f"EMA_{p.ema_slow_period}"
        rsi_col = f"RSI_{p.rsi_period}"
        macd_col = f"MACD_{p.macd_fast_period}_{p.macd_slow_period}_{p.macd_signal_period}"
        macd_sig_col = f"MACDs_{p.macd_fast_period}_{p.macd_slow_period}_{p.macd_signal_period}"
        macd_hist_col = f"MACDh_{p.macd_fast_period}_{p.macd_slow_period}_{p.macd_signal_period}"
        stoch_k_col = f"STOCHk_{p.stochastic_k_period}_{p.stochastic_d_period}_{p.stochastic_smooth_k}"
        stoch_d_col = f"STOCHd_{p.stochastic_k_period}_{p.stochastic_d_period}_{p.stochastic_smooth_k}"

        e20_p = self._safe_float(prev_row.get(ema_fast_col))
        e100_p = self._safe_float(prev_row.get(ema_slow_col))
        e20_c = self._safe_float(last_row.get(ema_fast_col))
        e100_c = self._safe_float(last_row.get(ema_slow_col))

        ema_signal = "neutral"
        if self._cross_up(e20_p, e100_p, e20_c, e100_c):
            ema_signal = "golden_cross"
        elif self._cross_down(e20_p, e100_p, e20_c, e100_c):
            ema_signal = "death_cross"

        if e20_c > e100_c:
            trend_20_100 = "bullish"
        elif e20_c < e100_c:
            trend_20_100 = "bearish"
        else:
            trend_20_100 = "neutral"

        rsi_val = self._safe_float(last_row.get(rsi_col))
        if rsi_val >= 70:
            rsi_state = "overbought"
        elif rsi_val <= 30:
            rsi_state = "oversold"
        else:
            rsi_state = "neutral"

        macd_val = self._safe_float(last_row.get(macd_col))
        macd_sig = self._safe_float(last_row.get(macd_sig_col))
        macd_hist = self._safe_float(last_row.get(macd_hist_col))

        stoch_k = self._safe_float(last_row.get(stoch_k_col))
        stoch_d = self._safe_float(last_row.get(stoch_d_col))

        bb_lower_col = next((c for c in df.columns if c.startswith(f"BBL_{p.bollinger_period}")), None)
        bb_middle_col = next((c for c in df.columns if c.startswith(f"BBM_{p.bollinger_period}")), None)
        bb_upper_col = next((c for c in df.columns if c.startswith(f"BBU_{p.bollinger_period}")), None)

        bb_lower = self._safe_float(last_row.get(bb_lower_col)) if bb_lower_col else 0.0
        bb_middle = self._safe_float(last_row.get(bb_middle_col)) if bb_middle_col else 0.0
        bb_upper = self._safe_float(last_row.get(bb_upper_col)) if bb_upper_col else 0.0

        close_curr = self._safe_float(last_row.get("close"))

        if close_curr > bb_upper:
            bollinger_state = "above_upper"
        elif close_curr < bb_lower:
            bollinger_state = "below_lower"
        else:
            bollinger_state = "inside_band"

        if stoch_k >= 80 and stoch_d >= 80:
            stochastic_state = "overbought"
        elif stoch_k <= 20 and stoch_d <= 20:
            stochastic_state = "oversold"
        else:
            stochastic_state = "neutral"

        if macd_val > macd_sig and macd_hist > 0:
            macd_state = "bullish"
        elif macd_val < macd_sig and macd_hist < 0:
            macd_state = "bearish"
        else:
            macd_state = "neutral"

        return {
            "ema_20": e20_c,
            "ema_100": e100_c,
            "ema_signal": ema_signal,
            "trend_20_100": trend_20_100,
            "rsi": rsi_val,
            "rsi_state": rsi_state,
            "macd": macd_val,
            "macd_signal": macd_sig,
            "macd_histogram": macd_hist,
            "macd_state": macd_state,
            "stoch_k": stoch_k,
            "stoch_d": stoch_d,
            "stochastic_state": stochastic_state,
            "bb_lower": bb_lower,
            "bb_middle": bb_middle,
            "bb_upper": bb_upper,
            "bollinger_state": bollinger_state,
            "close": close_curr,
        }

    def calculate_confidence(self, states: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule-based confidence (weights tunable without changing output shape).

        Returns:
            {"score": float, "label": str, "signals": dict}
        """
        score = 50.0
        signals = {}

        # 1. Trend EMA 20/100
        trend = states["trend_20_100"]
        ema_signal = states["ema_signal"]
        if trend == "bullish":
            score += 10
            signals["ema_trend"] = "bullish"
        elif trend == "bearish":
            score -= 10
            signals["ema_trend"] = "bearish"
        else:
            signals["ema_trend"] = "neutral"

        if ema_signal == "golden_cross":
            score += 15
            signals["ema_crossover"] = "strong_bullish"
        elif ema_signal == "death_cross":
            score -= 15
            signals["ema_crossover"] = "strong_bearish"
        else:
            signals["ema_crossover"] = "neutral"

        # 2. RSI
        rsi = states["rsi"]
        rsi_state = states["rsi_state"]
        if 45 <= rsi <= 60:
            score += 8
            signals["rsi_signal"] = "healthy_bullish_zone"
        elif 60 < rsi < 70:
            score += 4
            signals["rsi_signal"] = "bullish_but_warm"
        elif 30 < rsi < 45:
            score -= 4
            signals["rsi_signal"] = "weak_zone"
        elif rsi_state == "oversold":
            score += 6
            signals["rsi_signal"] = "oversold_rebound_potential"
        elif rsi_state == "overbought":
            score -= 8
            signals["rsi_signal"] = "overbought_risk"
        else:
            signals["rsi_signal"] = "neutral"

        # 3. MACD
        macd_state = states["macd_state"]
        if macd_state == "bullish":
            score += 10
            signals["macd_signal"] = "bullish"
        elif macd_state == "bearish":
            score -= 10
            signals["macd_signal"] = "bearish"
        else:
            signals["macd_signal"] = "neutral"

        # 4. Stochastic
        stochastic_state = states["stochastic_state"]
        if stochastic_state == "oversold":
            score += 5
            signals["stochastic_signal"] = "oversold_rebound_potential"
        elif stochastic_state == "overbought":
            score -= 5
            signals["stochastic_signal"] = "overbought_risk"
        else:
            signals["stochastic_signal"] = "neutral"

        # 5. Bollinger
        bollinger_state = states["bollinger_state"]
        if bollinger_state == "below_lower":
            score += 4
            signals["bollinger_signal"] = "mean_reversion_upside"
        elif bollinger_state == "above_upper":
            score -= 4
            signals["bollinger_signal"] = "mean_reversion_downside"
        else:
            signals["bollinger_signal"] = "neutral"

        # Clamp
        score = max(0.0, min(100.0, score))

        if score >= 75:
            label = "high"
        elif score >= 55:
            label = "medium"
        else:
            label = "low"

        return {
            "score": round(score, 2),
            "label": label,
            "signals": signals,
        }

    def build_analysis_payload(self, symbol: str, df: pd.DataFrame) -> Optional[Dict[str, Any]]:
        """End-to-end: raw OHLCV -> indicators -> API payload."""
        symbol = (symbol or "").strip().upper()
        calculated_df = self.calculate_indicators(df)

        if calculated_df.empty or len(calculated_df) < 2:
            return None

        prev = calculated_df.iloc[-2]
        last = calculated_df.iloc[-1]

        states = self._resolve_states(prev_row=prev, last_row=last, df=calculated_df)
        confidence = self.calculate_confidence(states)

        result = {
            "symbol": symbol,
            "price": round(states["close"], 2),
            "indicators": {
                "rsi": round(states["rsi"], 2),
                "macd": {
                    "macd": round(states["macd"], 6),
                    "signal": round(states["macd_signal"], 6),
                    "histogram": round(states["macd_histogram"], 6),
                },
                "ema_20_100": {
                    "ema_20": round(states["ema_20"], 2),
                    "ema_100": round(states["ema_100"], 2),
                    "signal": states["ema_signal"],
                },
                "stochastic": {
                    "k": round(states["stoch_k"], 2),
                    "d": round(states["stoch_d"], 2),
                },
                "bollinger_bands": {
                    "lower": round(states["bb_lower"], 2),
                    "middle": round(states["bb_middle"], 2),
                    "upper": round(states["bb_upper"], 2),
                },
                "summary": {
                    "rsi_state": states["rsi_state"],
                    "trend_20_100": states["trend_20_100"],
                    "macd_state": states["macd_state"],
                    "stochastic_state": states["stochastic_state"],
                    "bollinger_state": states["bollinger_state"],
                },
            },
            "confidence": confidence,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        return result
