#!/usr/bin/env bash
set -u

ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
MIN_BARS="${MIN_BARS:-90}"
LIMIT="${LIMIT:-40}"

cd "$ROOT" || {
  echo "ERROR: DSA root not found: $ROOT" >&2
  exit 2
}

echo "======================================================"
echo "DSA PI HISTORY AUDIT"
echo "======================================================"
echo "ROOT=$ROOT"
echo "TIME=$(date -Is)"
echo

echo "== Git checkpoint =="
git branch --show-current || true
git rev-parse HEAD || true
git status --short || true
echo

echo "== Docker Compose services =="
docker compose ps || true
echo

echo "== Runtime history/dashboard contract =="
docker compose config 2>/dev/null   | grep -E 'SYMBOL_INGEST_(MODE|TOP_N)|HISTORY_BOOTSTRAP_(MIN_BARS|DAYS)|DASHBOARD_WARM_UP_(LIMIT|CHART_BARS)|MARKET_BOARD_SYMBOL_LIMIT'   || true
echo

echo "== Python scheduler contract =="
docker compose exec -T data-engine python3 - <<'PY' || true
from app.bootstrap.scheduler_config import (
    SYMBOL_INGEST_MODE,
    SYMBOL_INGEST_TOP_N,
    WARM_UP_LIMIT,
    WARM_UP_CHART_BARS,
)
from config.settings import settings
import os

print("DEV_MODE=", getattr(settings, "DEV_MODE", "?"))
print("USE_DEMO_TABLES=", getattr(settings, "USE_DEMO_TABLES", "?"))
print("SYMBOL_INGEST_MODE=", SYMBOL_INGEST_MODE)
print("SYMBOL_INGEST_TOP_N=", SYMBOL_INGEST_TOP_N)
print("DASHBOARD_WARM_UP_LIMIT=", WARM_UP_LIMIT)
print("DASHBOARD_WARM_UP_CHART_BARS=", WARM_UP_CHART_BARS)
print("HISTORY_BOOTSTRAP_MIN_BARS=", os.environ.get("HISTORY_BOOTSTRAP_MIN_BARS", "180"))
print("HISTORY_BOOTSTRAP_DAYS=", os.environ.get("HISTORY_BOOTSTRAP_DAYS", "3650"))
PY
echo

echo "== Registered data commands =="
docker compose exec -T app php artisan list --raw   | grep -E '^data:(coverage|periods) '   || true
echo

echo "== Persisted OHLC coverage =="
set +e
docker compose exec -T app php artisan data:coverage   --limit="$LIMIT"   --min-bars="$MIN_BARS"
coverage_rc=$?
set -e

echo
echo "======================================================"
if [ "$coverage_rc" -eq 0 ]; then
  echo "RESULT: PASS — persisted history coverage meets the requested threshold."
else
  echo "RESULT: FAIL — one or more symbols are SHORT/MISSING/DUPLICATE."
  echo "Do not manufacture chart points or delete duplicate rows automatically."
  echo "Use docs/history-coverage-runbook.md for targeted canonical DSATurbo recovery."
fi
echo "======================================================"

exit "$coverage_rc"
