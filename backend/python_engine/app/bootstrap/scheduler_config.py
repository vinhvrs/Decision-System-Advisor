import os


def _env_float(name: str, default: float, *, minimum: float) -> float:
    """Parse a positive float from env; empty/invalid falls back to default."""
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        v = float(raw)
        if not (v > 0) or v != v:  # reject NaN, <= 0
            return default
        return max(minimum, v)
    except ValueError:
        return default


def _env_int(name: str, default: int, *, minimum: int = 0, maximum: int | None = None) -> int:
    """Parse an integer from env and clamp it to a safe range."""
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        value = default
    else:
        try:
            value = int(raw)
        except ValueError:
            value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


ENGINE_RESOURCE_PROFILE = (os.environ.get("ENGINE_RESOURCE_PROFILE", "standard") or "standard").strip().lower()
IS_PI4_PROFILE = ENGINE_RESOURCE_PROFILE in {"pi4", "raspberry-pi-4gb", "raspberry_pi_4gb", "low-memory"}

# A Pi 4B/4GB should serialize APScheduler work. This does not change any data
# formula; it only prevents independent scheduled jobs from competing for RAM/CPU.
SCHEDULER_MAX_WORKERS = _env_int(
    "SCHEDULER_MAX_WORKERS",
    1 if IS_PI4_PROFILE else 4,
    minimum=1,
    maximum=16,
)
RANKING_FIRST_DELAY_SEC = _env_int("RANKING_FIRST_DELAY_SEC", 0, minimum=0, maximum=86400)
STOCK_SYNC_FIRST_DELAY_SEC = _env_int("STOCK_SYNC_FIRST_DELAY_SEC", 240, minimum=0, maximum=86400)
NEWS_STARTUP_DELAY_SEC = _env_int(
    "NEWS_STARTUP_DELAY_SEC",
    600 if IS_PI4_PROFILE else 0,
    minimum=0,
    maximum=86400,
)
AUTO_ANALYZE_FIRST_DELAY_SEC = _env_int(
    "AUTO_ANALYZE_FIRST_DELAY_SEC",
    1200 if IS_PI4_PROFILE else 360,
    minimum=0,
    maximum=86400,
)
AUTO_ANALYZE_CONCURRENCY = _env_int(
    "AUTO_ANALYZE_CONCURRENCY",
    2 if IS_PI4_PROFILE else 5,
    minimum=1,
    maximum=16,
)
AUTO_ANALYZE_SCHEDULE_LIMIT = _env_int(
    "AUTO_ANALYZE_SCHEDULE_LIMIT",
    40 if IS_PI4_PROFILE else 50,
    minimum=1,
    maximum=100,
)
_AUTO_STARTUP = os.environ.get(
    "AUTO_ANALYZE_STARTUP_WARMUP_ENABLED",
    "0" if IS_PI4_PROFILE else "1",
).strip().lower()
AUTO_ANALYZE_STARTUP_WARMUP_ENABLED = _AUTO_STARTUP not in ("0", "false", "no", "off")
AUTO_ANALYZE_STARTUP_DELAY_SEC = _env_int(
    "AUTO_ANALYZE_STARTUP_DELAY_SEC",
    900 if IS_PI4_PROFILE else 0,
    minimum=0,
    maximum=86400,
)
AUTO_ANALYZE_STARTUP_LIMIT = _env_int(
    "AUTO_ANALYZE_STARTUP_LIMIT",
    20 if IS_PI4_PROFILE else 100,
    minimum=1,
    maximum=100,
)


# Env-tunable cadence (Docker / systemd should set these).
# Default 1h: stock/candle DB sync + analyze refresh; dashboard Redis uses ``DASHBOARD_WARM_UP_INTERVAL_MINUTES`` (5m).
SCHEDULE_INTERVAL_HOURS = float(os.environ.get("SCHEDULE_INTERVAL_HOURS", "1"))
# Ranking sync (Redis heatmap + change zset; marketcap / liquidity zsets + fear_greed hash paused in stock_compare.py).
RANKING_SYNC_INTERVAL_HOURS = float(
    os.environ.get("RANKING_SYNC_INTERVAL_HOURS", str(SCHEDULE_INTERVAL_HOURS))
)
# Precompute Laravel/Next `dashboard:daily` in Redis (`app.warm_up`).
# Prefer ``DASHBOARD_WARM_UP_INTERVAL_MINUTES`` (default 5 for test-style cadence). Legacy: if only
# ``DASHBOARD_WARM_UP_INTERVAL_HOURS`` is set, it is converted to minutes.
try:
    if os.environ.get("DASHBOARD_WARM_UP_INTERVAL_MINUTES", "").strip() != "":
        _wm = float(os.environ["DASHBOARD_WARM_UP_INTERVAL_MINUTES"])
        DASHBOARD_WARM_UP_INTERVAL_MINUTES = max(1, min(1440, int(round(_wm))))
    elif os.environ.get("DASHBOARD_WARM_UP_INTERVAL_HOURS", "").strip() != "":
        _wh = float(os.environ["DASHBOARD_WARM_UP_INTERVAL_HOURS"])
        DASHBOARD_WARM_UP_INTERVAL_MINUTES = max(
            1, min(1440, int(round(_wh * 60))) if _wh > 0 and _wh == _wh else 5
        )
    else:
        DASHBOARD_WARM_UP_INTERVAL_MINUTES = 5
except ValueError:
    DASHBOARD_WARM_UP_INTERVAL_MINUTES = 5
DASHBOARD_WARM_UP_INTERVAL_HOURS = DASHBOARD_WARM_UP_INTERVAL_MINUTES / 60.0
# First APScheduler ``dashboard_warm_up`` run is ``now + N`` seconds (default 8). Override: ``DASHBOARD_SCHEDULER_FIRST_DELAY_SEC``.
try:
    DASHBOARD_STARTUP_WARMUP_SEC = max(0.0, float(os.environ.get("DASHBOARD_STARTUP_WARMUP_SEC", "3")))
except ValueError:
    DASHBOARD_STARTUP_WARMUP_SEC = 3.0
# Await one warm-up in FastAPI lifespan before accepting traffic (default on). Disable: ``DASHBOARD_BLOCKING_STARTUP_WARMUP=0``.
_bsw = os.environ.get(
    "DASHBOARD_BLOCKING_STARTUP_WARMUP",
    "0" if IS_PI4_PROFILE else "1",
).strip().lower()
DASHBOARD_BLOCKING_STARTUP_WARMUP = _bsw not in ("0", "false", "no", "off")
# Background loop: re-check ``dashboard:daily`` TTL this often; refresh if key missing or TTL below minimum.
try:
    DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC = max(30, int(os.environ.get("DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC", "300")))
except ValueError:
    DASHBOARD_REDIS_WATCHDOG_INTERVAL_SEC = 300
try:
    DASHBOARD_REDIS_MIN_TTL_SEC = max(0, int(os.environ.get("DASHBOARD_REDIS_MIN_TTL_SEC", "7200")))
except ValueError:
    DASHBOARD_REDIS_MIN_TTL_SEC = 7200
_DWD = os.environ.get("DASHBOARD_REDIS_WATCHDOG_ENABLED", "1").strip().lower()
DASHBOARD_REDIS_WATCHDOG_ENABLED = _DWD not in ("0", "false", "no", "off")
try:
    WARM_UP_LIMIT = max(1, min(500, int(os.environ.get("DASHBOARD_WARM_UP_LIMIT", "40"))))
except ValueError:
    WARM_UP_LIMIT = 40
try:
    WARM_UP_CHART_BARS = max(2, min(500, int(os.environ.get("DASHBOARD_WARM_UP_CHART_BARS", "90"))))
except ValueError:
    WARM_UP_CHART_BARS = 90
try:
    _bs = int(os.environ.get("DASHBOARD_WARM_UP_BOOTSTRAP_SEC", "0"))
    DASHBOARD_WARM_UP_BOOTSTRAP_SEC = max(0, _bs)
except ValueError:
    DASHBOARD_WARM_UP_BOOTSTRAP_SEC = 0
# News ingest: default hourly, independent of candle sync interval (min 5 minutes).
NEWS_INTERVAL_HOURS = _env_float("NEWS_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
NEWS_INTERVAL_RAW = os.environ.get("NEWS_INTERVAL_HOURS", "")
# Wider window on each scheduled run so gaps (downtime / missed fires) still backfill GDELT.
NEWS_SCHEDULE_LOOKBACK_DAYS = max(1, int(os.environ.get("NEWS_SCHEDULE_LOOKBACK_DAYS", "7")))
# APScheduler: still run a job if it missed its slot by up to this many seconds (busy CPU / long news run).
SCHEDULER_MISFIRE_GRACE_SEC = int(os.environ.get("SCHEDULER_MISFIRE_GRACE_SEC", str(4 * 3600)))

# Symbol universe for scheduled news + candle sync:
#   all            — every company_profile row (news) and TOP_N snapshot rows (candles)
#   top_snapshot   — top SYMBOL_INGEST_TOP_N by snapshot volume (default 40 to match the production board)
SYMBOL_INGEST_MODE = os.environ.get("SYMBOL_INGEST_MODE", "top_snapshot")
SYMBOL_INGEST_TOP_N = max(1, int(os.environ.get("SYMBOL_INGEST_TOP_N", "40")))

# Embed + Qdrant for knowledge_docs (off by default: crawl-only; set NEWS_EMBED_ENABLED=1 to enable).
_NEWS_EMBED_FLAG = os.environ.get("NEWS_EMBED_ENABLED", "0").strip().lower()
NEWS_EMBED_ENABLED = _NEWS_EMBED_FLAG not in ("0", "false", "no", "off")
NEWS_EMBED_INTERVAL_HOURS = _env_float("NEWS_EMBED_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
try:
    NEWS_EMBED_BATCH_LIMIT = max(1, int(os.environ.get("NEWS_EMBED_BATCH_LIMIT", "50")))
except ValueError:
    NEWS_EMBED_BATCH_LIMIT = 50

# SEC EDGAR + optional MacroTrends gap-fill for the 10-symbol tech universe.
FUNDAMENTAL_INTERVAL_HOURS = _env_float("FUNDAMENTAL_INTERVAL_HOURS", 24.0, minimum=1.0)
_fund_flag = os.environ.get("FUNDAMENTAL_INGEST_ENABLED", "1").strip().lower()
FUNDAMENTAL_INGEST_ENABLED = _fund_flag not in ("0", "false", "no", "off")
_mt_flag = os.environ.get("MACROTRENDS_ENABLED", "1").strip().lower()
MACROTRENDS_ENABLED = _mt_flag not in ("0", "false", "no", "off")
_fb = os.environ.get("FUNDAMENTAL_BOOTSTRAP_ON_START", "1").strip().lower()
FUNDAMENTAL_BOOTSTRAP_ON_START = _fb not in ("0", "false", "no", "off")
try:
    FUNDAMENTAL_BOOTSTRAP_DELAY_SEC = max(30, int(os.environ.get("FUNDAMENTAL_BOOTSTRAP_DELAY_SEC", "120")))
except ValueError:
    FUNDAMENTAL_BOOTSTRAP_DELAY_SEC = 120

# snapshot_demo + snapshot_daily + company_facts_raw (10 US tech symbols).
TECH_UNIVERSE_DAILY_INTERVAL_HOURS = _env_float("TECH_UNIVERSE_DAILY_INTERVAL_HOURS", 24.0, minimum=1.0)
_tu_flag = os.environ.get("TECH_UNIVERSE_DAILY_ENABLED", "1").strip().lower()
TECH_UNIVERSE_DAILY_ENABLED = _tu_flag not in ("0", "false", "no", "off")
try:
    _tech_default = "1800" if IS_PI4_PROFILE else "180"
    TECH_UNIVERSE_BOOTSTRAP_DELAY_SEC = max(
        60,
        int(os.environ.get("TECH_UNIVERSE_BOOTSTRAP_DELAY_SEC", _tech_default)),
    )
except ValueError:
    TECH_UNIVERSE_BOOTSTRAP_DELAY_SEC = 1800 if IS_PI4_PROFILE else 180

