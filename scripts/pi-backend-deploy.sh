#!/usr/bin/env bash
set -Eeuo pipefail

LIVE_ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
TARGET_BRANCH="${DSA_BRANCH:-integration/dsa-next-v2-20261118}"
REPO_URL="${DSA_REPO_URL:-https://github.com/vinhvrs/Decision-System-Advisor.git}"
CACHE_ROOT="${DSA_CACHE_ROOT:-/home/trivi/.cache/dsa-deploy}"
RELEASE_ROOT="${DSA_RELEASE_ROOT:-/home/trivi/dsa-releases}"
COMPOSE_FILE="${DSA_COMPOSE_FILE:-$LIVE_ROOT/compose.pi.yml}"
OVERRIDE_FILE="${DSA_OVERRIDE_FILE:-$LIVE_ROOT/ops/pi/compose.runtime.override.yml}"
PROJECT="${DSA_COMPOSE_PROJECT:-dsa-pi}"
RUN_HISTORY_AUDIT="${RUN_HISTORY_AUDIT:-1}"
ALLOW_DB_MIGRATIONS="${ALLOW_DB_MIGRATIONS:-0}"
ALLOW_LIVE_ONLY_DELETIONS="${ALLOW_LIVE_ONLY_DELETIONS:-0}"
PREFLIGHT_ONLY="${PREFLIGHT_ONLY:-0}"
EXPECTED_SHA="${DSA_TARGET_SHA:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CACHE_REPO="$CACHE_ROOT/repo.git"
STAGE="$CACHE_ROOT/stage-$STAMP"
BACKUP="$RELEASE_ROOT/$STAMP-backend-git-sync"
NEW_MIGRATIONS_FILE="$STAGE/.new-git-migrations"
SOURCE_SYNC_STARTED=0
OVERRIDE_EXISTED=0
BACKUP_READY=0

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command missing: $1" >&2
    exit 2
  }
}

for cmd in git docker rsync tar python3; do
  require_cmd "$cmd"
done

docker compose version >/dev/null 2>&1 || {
  echo "ERROR: Docker Compose v2 is required." >&2
  exit 2
}

[ -d "$LIVE_ROOT" ] || {
  echo "ERROR: live DSA root not found: $LIVE_ROOT" >&2
  exit 2
}
[ -f "$COMPOSE_FILE" ] || {
  echo "ERROR: Pi compose file not found: $COMPOSE_FILE" >&2
  exit 2
}

mkdir -p "$CACHE_ROOT" "$RELEASE_ROOT" "$STAGE" "$BACKUP"

SYNC_EXCLUDES=(
  --exclude '.env'
  --exclude '.env.*'
  --exclude 'storage/'
  --exclude 'bootstrap/cache/'
  --exclude 'vendor/'
  --exclude 'node_modules/'
  --exclude 'certs/'
  --exclude 'platform/'
  --exclude 'Dockerfile.pi'
  --exclude 'public/storage'
  --exclude 'public/build/'
  --exclude 'public/hot'
  --exclude '.phpunit.result.cache'
  --exclude '__pycache__/'
  --exclude '*.pyc'
)

compose_cmd() {
  if [ -f "$OVERRIDE_FILE" ]; then
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" -f "$OVERRIDE_FILE" "$@"
  else
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
  fi
}

restore_source() {
  trap - ERR

  if [ "$BACKUP_READY" = "1" ]; then
    if [ "$OVERRIDE_EXISTED" = "1" ] && [ -f "$BACKUP/compose.runtime.override.yml" ]; then
      mkdir -p "$(dirname "$OVERRIDE_FILE")"
      cp -a "$BACKUP/compose.runtime.override.yml" "$OVERRIDE_FILE" || true
    elif [ "$OVERRIDE_EXISTED" = "0" ]; then
      rm -f "$OVERRIDE_FILE" || true
    fi
  fi

  if [ "$SOURCE_SYNC_STARTED" != "1" ]; then
    return 0
  fi

  echo
  echo "!! DEPLOY FAILED — RESTORING PRE-DEPLOY SOURCE !!"
  compose_cmd stop data-engine >/dev/null 2>&1 || true

  if [ -d "$BACKUP/backend" ]; then
    rsync -a --delete "${SYNC_EXCLUDES[@]}" "$BACKUP/backend/" "$LIVE_ROOT/backend/" || true
  fi

  echo "Rebuilding restored app/data-engine..."
  compose_cmd build app data-engine || true
  compose_cmd up -d --no-deps app data-engine || true
  echo "Rollback source restored from: $BACKUP"
}

trap restore_source ERR

echo "======================================================"
echo "DSA PI LIVE BACKEND DEPLOY"
echo "======================================================"
echo "LIVE_ROOT=$LIVE_ROOT"
echo "COMPOSE_FILE=$COMPOSE_FILE"
echo "PROJECT=$PROJECT"
echo "TARGET_BRANCH=$TARGET_BRANCH"
echo "TIME=$(date -Is)"
echo

echo "== Verify live dsa-pi topology =="
live_project="$(docker inspect dsa-pi-data-engine-1 -f '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)"
live_workdir="$(docker inspect dsa-pi-data-engine-1 -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>/dev/null || true)"
if [ "$live_project" != "$PROJECT" ] || [ "$live_workdir" != "$LIVE_ROOT" ]; then
  echo "ERROR: live data-engine does not match expected dsa-pi topology." >&2
  echo "project=$live_project"
  echo "working_dir=$live_workdir"
  exit 3
fi
echo "project=$live_project"
echo "working_dir=$live_workdir"

echo
echo "== Fetch target Git commit into isolated cache =="
if [ ! -d "$CACHE_REPO" ]; then
  git clone --mirror "$REPO_URL" "$CACHE_REPO"
else
  git --git-dir="$CACHE_REPO" remote set-url origin "$REPO_URL"
fi

git --git-dir="$CACHE_REPO" fetch --prune origin "$TARGET_BRANCH"
target_sha="$(git --git-dir="$CACHE_REPO" rev-parse FETCH_HEAD)"
echo "target_sha=$target_sha"

if [ -n "$EXPECTED_SHA" ] && [ "$target_sha" != "$EXPECTED_SHA" ]; then
  echo "ERROR: fetched target SHA does not match DSA_TARGET_SHA." >&2
  echo "expected=$EXPECTED_SHA"
  echo "actual=$target_sha"
  exit 4
fi

git --git-dir="$CACHE_REPO" archive "$target_sha" | tar -x -C "$STAGE"

for required in   backend/python_engine/app/bootstrap/scheduler_config.py   backend/python_engine/app/bootstrap/scheduler_runtime.py   backend/python_engine/app/jobs/analysis_job.py   scripts/pi-history-audit.sh   scripts/pi-source-parity.sh   ops/pi/compose.runtime.override.yml
do
  [ -e "$STAGE/$required" ] || {
    echo "ERROR: target commit is missing required path: $required" >&2
    exit 4
  }
done

echo
echo "== Staged source preflight =="
python3 -m compileall -q "$STAGE/backend/python_engine/app"
bash -n "$STAGE/scripts/pi-history-audit.sh"
bash -n "$STAGE/scripts/pi-source-parity.sh"
bash -n "$STAGE/scripts/pi-backend-deploy.sh"

echo
echo "== Verify migration content parity =="
set +e
python3 - "$STAGE/backend/database/migrations" "$LIVE_ROOT/backend/database/migrations" "$ALLOW_DB_MIGRATIONS" "$NEW_MIGRATIONS_FILE" <<'PY'
from __future__ import annotations

import hashlib
import pathlib
import sys

stage = pathlib.Path(sys.argv[1])
live = pathlib.Path(sys.argv[2])
allow_new = sys.argv[3] == "1"
new_file = pathlib.Path(sys.argv[4])

def php_files(root: pathlib.Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not root.is_dir():
        return result
    for path in sorted(root.glob("*.php")):
        result[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result

stage_files = php_files(stage)
live_files = php_files(live)

stage_only = sorted(set(stage_files) - set(live_files))
live_only = sorted(set(live_files) - set(stage_files))
changed = sorted(
    name for name in set(stage_files) & set(live_files)
    if stage_files[name] != live_files[name]
)

print(f"stage_migrations={len(stage_files)}")
print(f"live_migrations={len(live_files)}")

if live_only:
    print("LIVE_ONLY_MIGRATIONS:")
    for name in live_only:
        print(f"  {name}")

if changed:
    print("CONTENT_CHANGED_MIGRATIONS:")
    for name in changed:
        print(f"  {name}")
        print(f"    git_sha256={stage_files[name]}")
        print(f"    live_sha256={live_files[name]}")

if stage_only:
    print("NEW_GIT_MIGRATIONS:")
    for name in stage_only:
        print(f"  {name}")

new_file.write_text(
    "".join(f"{name}\n" for name in stage_only),
    encoding="utf-8",
)

if live_only:
    print(
        "ERROR: production contains migration files absent from Git. "
        "Canonicalize the exact live files into Git before deployment.",
        file=sys.stderr,
    )
    sys.exit(20)

if changed:
    print(
        "ERROR: an existing migration filename has different content in Git and production. "
        "Applied migrations are immutable; reconcile source before deployment.",
        file=sys.stderr,
    )
    sys.exit(21)

if stage_only and not allow_new:
    print(
        "ERROR: Git contains new migration files not present on production. "
        "Review them, then set ALLOW_DB_MIGRATIONS=1 for this deployment.",
        file=sys.stderr,
    )
    sys.exit(22)

if stage_only:
    print("Migration gate: reviewed new Git migrations are allowed for this run.")
else:
    print("Migration gate: exact content parity; metadata differences ignored.")
PY
migration_rc=$?
set -e

case "$migration_rc" in
  0)
    ;;
  20|21|22)
    exit 5
    ;;
  *)
    echo "ERROR: migration parity checker failed unexpectedly (rc=$migration_rc)." >&2
    exit 5
    ;;
esac

echo
echo "== Backend source change plan =="
PLAN_FILE="$STAGE/rsync-plan.txt"
rsync -anic --delete "${SYNC_EXCLUDES[@]}" "$STAGE/backend/" "$LIVE_ROOT/backend/" \
  | tee "$PLAN_FILE"

live_only_deletions="$(grep -E '^\*deleting[[:space:]]+' "$PLAN_FILE" || true)"
if [ -n "$live_only_deletions" ]; then
  echo
  echo "LIVE_ONLY_BACKEND_DELETIONS:"
  echo "$live_only_deletions"
  if [ "$ALLOW_LIVE_ONLY_DELETIONS" != "1" ]; then
    echo "ERROR: live backend contains files absent from Git that rsync would delete." >&2
    echo "Review/canonicalize or explicitly preserve those files before deployment." >&2
    echo "To approve reviewed deletions for this run only, set ALLOW_LIVE_ONLY_DELETIONS=1." >&2
    exit 8
  fi
fi

if [ "$PREFLIGHT_ONLY" = "1" ]; then
  echo
  echo "======================================================"
  echo "PREFLIGHT COMPLETE — NO LIVE SOURCE OR CONTAINER CHANGES MADE"
  echo "TARGET_SHA=$target_sha"
  echo "PLAN_FILE=$PLAN_FILE"
  echo "======================================================"
  exit 0
fi

echo
echo "== Snapshot current live backend source =="
rsync -a "${SYNC_EXCLUDES[@]}" "$LIVE_ROOT/backend/" "$BACKUP/backend/"
cp -a "$COMPOSE_FILE" "$BACKUP/compose.pi.yml"
if [ -f "$OVERRIDE_FILE" ]; then
  OVERRIDE_EXISTED=1
  cp -a "$OVERRIDE_FILE" "$BACKUP/compose.runtime.override.yml"
fi
BACKUP_READY=1
printf '%s\n' "$target_sha" > "$BACKUP/target.sha"
printf '%s\n' "$TARGET_BRANCH" > "$BACKUP/target.branch"
cp -a "$PLAN_FILE" "$BACKUP/rsync-plan.txt"

echo
echo "== Install Git-controlled Pi runtime override =="
mkdir -p "$(dirname "$OVERRIDE_FILE")"
install -m 0644 "$STAGE/ops/pi/compose.runtime.override.yml" "$OVERRIDE_FILE"
mkdir -p "$LIVE_ROOT/scripts"
install -m 0755 "$STAGE/scripts/pi-history-audit.sh" "$LIVE_ROOT/scripts/pi-history-audit.sh"
install -m 0755 "$STAGE/scripts/pi-source-parity.sh" "$LIVE_ROOT/scripts/pi-source-parity.sh"
install -m 0755 "$STAGE/scripts/pi-backend-deploy.sh" "$LIVE_ROOT/scripts/pi-backend-deploy.sh"

echo
echo "== Validate live compose + override =="
compose_cmd config -q
compose_cmd config 2>/dev/null   | grep -E 'ENGINE_RESOURCE_PROFILE|SCHEDULER_MAX_WORKERS|AUTO_ANALYZE_(CONCURRENCY|SCHEDULE_LIMIT|STARTUP_WARMUP_ENABLED)|SYMBOL_INGEST_TOP_N|MARKET_BOARD_SYMBOL_LIMIT|HISTORY_BOOTSTRAP_(MIN_BARS|DAYS)|DASHBOARD_WARM_UP_(LIMIT|CHART_BARS)'   || true

echo
echo "== Stop only bind-mounted data-engine before source cutover =="
compose_cmd stop data-engine
SOURCE_SYNC_STARTED=1

echo
echo "== Sync target backend into live tree =="
rsync -a --checksum --delete "${SYNC_EXCLUDES[@]}" "$STAGE/backend/" "$LIVE_ROOT/backend/"

echo
echo "== Build new backend images while existing Laravel app keeps serving =="
compose_cmd build app data-engine

echo
echo "== Recreate app + data-engine from new images =="
compose_cmd up -d --no-deps app data-engine

echo
echo "== Wait for app and data-engine processes =="
for _ in $(seq 1 36); do
  app_id="$(compose_cmd ps -q app)"
  engine_id="$(compose_cmd ps -q data-engine)"
  app_state="$(docker inspect -f '{{.State.Status}}' "$app_id" 2>/dev/null || true)"
  engine_state="$(docker inspect -f '{{.State.Status}}' "$engine_id" 2>/dev/null || true)"
  if [ "$app_state" = "running" ] && [ "$engine_state" = "running" ]; then
    break
  fi
  sleep 5
done

app_id="$(compose_cmd ps -q app)"
engine_id="$(compose_cmd ps -q data-engine)"
[ "$(docker inspect -f '{{.State.Status}}' "$app_id" 2>/dev/null || true)" = "running" ] || {
  echo "ERROR: Laravel app did not reach running state." >&2
  compose_cmd logs --tail=120 app
  exit 6
}
[ "$(docker inspect -f '{{.State.Status}}' "$engine_id" 2>/dev/null || true)" = "running" ] || {
  echo "ERROR: data-engine did not reach running state." >&2
  compose_cmd logs --tail=120 data-engine
  exit 6
}

echo
echo "== Laravel targeted migration/cache =="
if [ -s "$NEW_MIGRATIONS_FILE" ]; then
  if [ "$ALLOW_DB_MIGRATIONS" != "1" ]; then
    echo "ERROR: reviewed new migrations exist but ALLOW_DB_MIGRATIONS is not enabled." >&2
    exit 7
  fi

  while IFS= read -r migration; do
    [ -n "$migration" ] || continue
    echo "Applying reviewed migration only: $migration"
    compose_cmd exec -T app php artisan migrate --force --path="database/migrations/$migration"
  done < "$NEW_MIGRATIONS_FILE"
else
  echo "No new Git migrations to apply; skipping php artisan migrate."
fi

compose_cmd exec -T app php artisan optimize:clear
compose_cmd exec -T app php artisan config:cache
compose_cmd restart app

echo
echo "== Runtime health gates =="
compose_cmd exec -T app sh -lc 'pidof php-fpm >/dev/null 2>&1 || pgrep -f "php-fpm: master" >/dev/null'

compose_cmd exec -T data-engine python3 - <<'PY'
import json
import urllib.request

def get(path):
    with urllib.request.urlopen("http://127.0.0.1:8000" + path, timeout=15) as r:
        return json.load(r)

root = get("/")
scheduler = get("/health/scheduler")
print("engine=", root)
print("scheduler_status=", scheduler.get("status"))
print("resource_profile=", scheduler.get("resource_profile"))
print("scheduler_max_workers=", scheduler.get("scheduler_max_workers"))
print("dashboard_row_count=", (scheduler.get("dashboard_warm_up_last") or {}).get("row_count"))

assert root.get("status") == "online"
assert scheduler.get("running") is True
assert scheduler.get("resource_profile") == "pi4"
assert scheduler.get("scheduler_max_workers") == 1
row_count = (scheduler.get("dashboard_warm_up_last") or {}).get("row_count")
assert row_count in (None, 40) or int(row_count) >= 40
PY

mkdir -p "$LIVE_ROOT/.deploy-state"
printf '%s\n' "$target_sha" > "$LIVE_ROOT/.deploy-state/target.sha"
printf '%s\n' "$TARGET_BRANCH" > "$LIVE_ROOT/.deploy-state/target.branch"
printf '%s\n' "$STAMP" > "$LIVE_ROOT/.deploy-state/deployed-at"

echo
echo "== Containers =="
compose_cmd ps

echo
echo "== Memory snapshot =="
ids="$(compose_cmd ps -q | tr '\n' ' ')"
if [ -n "$ids" ]; then
  # shellcheck disable=SC2086
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' $ids || true
fi

history_rc=0
if [ "$RUN_HISTORY_AUDIT" = "1" ]; then
  echo
  echo "== 40-symbol persisted-history audit =="
  set +e
  DSA_ROOT="$LIVE_ROOT"   DSA_COMPOSE_FILE="$COMPOSE_FILE"   DSA_OVERRIDE_FILE="$OVERRIDE_FILE"   DSA_COMPOSE_PROJECT="$PROJECT"   LIMIT=40 MIN_BARS=90     bash "$LIVE_ROOT/scripts/pi-history-audit.sh"
  history_rc=$?
  set -e
fi

SOURCE_SYNC_STARTED=0
trap - ERR
rm -rf "$STAGE"

echo
echo "======================================================"
echo "DEPLOY COMPLETE"
echo "TARGET_SHA=$target_sha"
echo "BACKUP=$BACKUP"
if [ "$history_rc" -eq 0 ]; then
  echo "HISTORY_AUDIT=PASS"
else
  echo "HISTORY_AUDIT=NEEDS_RECOVERY"
  echo "Code/runtime deploy passed, but persisted-history coverage needs targeted canonical DSATurbo recovery."
fi
echo "======================================================"

exit 0
