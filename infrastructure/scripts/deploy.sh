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
ok "Prisma client pushed to api + gateway containers (commit happens in step_api/step_gateway)"

# ── 2b. Sync extra node_modules that may not be in the container image ────────
log "Syncing extra node_modules to server..."
NODEMAILER_LOCAL="$REPO_ROOT/node_modules/.pnpm/nodemailer@8.0.7/node_modules/nodemailer"
if [[ -d "$NODEMAILER_LOCAL" ]]; then
  rsync -az "$NODEMAILER_LOCAL/" "$SERVER:$REMOTE/extra_modules/nodemailer/"
  ssh "$SERVER" "
    docker exec myorbisvoice-api   mkdir -p /app/node_modules/nodemailer
    docker cp $REMOTE/extra_modules/nodemailer/. myorbisvoice-api:/app/node_modules/nodemailer/
    docker exec myorbisvoice-gateway mkdir -p /app/node_modules/nodemailer
    docker cp $REMOTE/extra_modules/nodemailer/. myorbisvoice-gateway:/app/node_modules/nodemailer/
  "
  ok "nodemailer synced to api + gateway containers"
fi

# ── 3. Service steps ───────────────────────────────────────────────────────
step_api() {
  log "API — build → sync → inject → commit-to-image → restart..."
  pnpm --filter @voiceautomation/api build 2>&1 | grep -E "error TS|^>" || true
  rsync -az --delete "$REPO_ROOT/apps/api/dist/" "$SERVER:$REMOTE/apps/api/dist/"
  rsync -az "$REPO_ROOT/prisma/schema.prisma" "$SERVER:$REMOTE/prisma/schema.prisma"
  ssh "$SERVER" "docker cp $REMOTE/apps/api/dist/. myorbisvoice-api:/app/apps/api/dist/ && docker cp $REMOTE/prisma/schema.prisma myorbisvoice-api:/app/prisma/schema.prisma"
  # CRITICAL: commit the running container back into the image so force-recreate doesn't revert code.
  # Without this, any subsequent `docker compose up --force-recreate` (e.g. after env changes) reverts
  # to the original image and loses everything we just injected via docker cp.
  ssh "$SERVER" "docker commit myorbisvoice-api myorbisvoice-api:latest" >/dev/null && ok "Image updated"
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
  log "Gateway — build → sync → inject → commit-to-image → restart..."
  pnpm --filter @voiceautomation/voice-gateway build 2>&1 | grep -E "error TS|^>" || true
  rsync -az --delete "$REPO_ROOT/apps/voice-gateway/dist/" "$SERVER:$REMOTE/apps/voice-gateway/dist/"
  ssh "$SERVER" "docker cp $REMOTE/apps/voice-gateway/dist/. myorbisvoice-gateway:/app/apps/voice-gateway/dist/"
  ssh "$SERVER" "docker commit myorbisvoice-gateway myorbisvoice-gateway:latest" >/dev/null && ok "Image updated"
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
  log "Web — build → sync → WIPE stale chunks → inject → commit-to-image → restart..."
  # CRITICAL: catch real build errors. The grep filter has missed "Failed to compile." in the past.
  WEB_BUILD_OUT=$(pnpm --filter @voiceautomation/web build 2>&1)
  if echo "$WEB_BUILD_OUT" | grep -qE "Failed to compile|error TS"; then
    echo "$WEB_BUILD_OUT" | tail -30
    fail "Web build failed — fix TypeScript errors before deploying"
  fi
  rsync -az --delete "$REPO_ROOT/apps/web/.next/" "$SERVER:$REMOTE/apps/web/.next/"
  # CRITICAL: wipe stale static chunks before injecting — old chunk hashes cause client crashes
  ssh "$SERVER" "docker exec myorbisvoice-web sh -c 'rm -rf /app/apps/web/.next/static'"
  ssh "$SERVER" "docker cp $REMOTE/apps/web/.next/. myorbisvoice-web:/app/apps/web/.next/"
  # Commit the cp'd state AND fix the image's CMD (the original myorbisvoice-web:latest had `tail -f /dev/null` baked in
  # as a placeholder — we override via compose's `command:` directive but if anyone removes that override,
  # web silently won't start. Bake the correct CMD into the image so it's self-sufficient).
  ssh "$SERVER" "docker commit --change='CMD [\"pnpm\", \"--filter\", \"@voiceautomation/web\", \"start\"]' myorbisvoice-web myorbisvoice-web:latest" >/dev/null && ok "Image updated (incl. CMD fix)"
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
