#!/usr/bin/env bash
# deploy.sh — atomic build → sync → inject → verify
# Usage: ./infrastructure/scripts/deploy.sh [api|web|gateway|all] "reason"
set -euo pipefail

SERVER="root@147.93.183.4"
REMOTE="/opt/myorbisvoice"
TARGET="${1:-all}"
REASON="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRISMA_CLIENT="$REPO_ROOT/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client"
STAMP="$(date '+%Y%m%d_%H%M%S')"

if [[ -z "$REASON" ]]; then
  echo "Usage: $0 [api|web|gateway|all] \"reason for this deploy\""
  exit 1
fi

log()  { echo ""; echo "── $*"; }
ok()   { echo "   ✓ $*"; }
fail() { echo "   ✗ $*"; exit 1; }

cd "$REPO_ROOT"

# ── 1. Pre-deploy snapshot ─────────────────────────────────────────────────
log "Pre-deploy snapshot..."
mkdir -p backups
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > "backups/db_${STAMP}_pre_${TARGET}.dump" 2>/dev/null && ok "Local DB snapshot: backups/db_${STAMP}_pre_${TARGET}.dump"
ssh "$SERVER" "docker exec myorbisvoice-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > /var/backups/va/db_${STAMP}_pre_${TARGET}.dump" && ok "Prod DB snapshot saved"

# ── 2. Prisma — always regenerate and push ─────────────────────────────────
log "Prisma client — regenerate and push to containers..."
pnpm exec prisma generate --schema=prisma/schema.prisma 2>&1 | grep -E "Generated|error" || true
rsync -az "$PRISMA_CLIENT/" \
  "$SERVER:$REMOTE/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/"
ssh "$SERVER" "
  docker cp $REMOTE/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/. \
    myorbisvoice-api:/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/ &&
  docker cp $REMOTE/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/. \
    myorbisvoice-gateway:/app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/
"
ok "Prisma client pushed to api + gateway containers"

# ── 3. Service steps ───────────────────────────────────────────────────────
step_api() {
  log "API — build → sync → inject → restart..."
  pnpm --filter @voiceautomation/api build 2>&1 | grep -E "error TS|^>" || true
  rsync -az --delete "$REPO_ROOT/apps/api/dist/" "$SERVER:$REMOTE/apps/api/dist/"
  ssh "$SERVER" "docker cp $REMOTE/apps/api/dist/. myorbisvoice-api:/app/apps/api/dist/"
  ssh "$SERVER" "docker restart myorbisvoice-api"
  sleep 5
  # Verify API started
  RESULT=$(ssh "$SERVER" "docker logs myorbisvoice-api --tail=5 2>&1")
  if echo "$RESULT" | grep -q "listening on"; then
    ok "API listening"
  else
    fail "API did not start cleanly:\n$RESULT"
  fi
  # Check for stale Prisma errors
  if echo "$RESULT" | grep -q "Cannot read properties of undefined"; then
    fail "Prisma client stale in API container — re-run deploy or push Prisma client manually"
  fi
}

step_gateway() {
  log "Gateway — build → sync → inject → restart..."
  pnpm --filter @voiceautomation/voice-gateway build 2>&1 | grep -E "error TS|^>" || true
  rsync -az --delete "$REPO_ROOT/apps/voice-gateway/dist/" "$SERVER:$REMOTE/apps/voice-gateway/dist/"
  ssh "$SERVER" "docker cp $REMOTE/apps/voice-gateway/dist/. myorbisvoice-gateway:/app/apps/voice-gateway/dist/"
  ssh "$SERVER" "docker restart myorbisvoice-gateway"
  sleep 5
  RESULT=$(ssh "$SERVER" "docker logs myorbisvoice-gateway --tail=5 2>&1")
  if echo "$RESULT" | grep -q "listening on port 5000"; then
    ok "Gateway listening"
  else
    fail "Gateway did not start cleanly:\n$RESULT"
  fi
  if echo "$RESULT" | grep -q "Cannot find module"; then
    fail "Missing module in gateway — check container has all dist files"
  fi
}

step_web() {
  log "Web — build → sync → WIPE stale chunks → inject → restart..."
  pnpm --filter @voiceautomation/web build 2>&1 | grep -E "Error|Failed|^>" || true
  rsync -az --delete "$REPO_ROOT/apps/web/.next/" "$SERVER:$REMOTE/apps/web/.next/"
  # CRITICAL: wipe stale static chunks before injecting — old chunk hashes cause client crashes
  ssh "$SERVER" "docker exec myorbisvoice-web sh -c 'rm -rf /app/apps/web/.next/static'"
  ssh "$SERVER" "docker cp $REMOTE/apps/web/.next/. myorbisvoice-web:/app/apps/web/.next/"
  ssh "$SERVER" "docker restart myorbisvoice-web"
  sleep 5
  RESULT=$(ssh "$SERVER" "docker logs myorbisvoice-web --tail=5 2>&1")
  if echo "$RESULT" | grep -q "Ready in"; then
    ok "Web ready"
  else
    fail "Web did not start cleanly:\n$RESULT"
  fi
}

# ── 4. Run selected targets ────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  MyOrbisVoice Deploy: $TARGET"
echo "║  Reason: $REASON"
echo "╚══════════════════════════════════════╝"

case "$TARGET" in
  api)     step_api ;;
  gateway) step_gateway ;;
  web)     step_web ;;
  all)
    step_api
    step_gateway
    step_web
    ;;
  *)
    echo "Unknown target: $TARGET. Use api|web|gateway|all"
    exit 1
    ;;
esac

# ── 5. Health checks ───────────────────────────────────────────────────────
log "Health checks..."
sleep 3
HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://api.myorbisvoice.com/health 2>/dev/null || echo "000")
if [[ "$HTTP" == "200" ]]; then
  ok "API health: 200"
else
  fail "API health check failed: HTTP $HTTP"
fi

WEB=$(curl -s -o /dev/null -w "%{http_code}" https://app.myorbisvoice.com 2>/dev/null || echo "000")
if [[ "$WEB" == "200" ]]; then
  ok "Web: 200"
else
  echo "   ⚠ Web returned HTTP $WEB (may still be starting)"
fi

# ── 6. Post-deploy snapshot ────────────────────────────────────────────────
log "Post-deploy snapshot..."
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > "backups/db_${STAMP}_post_${TARGET}.dump" 2>/dev/null && ok "Post snapshot: backups/db_${STAMP}_post_${TARGET}.dump"

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy complete: $TARGET"
echo "  App:     https://app.myorbisvoice.com"
echo "  API:     https://api.myorbisvoice.com/health"
echo "  Reason:  $REASON"
echo "═══════════════════════════════════════"
echo ""
echo "  Next: hard-refresh the browser (Ctrl+Shift+R) and verify manually."
