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


# Env-tunable cadence (Docker / systemd should set these; defaults suit dev).
SCHEDULE_INTERVAL_HOURS = float(os.environ.get("SCHEDULE_INTERVAL_HOURS", "3"))
# Ranking sync (Redis heatmap + change zset; marketcap / liquidity zsets + fear_greed hash paused in stock_compare.py).
RANKING_SYNC_INTERVAL_HOURS = float(
    os.environ.get("RANKING_SYNC_INTERVAL_HOURS", str(SCHEDULE_INTERVAL_HOURS))
)
# Precompute Laravel/Next `dashboard:daily` in Redis (`app.warm_up`).
DASHBOARD_WARM_UP_INTERVAL_HOURS = float(
    os.environ.get("DASHBOARD_WARM_UP_INTERVAL_HOURS", str(RANKING_SYNC_INTERVAL_HOURS))
)
try:
    WARM_UP_LIMIT = max(1, min(500, int(os.environ.get("DASHBOARD_WARM_UP_LIMIT", "100"))))
except ValueError:
    WARM_UP_LIMIT = 100
try:
    WARM_UP_CHART_BARS = max(2, min(500, int(os.environ.get("DASHBOARD_WARM_UP_CHART_BARS", "90"))))
except ValueError:
    WARM_UP_CHART_BARS = 90
# News ingest: default hourly, independent of candle sync interval (min 5 minutes).
NEWS_INTERVAL_HOURS = _env_float("NEWS_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
NEWS_INTERVAL_RAW = os.environ.get("NEWS_INTERVAL_HOURS", "")
# Wider window on each scheduled run so gaps (downtime / missed fires) still backfill GDELT.
NEWS_SCHEDULE_LOOKBACK_DAYS = max(1, int(os.environ.get("NEWS_SCHEDULE_LOOKBACK_DAYS", "7")))
# APScheduler: still run a job if it missed its slot by up to this many seconds (busy CPU / long news run).
SCHEDULER_MISFIRE_GRACE_SEC = int(os.environ.get("SCHEDULER_MISFIRE_GRACE_SEC", str(4 * 3600)))

# Symbol universe for scheduled news + candle sync:
#   all            — every company_profile row (news) and TOP_N snapshot rows (candles)
#   top_snapshot   — top SYMBOL_INGEST_TOP_N by snapshot volume (thesis demo default)
SYMBOL_INGEST_MODE = os.environ.get("SYMBOL_INGEST_MODE", "top_snapshot")
SYMBOL_INGEST_TOP_N = max(1, int(os.environ.get("SYMBOL_INGEST_TOP_N", "20")))

# Embed + Qdrant for knowledge_docs (off by default: crawl-only; set NEWS_EMBED_ENABLED=1 to enable).
_NEWS_EMBED_FLAG = os.environ.get("NEWS_EMBED_ENABLED", "0").strip().lower()
NEWS_EMBED_ENABLED = _NEWS_EMBED_FLAG not in ("0", "false", "no", "off")
NEWS_EMBED_INTERVAL_HOURS = _env_float("NEWS_EMBED_INTERVAL_HOURS", 1.0, minimum=5.0 / 60.0)
try:
    NEWS_EMBED_BATCH_LIMIT = max(1, int(os.environ.get("NEWS_EMBED_BATCH_LIMIT", "50")))
except ValueError:
    NEWS_EMBED_BATCH_LIMIT = 50

