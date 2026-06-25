"""
Load indicator tunables from MySQL (indicator_parameters) with env fallback.

Shares the same rows as Admin → Indicator params and GET /api/indicator-config.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import pymysql

from config.settings import settings

_SLUG_PARAM_TO_CONFIG: dict[str, str] = {
    "global.default_period": "default_period",
    "sma.period": "sma_period",
    "ema.period": "ema_period",
    "rsi.period": "rsi_period",
    "macd.fast_period": "macd_fast_period",
    "macd.slow_period": "macd_slow_period",
    "macd.signal_period": "macd_signal_period",
    "stochastic.k_period": "stochastic_k_period",
    "stochastic.d_period": "stochastic_d_period",
    "stochastic.smooth_k": "stochastic_smooth_k",
    "bollinger.period": "bollinger_period",
    "bollinger.std_dev_multiplier": "bollinger_std_dev_multiplier",
    "ema_trend.fast_period": "ema_fast_period",
    "ema_trend.slow_period": "ema_slow_period",
}

_CACHE: Optional["IndicatorRuntime"] = None
_CACHE_AT: float = 0.0
_CACHE_TTL_SEC = 60.0


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        n = int(raw)
        return n if n > 0 else default
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    raw = os.environ.get(key)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        n = float(raw)
        return n if n > 0 else default
    except ValueError:
        return default


@dataclass(frozen=True)
class IndicatorRuntime:
    default_period: str = "daily"
    sma_period: int = 14
    ema_period: int = 14
    ema_fast_period: int = 20
    ema_slow_period: int = 100
    rsi_period: int = 14
    macd_fast_period: int = 12
    macd_slow_period: int = 26
    macd_signal_period: int = 9
    stochastic_k_period: int = 14
    stochastic_d_period: int = 3
    stochastic_smooth_k: int = 3
    bollinger_period: int = 20
    bollinger_std_dev_multiplier: float = 2.0
    source: str = "env"

    @classmethod
    def from_env(cls) -> "IndicatorRuntime":
        return cls(
            default_period=os.environ.get("INDICATOR_DEFAULT_PERIOD", "daily").strip() or "daily",
            sma_period=_env_int("INDICATOR_SMA_PERIOD", 14),
            ema_period=_env_int("INDICATOR_EMA_PERIOD", 14),
            ema_fast_period=_env_int("INDICATOR_EMA_FAST_PERIOD", 20),
            ema_slow_period=_env_int("INDICATOR_EMA_SLOW_PERIOD", 100),
            rsi_period=_env_int("INDICATOR_RSI_PERIOD", 14),
            macd_fast_period=_env_int("INDICATOR_MACD_FAST_PERIOD", 12),
            macd_slow_period=_env_int("INDICATOR_MACD_SLOW_PERIOD", 26),
            macd_signal_period=_env_int("INDICATOR_MACD_SIGNAL_PERIOD", 9),
            stochastic_k_period=_env_int("INDICATOR_STOCHASTIC_K_PERIOD", 14),
            stochastic_d_period=_env_int("INDICATOR_STOCHASTIC_D_PERIOD", 3),
            stochastic_smooth_k=_env_int("INDICATOR_STOCHASTIC_SMOOTH_K", 3),
            bollinger_period=_env_int("INDICATOR_BOLLINGER_PERIOD", 20),
            bollinger_std_dev_multiplier=_env_float("INDICATOR_BOLLINGER_STD_DEV_MULTIPLIER", 2.0),
            source="env",
        )


def _cast_value(raw: Any, value_type: str) -> Any:
    if raw is None or raw == "":
        return None
    text = str(raw).strip()
    if value_type == "number":
        return float(text) if "." in text else int(text)
    if value_type == "boolean":
        return text.lower() in ("1", "true", "yes", "on")
    return text


def _load_from_database() -> tuple[Dict[str, Any], int]:
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    conn = pymysql.connect(
        **cfg,
        connect_timeout=5,
        read_timeout=10,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.slug, ip.param_key, ip.param_value, ip.value_type
                FROM indicator_parameters ip
                INNER JOIN indicators i ON i.id = ip.indicator_id
                WHERE ip.is_active = 1
                ORDER BY ip.sort_order, ip.param_key
                """
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()

    resolved: Dict[str, Any] = {}
    hits = 0
    for row in rows:
        slug = str(row.get("slug") or "")
        param_key = str(row.get("param_key") or "")
        composite = f"{slug}.{param_key}"
        config_key = _SLUG_PARAM_TO_CONFIG.get(composite)
        if not config_key:
            continue
        value = _cast_value(row.get("param_value"), str(row.get("value_type") or "string"))
        if value is not None:
            resolved[config_key] = value
            hits += 1
    return resolved, hits


def get_indicator_runtime(*, force_reload: bool = False) -> IndicatorRuntime:
    global _CACHE, _CACHE_AT
    now = time.monotonic()
    if not force_reload and _CACHE is not None and (now - _CACHE_AT) < _CACHE_TTL_SEC:
        return _CACHE

    base = IndicatorRuntime.from_env()
    data = {f.name: getattr(base, f.name) for f in base.__dataclass_fields__.values() if f.name != "source"}

    try:
        db_values, hits = _load_from_database()
        data.update(db_values)
        source = "database" if hits > 0 else "env"
    except Exception:
        source = "env"

    runtime = IndicatorRuntime(source=source, **data)
    _CACHE = runtime
    _CACHE_AT = now
    return runtime


def flush_indicator_runtime_cache() -> None:
    global _CACHE, _CACHE_AT
    _CACHE = None
    _CACHE_AT = 0.0
