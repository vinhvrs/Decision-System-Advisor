#!/usr/bin/env bash
set -u

ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
OUT="${1:-}"

if [ -n "$OUT" ]; then
  mkdir -p "$(dirname "$OUT")"
  exec > >(tee "$OUT") 2>&1
fi

cd "$ROOT" || {
  echo "ERROR: DSA root not found: $ROOT" >&2
  exit 2
}

echo "======================================================"
echo "DSA LIVE SOURCE PARITY CAPTURE"
echo "======================================================"
echo "ROOT=$ROOT"
echo "TIME=$(date -Is)"
echo

echo "== Git checkpoint =="
printf "branch="
git branch --show-current 2>/dev/null || true
printf "head="
git rev-parse HEAD 2>/dev/null || true
git log -1 --date=iso-strict --pretty='commit_date=%cd%ncommit_subject=%s' 2>/dev/null || true
echo

echo "== Working tree =="
git status --short || true
echo
echo "-- changed paths --"
git diff --name-status 2>/dev/null || true
git diff --cached --name-status 2>/dev/null || true
echo
echo "-- untracked paths --"
git ls-files --others --exclude-standard 2>/dev/null || true
echo

echo "== Source tree fingerprints =="
hash_tree() {
  local prefix="$1"
  if git ls-files -z "$prefix" 2>/dev/null | grep -qz .; then
    git ls-files -z "$prefix"       | sort -z       | xargs -0 sha256sum 2>/dev/null       | sha256sum       | awk -v p="$prefix" '{print p "_sha256=" $1}'
  else
    echo "${prefix}_sha256=UNAVAILABLE"
  fi
}
hash_tree frontend
hash_tree backend
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

echo "== Next build fingerprints/manifests =="
if [ -f frontend/.next/BUILD_ID ]; then
  echo "next_build_id=$(cat frontend/.next/BUILD_ID)"
else
  echo "next_build_id=UNAVAILABLE"
fi
for manifest in   frontend/.next/server/app-paths-manifest.json   frontend/.next/routes-manifest.json   frontend/.next/server/middleware-manifest.json
do
  if [ -f "$manifest" ]; then
    echo "-- $manifest --"
    sha256sum "$manifest"
    if [[ "$manifest" == *app-paths-manifest.json ]]; then
      python3 - "$manifest" <<'PY' 2>/dev/null || true
import json, sys
path=sys.argv[1]
data=json.load(open(path, encoding="utf-8"))
for route in sorted(data):
    print(route)
PY
    fi
  fi
done
echo

echo "== Docker runtime =="
docker compose config --services 2>/dev/null || true
echo
docker compose ps 2>/dev/null || true
echo
echo "-- all DSA-like containers/images --"
docker ps --format '{{.Names}}	{{.Image}}	{{.Status}}' 2>/dev/null   | grep -Ei 'dsa|decision|advisor|frontend|next|nginx|data-engine|api'   || true
echo

echo "== Runtime 40-symbol contract (non-secret) =="
docker compose config 2>/dev/null   | grep -E 'SYMBOL_INGEST_(MODE|TOP_N)|HISTORY_BOOTSTRAP_(MIN_BARS|DAYS)|DASHBOARD_WARM_UP_(LIMIT|CHART_BARS)|MARKET_BOARD_SYMBOL_LIMIT'   || true
echo

echo "== Data-engine resolved contract =="
docker compose exec -T data-engine python3 - <<'PY' 2>/dev/null || true
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
