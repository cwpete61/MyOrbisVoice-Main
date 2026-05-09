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

# Sync the three root workspace manifests to the prod host. Run once per
# deploy. Subsequent ensure_deps calls assume these are present.
sync_root_manifests() {
  rsync -az "$REPO_ROOT/package.json"        "$SERVER:$REMOTE/package.json"
  rsync -az "$REPO_ROOT/pnpm-lock.yaml"      "$SERVER:$REMOTE/pnpm-lock.yaml"
  rsync -az "$REPO_ROOT/pnpm-workspace.yaml" "$SERVER:$REMOTE/pnpm-workspace.yaml"
}

# Keep a container's node_modules in sync with the current package.json by
# injecting fresh manifests + running `pnpm install --prod` inside the container.
# Idempotent: when nothing changed, pnpm exits in <1s. When new deps were added
# (e.g. a recent `pnpm add foo` in apps/api), they install before the dist sync.
# This is the post-incident fix for the pdfkit outage of 2026-05-04 — previously
# the script only synced a hardcoded list of "extra modules" (nodemailer), so any
# new dep silently broke the container on next restart.
ensure_deps() {
  local container="$1"   # e.g. myorbisvoice-api
  local app_dir="$2"     # e.g. apps/api

  log "Syncing manifests + ensuring deps for $container..."
  rsync -az "$REPO_ROOT/$app_dir/package.json" "$SERVER:$REMOTE/$app_dir/package.json"

  ssh "$SERVER" "
    docker cp $REMOTE/package.json        $container:/app/package.json
    docker cp $REMOTE/pnpm-lock.yaml      $container:/app/pnpm-lock.yaml
    docker cp $REMOTE/pnpm-workspace.yaml $container:/app/pnpm-workspace.yaml
    docker exec $container mkdir -p /app/$app_dir 2>/dev/null || true
    docker cp $REMOTE/$app_dir/package.json $container:/app/$app_dir/package.json
    docker exec -e NODE_ENV=production $container sh -c 'cd /app && pnpm install --prod 2>&1 | tail -5'
  " || fail "ensure_deps failed for $container — check pnpm output above"
  ok "Deps ensured for $container"
}

cd "$REPO_ROOT"

# ── 0. Pre-flight security audit ────────────────────────────────────────────
# Block the deploy if production dependencies have a CRITICAL CVE. This is the
# last line of defense — Dependabot + the weekly workflow should catch most
# advisories upstream, but a freshly-published CVE could land between scans.
# Override with SKIP_SECURITY_AUDIT=1 ./deploy.sh ... when the alternative is
# worse than the risk (rare; document in the deploy reason).
if [[ "${SKIP_SECURITY_AUDIT:-0}" == "1" ]]; then
  log "Pre-flight security audit — SKIPPED via SKIP_SECURITY_AUDIT=1"
else
  log "Pre-flight security audit (critical CVEs gate the deploy)..."
  set +e
  AUDIT_OUT=$(pnpm audit --prod --audit-level=critical 2>&1)
  AUDIT_EXIT=$?
  set -e
  if [[ "$AUDIT_EXIT" -ne 0 ]]; then
    echo "$AUDIT_OUT" | tail -30
    fail "Critical CVE in production dependencies — bump the affected package or re-run with SKIP_SECURITY_AUDIT=1 if intentional."
  fi
  ok "No critical CVEs in production deps"
fi

# ── 1. Pre-deploy snapshot ─────────────────────────────────────────────────
log "Pre-deploy snapshot..."
mkdir -p backups
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > "backups/db_${STAMP}_pre_${TARGET}.dump" 2>/dev/null && ok "Local DB snapshot: backups/db_${STAMP}_pre_${TARGET}.dump"
ssh "$SERVER" "docker exec myorbisvoice-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > /var/backups/va/db_${STAMP}_pre_${TARGET}.dump" && ok "Prod DB snapshot saved"

# ── 2. Prisma — regenerate client, sync schema, push to prod DB ─────────────
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

# Sync the schema file once (used by `prisma db push` below AND mirrored to the
# api container so /app/prisma/schema.prisma is current).
log "Syncing schema.prisma to prod and applying to DB..."
rsync -az "$REPO_ROOT/prisma/schema.prisma" "$SERVER:$REMOTE/prisma/schema.prisma"
ssh "$SERVER" "docker cp $REMOTE/prisma/schema.prisma myorbisvoice-api:/app/prisma/schema.prisma"

# Run `prisma db push` against the prod DB through the API container. The
# container already has DATABASE_URL pointing at prod, so no env juggling.
# `--accept-data-loss=false` (default) means destructive changes (dropped
# columns, type narrowing, etc.) ABORT the deploy instead of silently losing
# data — that's the safety we want. Additive changes (new column, new table,
# new enum value) apply cleanly.
PRISMA_BIN="/app/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js"
PUSH_OUT=$(ssh "$SERVER" "docker exec -w /app myorbisvoice-api node $PRISMA_BIN db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss=false 2>&1" || echo "PUSH_FAILED")
if echo "$PUSH_OUT" | grep -q "PUSH_FAILED\|destructive\|Could not\|Error:"; then
  echo "$PUSH_OUT"
  fail "prisma db push to prod failed — DESTRUCTIVE schema change detected, or DB unreachable. Investigate before retrying."
fi
if echo "$PUSH_OUT" | grep -qE "in sync|already in sync"; then
  ok "Prod DB schema already in sync"
else
  echo "$PUSH_OUT" | grep -E "Applied|migration|Adding|change" | head -10 | sed 's/^/   /'
  ok "Prod DB schema migrated"
fi

# ── 2b. Sync workspace manifests to the host once. Per-container dependency
#       installation happens inside step_api/step_gateway/step_web via the
#       ensure_deps helper.
log "Syncing workspace manifests to host..."
sync_root_manifests
ok "Manifests synced (package.json + pnpm-lock.yaml + pnpm-workspace.yaml)"

# ── 3. Service steps ───────────────────────────────────────────────────────
step_api() {
  log "API — build → sync → inject → commit-to-image → restart..."
  pnpm --filter @voiceautomation/api build 2>&1 | grep -E "error TS|^>" || true
  ensure_deps myorbisvoice-api apps/api
  rsync -az --delete "$REPO_ROOT/apps/api/dist/" "$SERVER:$REMOTE/apps/api/dist/"
  # schema.prisma already synced + db pushed in the global Prisma section above
  ssh "$SERVER" "docker cp $REMOTE/apps/api/dist/. myorbisvoice-api:/app/apps/api/dist/"
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
  ensure_deps myorbisvoice-gateway apps/voice-gateway
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
  ensure_deps myorbisvoice-web apps/web
  rsync -az --delete "$REPO_ROOT/apps/web/.next/" "$SERVER:$REMOTE/apps/web/.next/"
  # public/ contains static assets served at the root path (sw.js, favicon,
  # help-screenshots/, etc.). Next.js serves these from /app/apps/web/public/
  # — they aren't part of the .next/ build output, so we have to sync them
  # separately.
  rsync -az --delete "$REPO_ROOT/apps/web/public/" "$SERVER:$REMOTE/apps/web/public/"
  # CRITICAL: wipe stale static chunks before injecting — old chunk hashes cause client crashes
  ssh "$SERVER" "docker exec myorbisvoice-web sh -c 'rm -rf /app/apps/web/.next/static'"
  ssh "$SERVER" "docker cp $REMOTE/apps/web/.next/. myorbisvoice-web:/app/apps/web/.next/ && docker exec myorbisvoice-web mkdir -p /app/apps/web/public && docker cp $REMOTE/apps/web/public/. myorbisvoice-web:/app/apps/web/public/"
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

# ── 6. Pre-flight verification gate ────────────────────────────────────────
# Read-only check across every external integration + container health. If
# this fails, something deeper than a 200 from /health is wrong (Stripe key
# misconfigured, webhook secret missing, container crashed mid-boot, etc.)
# and a real customer would hit it before we noticed.
log "Pre-flight verification..."
if pnpm preflight 2>&1 | tail -20; then
  ok "Pre-flight: all checks green"
else
  echo ""
  echo "  ⚠ Pre-flight detected an issue. Review output above."
  echo "  ⚠ Deploy completed, but DO NOT open new customer signups until pre-flight is green."
  echo "  ⚠ Run \`pnpm preflight\` again to re-check after fixing."
fi

# ── 6b. Smoke test (opt-in via E2E_ADMIN_LOGIN_EMAIL) ─────────────────────
# If admin credentials are present in the environment, run the customer-
# journey smoke test (signup → onboarding → channels) and clean up the
# disposable tenant afterward. Without admin creds we skip — better to not
# run smoke than to run it and leak orphan @orbisvoice.test tenants every
# deploy. Set E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD in your
# shell or .envrc to enable.
if [[ -n "${E2E_ADMIN_LOGIN_EMAIL:-}" && -n "${E2E_ADMIN_LOGIN_PASSWORD:-}" ]]; then
  log "Smoke test (customer signup → onboarding flow)..."
  if pnpm smoke-test 2>&1 | tail -15; then
    ok "Smoke test: all checks green"
  else
    echo ""
    echo "  ⚠ Smoke test detected a regression in the customer signup flow."
    echo "  ⚠ Review screenshots saved to /tmp/smoke-test-fail-*.png"
  fi
else
  echo "   ⓘ Smoke test skipped — set E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD to enable"
fi

# ── 7. Post-deploy snapshot ────────────────────────────────────────────────
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
if [[ -z "${E2E_ADMIN_LOGIN_EMAIL:-}" ]]; then
  echo "  Optional: set E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD in your shell"
  echo "  to enable automatic smoke-testing on every deploy. Until then, run manually:"
  echo "      pnpm smoke-test"
  echo ""
fi
echo "  Next: hard-refresh the browser (Ctrl+Shift+R) and verify manually."
