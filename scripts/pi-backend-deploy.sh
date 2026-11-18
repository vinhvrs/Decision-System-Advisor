#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
TARGET_BRANCH="${DSA_BRANCH:-integration/dsa-next-v2-20261118}"
REMOTE="${DSA_REMOTE:-origin}"
RUN_HISTORY_AUDIT="${RUN_HISTORY_AUDIT:-1}"
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "$ROOT" || {
  echo "ERROR: DSA root not found: $ROOT" >&2
  exit 2
}

echo "======================================================"
echo "DSA PI BACKEND DEPLOY"
echo "======================================================"
echo "ROOT=$ROOT"
echo "TARGET_BRANCH=$TARGET_BRANCH"
echo "TIME=$(date -Is)"
echo

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty. Refusing to pull or rebuild." >&2
  git status --short
  exit 3
fi

before_sha="$(git rev-parse HEAD)"
before_branch="$(git branch --show-current)"
echo "before_branch=$before_branch"
echo "before_sha=$before_sha"

git fetch --prune "$REMOTE" "$TARGET_BRANCH"
target_sha="$(git rev-parse "$REMOTE/$TARGET_BRANCH")"
echo "target_sha=$target_sha"

git checkout "$TARGET_BRANCH"
git pull --ff-only "$REMOTE" "$TARGET_BRANCH"

after_sha="$(git rev-parse HEAD)"
echo "after_sha=$after_sha"
if [ "$after_sha" != "$target_sha" ]; then
  echo "ERROR: checked-out HEAD does not match fetched target." >&2
  exit 4
fi

mkdir -p "$ROOT/.deploy-state"
printf '%s\n' "$before_sha" > "$ROOT/.deploy-state/backend-before-$STAMP.sha"
printf '%s\n' "$after_sha" > "$ROOT/.deploy-state/backend-after-$STAMP.sha"

echo
echo "== Compose validation =="
docker compose config -q

echo
echo "== Resource contract =="
docker compose config 2>/dev/null \
  | grep -E 'ENGINE_RESOURCE_PROFILE|SCHEDULER_MAX_WORKERS|AUTO_ANALYZE_(CONCURRENCY|SCHEDULE_LIMIT|FIRST_DELAY_SEC|STARTUP_WARMUP_ENABLED)|NEWS_STARTUP_DELAY_SEC|TECH_UNIVERSE_BOOTSTRAP_DELAY_SEC|SYMBOL_INGEST_TOP_N|MARKET_BOARD_SYMBOL_LIMIT' \
  || true

echo
echo "== Start persistent dependencies =="
docker compose up -d db qdrant elasticsearch

echo
echo "== Build backend images =="
docker compose build app data-engine

echo
echo "== Start backend services =="
docker compose up -d app data-engine nginx

echo
echo "== Wait for Laravel php-fpm health =="
for _ in $(seq 1 36); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' dsa-api 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "ERROR: dsa-api became unhealthy." >&2
    docker compose ps
    docker compose logs --tail=120 app
    exit 5
  fi
  sleep 5
done

if [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' dsa-api 2>/dev/null || true)" != "healthy" ]; then
  echo "ERROR: dsa-api did not become healthy." >&2
  docker compose ps
  docker compose logs --tail=120 app
  exit 6
fi

echo
echo "== Laravel migration/cache =="
docker compose exec -T app php artisan migrate --force
docker compose exec -T app php artisan optimize:clear
docker compose exec -T app php artisan config:cache

echo
echo "== Restart API after cached config =="
docker compose restart app
for _ in $(seq 1 24); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' dsa-api 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  sleep 5
done

echo
echo "== Data engine health =="
curl -fsS --max-time 15 http://127.0.0.1:8000/ ; echo
curl -fsS --max-time 15 http://127.0.0.1:8000/health/scheduler ; echo

echo
echo "== Containers =="
docker compose ps

echo
echo "== Memory snapshot =="
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' \
  dsa-mysql dsa-elasticsearch dsa-qdrant dsa-data-engine dsa-api dsa-nginx 2>/dev/null || true

history_rc=0
if [ "$RUN_HISTORY_AUDIT" = "1" ]; then
  echo
  echo "== 40-symbol persisted-history audit =="
  set +e
  DSA_ROOT="$ROOT" LIMIT=40 MIN_BARS=90 bash "$ROOT/scripts/pi-history-audit.sh"
  history_rc=$?
  set -e
fi

echo
echo "======================================================"
echo "DEPLOY COMPLETE"
echo "HEAD=$after_sha"
if [ "$history_rc" -eq 0 ]; then
  echo "HISTORY_AUDIT=PASS"
else
  echo "HISTORY_AUDIT=NEEDS_RECOVERY"
  echo "Code deploy is healthy, but one or more displayed symbols need canonical DSATurbo recovery."
fi
echo "Rollback source SHA saved at: $ROOT/.deploy-state/backend-before-$STAMP.sha"
echo "======================================================"
