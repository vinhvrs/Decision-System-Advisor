#!/usr/bin/env bash
set -u

ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
MIN_BARS="${MIN_BARS:-90}"
LIMIT="${LIMIT:-40}"
COMPOSE_FILE="${DSA_COMPOSE_FILE:-$ROOT/compose.pi.yml}"
OVERRIDE_FILE="${DSA_OVERRIDE_FILE:-$ROOT/ops/pi/compose.runtime.override.yml}"
PROJECT="${DSA_COMPOSE_PROJECT:-dsa-pi}"

cd "$ROOT" || {
  echo "ERROR: DSA root not found: $ROOT" >&2
  exit 2
}

compose_cmd() {
  if [ -f "$OVERRIDE_FILE" ]; then
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" "$@"
  else
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
  fi
}

echo "======================================================"
echo "DSA PI HISTORY AUDIT"
echo "======================================================"
echo "ROOT=$ROOT"
echo "COMPOSE_FILE=$COMPOSE_FILE"
echo "PROJECT=$PROJECT"
echo "TIME=$(date -Is)"
echo

echo "== Source checkpoint =="
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" branch --show-current || true
  git -C "$ROOT" rev-parse HEAD || true
  git -C "$ROOT" status --short || true
else
  echo "LIVE_TREE_MODE=non-git"
  [ -f "$ROOT/.deploy-state/target.sha" ] && echo "target_sha=$(cat "$ROOT/.deploy-state/target.sha")"
fi
echo

echo "== Docker Compose services =="
compose_cmd ps || true
echo

echo "== Runtime history/dashboard contract =="
compose_cmd config 2>/dev/null   | grep -E 'ENGINE_RESOURCE_PROFILE|SCHEDULER_MAX_WORKERS|AUTO_ANALYZE_(CONCURRENCY|SCHEDULE_LIMIT)|SYMBOL_INGEST_(MODE|TOP_N)|HISTORY_BOOTSTRAP_(MIN_BARS|DAYS)|DASHBOARD_WARM_UP_(LIMIT|CHART_BARS)|MARKET_BOARD_SYMBOL_LIMIT'   || true
echo

echo "== Python scheduler contract =="
compose_cmd exec -T data-engine python3 - <<'PY' || true
from app.bootstrap.scheduler_config import (
    SYMBOL_INGEST_MODE,
    SYMBOL_INGEST_TOP_N,
    WARM_UP_LIMIT,
    WARM_UP_CHART_BARS,
    ENGINE_RESOURCE_PROFILE,
    SCHEDULER_MAX_WORKERS,
    AUTO_ANALYZE_CONCURRENCY,
    AUTO_ANALYZE_SCHEDULE_LIMIT,
)
from config.settings import settings
import os

print("ENGINE_RESOURCE_PROFILE=", ENGINE_RESOURCE_PROFILE)
print("SCHEDULER_MAX_WORKERS=", SCHEDULER_MAX_WORKERS)
print("AUTO_ANALYZE_CONCURRENCY=", AUTO_ANALYZE_CONCURRENCY)
print("AUTO_ANALYZE_SCHEDULE_LIMIT=", AUTO_ANALYZE_SCHEDULE_LIMIT)
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
compose_cmd exec -T app php artisan list --raw   | grep -E '^data:(coverage|periods) '   || true
echo

echo "== Persisted OHLC coverage =="
set +e
compose_cmd exec -T app php artisan data:coverage   --limit="$LIMIT"   --min-bars="$MIN_BARS"
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
