#!/usr/bin/env bash
set -Eeuo pipefail

LIVE_ROOT="${DSA_ROOT:-/home/trivi/Decision-System-Advisor}"
TARGET_BRANCH="${DSA_BRANCH:-integration/dsa-next-v2-20261118}"
REPO_URL="${DSA_REPO_URL:-https://github.com/vinhvrs/Decision-System-Advisor.git}"
CACHE_ROOT="${DSA_CACHE_ROOT:-/home/trivi/.cache/dsa-live-capture}"
OUT_ROOT="${DSA_CAPTURE_ROOT:-/home/trivi}"
EXPECTED_SHA="${DSA_TARGET_SHA:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CACHE_REPO="$CACHE_ROOT/repo.git"
STAGE="$CACHE_ROOT/stage-$STAMP"
CAPTURE="$CACHE_ROOT/capture-$STAMP"
ARCHIVE="$OUT_ROOT/dsa-live-only-backend-$STAMP.tgz"
PLAN="$CAPTURE/rsync-plan.txt"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command missing: $1" >&2
    exit 2
  }
}

for cmd in git rsync tar sha256sum find sort awk sed; do
  require_cmd "$cmd"
done

[ -d "$LIVE_ROOT/backend" ] || {
  echo "ERROR: live backend root not found: $LIVE_ROOT/backend" >&2
  exit 2
}

mkdir -p "$CACHE_ROOT" "$OUT_ROOT"
rm -rf "$STAGE" "$CAPTURE"
mkdir -p "$STAGE" "$CAPTURE/backend"

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

echo "======================================================"
echo "DSA PI LIVE-ONLY BACKEND CAPTURE"
echo "======================================================"
echo "LIVE_ROOT=$LIVE_ROOT"
echo "TARGET_BRANCH=$TARGET_BRANCH"
echo "TIME=$(date -Is)"
echo

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
  exit 3
fi

git --git-dir="$CACHE_REPO" archive "$target_sha" | tar -x -C "$STAGE"

echo
echo "== Compute live-only backend plan =="
rsync -anic --delete "${SYNC_EXCLUDES[@]}" "$STAGE/backend/" "$LIVE_ROOT/backend/"   | tee "$PLAN"

sed -n 's/^\*deleting[[:space:]]\+//p' "$PLAN" > "$CAPTURE/live-only-paths.txt"

count=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  case "$rel" in
    /*|../*|*/../*|*/..)
      echo "ERROR: unsafe relative path in rsync plan: $rel" >&2
      exit 4
      ;;
  esac

  # Directory deletion lines are represented separately from their contents.
  # Capture only concrete files/symlinks; directory structure is recreated automatically.
  if [ -d "$LIVE_ROOT/backend/$rel" ] && [ ! -L "$LIVE_ROOT/backend/$rel" ]; then
    continue
  fi

  if [ -e "$LIVE_ROOT/backend/$rel" ] || [ -L "$LIVE_ROOT/backend/$rel" ]; then
    mkdir -p "$CAPTURE/backend/$(dirname "$rel")"
    cp -a "$LIVE_ROOT/backend/$rel" "$CAPTURE/backend/$rel"
    count=$((count + 1))
  else
    echo "WARNING: rsync reported deletion but live path is missing now: $rel" >&2
  fi
done < "$CAPTURE/live-only-paths.txt"

printf '%s\n' "$target_sha" > "$CAPTURE/target.sha"
printf '%s\n' "$TARGET_BRANCH" > "$CAPTURE/target.branch"
printf '%s\n' "$(date -Is)" > "$CAPTURE/captured-at.txt"
printf '%s\n' "$LIVE_ROOT" > "$CAPTURE/live-root.txt"
printf '%s\n' "$count" > "$CAPTURE/live-only-file-count.txt"

echo
echo "== SHA256 manifest =="
(
  cd "$CAPTURE"
  find backend -type f -print0     | sort -z     | xargs -0 -r sha256sum
) | tee "$CAPTURE/SHA256SUMS.txt"

echo
echo "== Symlink manifest =="
(
  cd "$CAPTURE"
  find backend -type l -printf '%p -> %l\n' | sort
) | tee "$CAPTURE/SYMLINKS.txt"

echo
echo "== Create archive =="
tar -C "$CAPTURE" -czf "$ARCHIVE" .

echo "LIVE_ONLY_FILE_COUNT=$count"
echo "ARCHIVE=$ARCHIVE"
ls -lh "$ARCHIVE"

echo
echo "======================================================"
echo "CAPTURE COMPLETE — NO LIVE SOURCE OR CONTAINER CHANGES MADE"
echo "======================================================"
