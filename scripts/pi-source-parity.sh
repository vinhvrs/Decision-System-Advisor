#!/usr/bin/env bash
set -u

ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
OUT="${1:-}"
COMPOSE_FILE="${DSA_COMPOSE_FILE:-$ROOT/compose.pi.yml}"
OVERRIDE_FILE="${DSA_OVERRIDE_FILE:-$ROOT/ops/pi/compose.runtime.override.yml}"
PROJECT="${DSA_COMPOSE_PROJECT:-dsa-pi}"

if [ -n "$OUT" ]; then
  mkdir -p "$(dirname "$OUT")"
  exec > >(tee "$OUT") 2>&1
fi

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
echo "DSA LIVE SOURCE PARITY CAPTURE"
echo "======================================================"
echo "ROOT=$ROOT"
echo "COMPOSE_FILE=$COMPOSE_FILE"
echo "PROJECT=$PROJECT"
echo "TIME=$(date -Is)"
echo

echo "== Source checkpoint =="
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf "branch="
  git -C "$ROOT" branch --show-current 2>/dev/null || true
  printf "head="
  git -C "$ROOT" rev-parse HEAD 2>/dev/null || true
  git -C "$ROOT" log -1 --date=iso-strict --pretty='commit_date=%cd%ncommit_subject=%s' 2>/dev/null || true
  echo
  echo "-- working tree --"
  git -C "$ROOT" status --short || true
  echo
else
  echo "LIVE_TREE_MODE=non-git"
  if [ -f "$ROOT/.deploy-state/target.sha" ]; then
    echo "target_sha=$(cat "$ROOT/.deploy-state/target.sha")"
  fi
fi
echo

hash_tree_git() {
  local prefix="$1"
  git -C "$ROOT" ls-files -z "$prefix" 2>/dev/null     | sort -z     | while IFS= read -r -d '' p; do
        sha256sum "$ROOT/$p" 2>/dev/null
      done     | sha256sum     | awk -v p="$prefix" '{print p "_sha256=" $1}'
}

hash_tree_fs() {
  local prefix="$1"
  find "$ROOT/$prefix" -type f     ! -path '*/.next/*'     ! -path '*/node_modules/*'     ! -path '*/vendor/*'     ! -path '*/storage/*'     ! -path '*/bootstrap/cache/*'     ! -path '*/__pycache__/*'     ! -name '.env'     ! -name '.env.*'     ! -name '*.pyc'     -print0 2>/dev/null     | sort -z     | xargs -0 sha256sum 2>/dev/null     | sha256sum     | awk -v p="$prefix" '{print p "_sha256=" $1}'
}

echo "== Source tree fingerprints =="
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  hash_tree_git frontend
  hash_tree_git backend
else
  hash_tree_fs frontend
  hash_tree_fs backend
fi
echo

echo "== Source route manifest =="
if [ -d frontend/src/app ]; then
  find frontend/src/app -type f -name 'page.tsx' -print     | sed -E 's#^frontend/src/app##; s#/page\.tsx$##; s#\([^/]+\)/##g; s#//+#/#g; s#^$#/#'     | sort -u
else
  echo "frontend/src/app missing"
fi
echo

echo "== Live-only route probes in source =="
for needle in data-health market-analytics chart-data-map; do
  printf "%s=" "$needle"
  if grep -R -l --exclude-dir=node_modules --exclude-dir=.next -- "$needle" frontend 2>/dev/null | head -n 1 | grep -q .; then
    echo "FOUND"
  else
    echo "NOT_FOUND"
  fi
done
echo

echo "== Docker runtime =="
compose_cmd config --services 2>/dev/null || true
echo
compose_cmd ps 2>/dev/null || true
echo

echo "-- all DSA-like containers/images --"
docker ps --format '{{.Names}}	{{.Image}}	{{.Status}}' 2>/dev/null   | grep -Ei 'dsa|decision|advisor|frontend|next|nginx|data-engine|api'   || true
echo

echo "== Runtime 40-symbol / Pi contract (non-secret) =="
compose_cmd config 2>/dev/null   | grep -E 'ENGINE_RESOURCE_PROFILE|SCHEDULER_MAX_WORKERS|AUTO_ANALYZE_(CONCURRENCY|SCHEDULE_LIMIT)|SYMBOL_INGEST_(MODE|TOP_N)|HISTORY_BOOTSTRAP_(MIN_BARS|DAYS)|DASHBOARD_WARM_UP_(LIMIT|CHART_BARS)|MARKET_BOARD_SYMBOL_LIMIT'   || true
echo

echo "== Data-engine resolved contract =="
compose_cmd exec -T data-engine python3 - <<'PY' 2>/dev/null || true
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
print("MARKET_BOARD_SYMBOL_LIMIT=", os.environ.get("MARKET_BOARD_SYMBOL_LIMIT", ""))
print("HISTORY_BOOTSTRAP_MIN_BARS=", os.environ.get("HISTORY_BOOTSTRAP_MIN_BARS", ""))
print("HISTORY_BOOTSTRAP_DAYS=", os.environ.get("HISTORY_BOOTSTRAP_DAYS", ""))
print("ENGINE_RESOURCE_PROFILE=", os.environ.get("ENGINE_RESOURCE_PROFILE", ""))
print("SCHEDULER_MAX_WORKERS=", os.environ.get("SCHEDULER_MAX_WORKERS", ""))
PY
echo

echo "== Public route response fingerprints =="
for url in   https://aitemple.tech/   https://aitemple.tech/data-health   https://aitemple.tech/market-analytics
do
  echo "-- $url --"
  tmp="$(mktemp)"
  code="$(curl -L -sS --max-time 15 -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null || true)"
  echo "http_status=${code:-ERROR}"
  if [ -s "$tmp" ]; then
    echo "body_sha256=$(sha256sum "$tmp" | awk '{print $1}')"
    grep -Eo '<title>[^<]+' "$tmp" | head -n 1 || true
  fi
  rm -f "$tmp"
done
echo

echo "======================================================"
echo "CAPTURE COMPLETE"
echo "No env-file values, secrets, database contents or full source diffs were printed."
echo "======================================================"
