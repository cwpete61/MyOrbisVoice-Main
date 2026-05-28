#!/usr/bin/env bash
# Convenience wrapper for pull-twilio-recordings.ts.
#
# Copies the .ts script into the running api container, executes it via the
# container's tsx, then copies the resulting recordings + index back to
# ./tmp/twilio-recordings/ on this laptop.
#
# Usage:
#   ./infrastructure/scripts/pull-twilio-recordings.sh [args]
#
# Args forward to the inner TS script:
#   --hours N       (default 24)
#   --limit N       (default 10 per subaccount)
#   --subaccount AC... (restrict to one)
#
# Requires:
#   - SSH access to the prod server
#   - Master Twilio creds available inside the api container
#     (env TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN OR system_configuration rows)
#
# Side effects:
#   - Writes /tmp/twilio-recordings/ inside the api container
#   - Writes ./tmp/twilio-recordings/ locally (recursive copy back)
#   - No DB changes, no audio mutation
set -euo pipefail

SERVER="${TWILIO_PULL_SERVER:-root@147.93.183.4}"
CONTAINER="${TWILIO_PULL_CONTAINER:-myorbisvoice-api}"
# Repo root = parent of infrastructure/. Anchor LOCAL_OUT there so the
# script works regardless of caller's cwd.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_OUT="${TWILIO_PULL_OUTDIR:-$REPO_ROOT/tmp/twilio-recordings}"

SCRIPT_LOCAL="$(cd "$(dirname "$0")" && pwd)/pull-twilio-recordings.mjs"
SCRIPT_REMOTE="/app/apps/api/pull-twilio-recordings.mjs"
CONTAINER_OUT="/tmp/twilio-recordings"

if [[ ! -f "$SCRIPT_LOCAL" ]]; then
  echo "ERR: script not found at $SCRIPT_LOCAL" >&2
  exit 1
fi

echo "→ copying script into $CONTAINER (via stdin → tee)..."
ssh "$SERVER" "docker exec -i $CONTAINER sh -c 'cat > $SCRIPT_REMOTE'" < "$SCRIPT_LOCAL"

echo "→ executing inside container (args: $*)..."
ssh "$SERVER" "docker exec $CONTAINER sh -lc 'cd /app/apps/api && rm -rf $CONTAINER_OUT && node $SCRIPT_REMOTE --outdir $CONTAINER_OUT $*'"

mkdir -p "$LOCAL_OUT"
echo "→ copying recordings back to $LOCAL_OUT/..."
ssh "$SERVER" "docker exec $CONTAINER tar -cf - -C $CONTAINER_OUT ." | tar -xf - -C "$LOCAL_OUT"

echo
echo "✓ Done. Recordings + index at $LOCAL_OUT/"
echo "  Listen:    open $LOCAL_OUT/*/*.mp3"
echo "  Spectrum:  ffmpeg -i <file>.mp3 -lavfi showspectrumpic=s=1200x600:legend=1 spectrum.png"
echo
echo "  Aliasing tells: periodic mirror bands above ~3.5kHz on the agent's voice."
