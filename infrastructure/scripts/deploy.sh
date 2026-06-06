#!/usr/bin/env bash
# deploy.sh — atomic build → sync → inject → verify
# Usage: ./infrastructure/scripts/deploy.sh [api|web|gateway|leadengine|all] "reason"
set -euo pipefail

# ── Concurrency guard ───────────────────────────────────────────────────────
# Prevents two simultaneous deploys (e.g. from two Claude windows / worktrees)
# from racing on docker cp into the same prod containers. Non-blocking: second
# invoker exits immediately with a clear message instead of waiting.
# Released automatically when the script ends (OS closes fd 200).
LOCK_FILE=/tmp/myorbisvoice-deploy.lock
PID_FILE=/tmp/myorbisvoice-deploy.pid
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "✗ Another deploy is already running (pid $(cat "$PID_FILE" 2>/dev/null || echo unknown))."
  echo "  Wait for it to finish, or 'rm $LOCK_FILE' if you know it's stale."
  exit 1
fi
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

# ── Branch gate ─────────────────────────────────────────────────────────────
# Refuses to deploy from anything except master. Prevents the "two windows
# open, forgot which branch this worktree is on, accidentally shipped a
# half-done feature" failure mode. To deploy a feature branch intentionally,
# merge it to master first, then run from a master worktree.
# Override with DEPLOY_ALLOW_NONMASTER=1 for emergencies (cherry-pick fixes,
# bisects, hotfixes from a clean tag, etc.) — surfaces in the log so it's
# obvious what happened later.
CURRENT_BRANCH="$(git -C "$(cd "$(dirname "$0")/../.." && pwd)" rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "master" && "${DEPLOY_ALLOW_NONMASTER:-0}" != "1" ]]; then
  echo "✗ Refusing to deploy from branch '$CURRENT_BRANCH'."
  echo "  Merge to master first, or set DEPLOY_ALLOW_NONMASTER=1 to override (emergencies only)."
  exit 1
fi
if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "⚠  DEPLOY_ALLOW_NONMASTER=1 set — deploying from '$CURRENT_BRANCH'. Recorded in audit log."
fi

SERVER="root@147.93.183.4"
REMOTE="/opt/myorbisvoice"
TARGET="${1:-all}"
REASON="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRISMA_CLIENT="$REPO_ROOT/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client"
STAMP="$(date '+%Y%m%d_%H%M%S')"

if [[ -z "$REASON" ]]; then
  echo "Usage: $0 [api|web|gateway|leadengine|all] \"reason for this deploy\""
  exit 1
fi

log()  { echo ""; echo "── $*"; }
ok()   { echo "   ✓ $*"; }
fail() { echo "   ✗ $*"; exit 1; }

# SSH that can't wedge: keepalive drops a dead peer within ~60s, and a hard
# timeout caps the call. (2026-05-22: a `docker commit` ssh completed the commit
# on the box but never returned for 30+ min, stalling a deploy mid-restart and
# degrading prod web. Keepalive + timeout prevent the indefinite wedge.)
ssh_t() { timeout "${1}" ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4 "${@:2}"; }

# Commit a container to :latest. If the ssh wedges/times out, verify the image
# was actually committed in the last few minutes before failing — the commit
# itself usually finishes even when the ssh transport hangs afterward.
commit_image() {  # $1=container  $2..=extra `docker commit` args
  local container="$1"; shift
  if ssh_t 600 "$SERVER" "docker commit $* $container ${container}:latest" >/dev/null 2>&1; then
    return 0
  fi
  local created epoch now
  created=$(ssh_t 30 "$SERVER" "docker inspect -f '{{.Created}}' ${container}:latest" 2>/dev/null || true)
  epoch=$(date -d "$created" +%s 2>/dev/null || echo 0)
  now=$(date +%s)
  if [[ "$epoch" -gt 0 && $((now - epoch)) -lt 600 ]]; then
    ok "commit ssh hung but image ${container}:latest was committed ($((now - epoch))s ago) — continuing"
    return 0
  fi
  fail "docker commit of $container failed and image is not fresh — investigate the box"
}

# Poll a container's HTTP health endpoint until it answers, instead of grepping
# the last few log lines (which a chatty worker can push the startup line past —
# the false-negative that aborted the 2026-05-22 V2.1 deploy after the API was
# actually healthy). Retries 20× over ~40s.
wait_http_healthy() {  # $1=container  $2=port  $3=path(default /health)
  local container="$1" port="$2" path="${3:-/health}" i
  for i in $(seq 1 20); do
    if ssh_t 25 "$SERVER" "docker exec $container node -e 'fetch(\"http://127.0.0.1:${port}${path}\").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

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

# Build workspace packages (types, shared) and ship their dist into the node
# containers. The api/gateway resolve `@voiceautomation/types` at RUNTIME via a
# symlink to /app/packages/<pkg>/dist — `ensure_deps`' `pnpm install` relinks but
# never refreshes that dist, so a new export (e.g. the GMB catalog, 2026-05-22)
# would be missing in prod and crash the container on startup. (Web is exempt:
# Next `transpilePackages` inlines these into .next at build time.)
sync_workspace_packages() {
  log "Building + shipping workspace packages (types, shared)..."
  pnpm --filter @voiceautomation/types build  2>&1 | grep -E "error TS" && fail "types build failed" || true
  pnpm --filter @voiceautomation/shared build 2>&1 | grep -E "error TS" && fail "shared build failed" || true
  for pkg in types shared; do
    [ -d "$REPO_ROOT/packages/$pkg/dist" ] || continue
    rsync -az "$REPO_ROOT/packages/$pkg/dist/" "$SERVER:$REMOTE/packages/$pkg/dist/"
    for c in myorbisvoice-api myorbisvoice-gateway; do
      ssh_t 60 "$SERVER" "docker exec $c sh -c 'mkdir -p /app/packages/$pkg/dist' && docker cp $REMOTE/packages/$pkg/dist/. $c:/app/packages/$pkg/dist/" >/dev/null 2>&1 || true
    done
  done
  ok "Workspace packages shipped to api + gateway"
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

# Ship fresh workspace-package dist (types/shared) before the per-target steps,
# so api/gateway runtime has current exports before they restart.
sync_workspace_packages

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

  # Phase E.11 — the partner-page publisher (apps/api/src/services/
  # partner-page-publisher.service.ts) reads templates from
  # /app/myorbisresults.com/p/sample/ + /app/myorbisresults.com/es/p/sample/
  # at runtime. Sync them so auto-regen-on-profile-save can actually find
  # them — without this the publisher silently logs "template missing" on
  # every save.
  rsync -az --delete \
    --include='/p/' --include='/p/sample/' --include='/p/sample/**' \
    --include='/es/' --include='/es/p/' --include='/es/p/sample/' --include='/es/p/sample/**' \
    --exclude='*' \
    "$REPO_ROOT/myorbisresults.com/" "$SERVER:$REMOTE/myorbisresults.com/"
  ssh "$SERVER" "docker exec myorbisvoice-api mkdir -p /app/myorbisresults.com/p/sample /app/myorbisresults.com/es/p/sample && docker cp $REMOTE/myorbisresults.com/p/sample/. myorbisvoice-api:/app/myorbisresults.com/p/sample/ && docker cp $REMOTE/myorbisresults.com/es/p/sample/. myorbisvoice-api:/app/myorbisresults.com/es/p/sample/" || true
  # CRITICAL: commit the running container back into the image so force-recreate doesn't revert code.
  # Without this, any subsequent `docker compose up --force-recreate` (e.g. after env changes) reverts
  # to the original image and loses everything we just injected via docker cp.
  commit_image myorbisvoice-api && ok "Image updated"
  ssh_t 90 "$SERVER" "docker restart myorbisvoice-api"
  # Verify API is actually serving (health endpoint, not a log-tail grep).
  if wait_http_healthy myorbisvoice-api 4000 /health; then
    ok "API healthy"
  else
    fail "API did not become healthy after restart:\n$(ssh "$SERVER" "docker logs myorbisvoice-api --tail=30 2>&1")"
  fi
  # Check for stale-Prisma signatures only — NOT any "undefined" error, which
  # also matches ordinary application bugs (a PDF render throwing on a missing
  # field once tripped this and aborted the deploy though the API was healthy).
  RESULT=$(ssh "$SERVER" "docker logs myorbisvoice-api --tail=40 2>&1")
  if echo "$RESULT" | grep -qE "PrismaClient|clientModules|Cannot read properties of undefined \(reading '(findMany|findUnique|findFirst|create|update|delete|upsert|count)'\)"; then
    fail "Prisma client stale in API container — re-run deploy or push Prisma client manually"
  fi
}

step_gateway() {
  log "Gateway — build → sync → inject → commit-to-image → restart..."
  pnpm --filter @voiceautomation/voice-gateway build 2>&1 | grep -E "error TS|^>" || true
  ensure_deps myorbisvoice-gateway apps/voice-gateway
  rsync -az --delete "$REPO_ROOT/apps/voice-gateway/dist/" "$SERVER:$REMOTE/apps/voice-gateway/dist/"
  ssh "$SERVER" "docker cp $REMOTE/apps/voice-gateway/dist/. myorbisvoice-gateway:/app/apps/voice-gateway/dist/"
  # Widget JS is a STATIC file served by the gateway (not compiled into dist/).
  # Without this sync, changes to apps/voice-gateway/widget/*.js never reach
  # prod — a real bug we hit on 2026-05-12 when the phone-icon + dial-intro
  # widget changes deployed clean but the prod-served JS was still the older
  # cached copy. Sync the widget folder alongside dist/ so widget edits actually ship.
  rsync -az --delete "$REPO_ROOT/apps/voice-gateway/widget/" "$SERVER:$REMOTE/apps/voice-gateway/widget/"
  ssh "$SERVER" "docker cp $REMOTE/apps/voice-gateway/widget/. myorbisvoice-gateway:/app/apps/voice-gateway/widget/"
  commit_image myorbisvoice-gateway && ok "Image updated"
  ssh_t 90 "$SERVER" "docker restart myorbisvoice-gateway"
  if wait_http_healthy myorbisvoice-gateway 5000 /health; then
    ok "Gateway healthy"
  else
    fail "Gateway did not become healthy after restart:\n$(ssh "$SERVER" "docker logs myorbisvoice-gateway --tail=30 2>&1")"
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
  # public/ contains static assets served at the root path (sw.js, favicon,
  # help-screenshots/, etc.). Next.js serves these from /app/apps/web/public/
  # — they aren't part of the .next/ build output, so we have to sync them
  # separately.
  rsync -az --delete "$REPO_ROOT/apps/web/public/" "$SERVER:$REMOTE/apps/web/public/"
  # CRITICAL: wipe the FULL .next/ on the container before injecting (not just
  # static/). Two prod incidents on 2026-05-09 traced back to partial sync:
  # (1) runtime _buildManifest.js had no chunk references because new static
  # was injected over an old server/ — the on-disk chunks existed but were
  # invisible to the runtime; (2) `docker cp .next/. container:.next/` glob
  # silently dropped page.js files for the root route, surfacing as a 500 on
  # `/`. Both fixed by full nuke + bit-for-bit tar-pipe injection. Don't
  # regress to partial-wipe + dot-glob cp without re-reading the postmortem
  # in CLAUDE.md "Known Deploy Pitfalls".
  ssh "$SERVER" "docker exec myorbisvoice-web rm -rf /app/apps/web/.next" || fail "wipe of .next/ on web container failed"
  tar -czf - -C "$REPO_ROOT/apps/web" .next | ssh "$SERVER" "docker exec -i myorbisvoice-web tar -xzf - -C /app/apps/web" \
    || fail "tar-pipe of .next/ to web container failed"
  ssh "$SERVER" "docker exec myorbisvoice-web mkdir -p /app/apps/web/public && docker cp $REMOTE/apps/web/public/. myorbisvoice-web:/app/apps/web/public/" \
    || fail "public/ sync to web container failed"
  # Sanity check: required files must exist after sync. Fail fast if they
  # don't — that way we never silently ship a half-broken web container
  # like 2026-05-09. Files chosen here are UNIVERSAL — Next.js produces
  # them on every build regardless of which routes the app defines, so the
  # check stays valid as the route tree evolves.
  #
  # The two specific failure modes we're guarding against:
  #   • Bug 1 (manifest corruption): runtime _buildManifest.js empty / out
  #     of sync with on-disk chunks, so the runtime can't find any chunks.
  #     Read BUILD_ID, then derive the path to that build's manifest.
  #   • Bug 2 (silent file drop): `docker cp .next/. container:.next/` glob
  #     dropping random server-side files. The _not-found/page.js bundle is
  #     always present on every build and was empirically affected by the
  #     same dot-glob bug.
  BUILD_ID=$(ssh "$SERVER" "docker exec myorbisvoice-web cat /app/apps/web/.next/BUILD_ID 2>/dev/null") \
    || fail "post-sync sanity: BUILD_ID missing on web container"
  if [[ -z "$BUILD_ID" ]]; then fail "post-sync sanity: BUILD_ID empty on web container"; fi
  for required in \
    "/app/apps/web/.next/server/app/_not-found/page.js" \
    "/app/apps/web/.next/server/app/_not-found/page_client-reference-manifest.js" \
    "/app/apps/web/.next/static/$BUILD_ID/_buildManifest.js"
  do
    ssh "$SERVER" "docker exec myorbisvoice-web test -f $required" \
      || fail "post-sync sanity: required file missing on web container: $required"
  done
  ok "Web .next/ + public/ injected (full wipe + tar-pipe + post-sync sanity)"
  # Commit the cp'd state AND fix the image's CMD (the original myorbisvoice-web:latest had `tail -f /dev/null` baked in
  # as a placeholder — we override via compose's `command:` directive but if anyone removes that override,
  # web silently won't start. Bake the correct CMD into the image so it's self-sufficient).
  commit_image myorbisvoice-web "--change='CMD [\"pnpm\", \"--filter\", \"@voiceautomation/web\", \"start\"]'" && ok "Image updated (incl. CMD fix)"
  ssh_t 90 "$SERVER" "docker restart myorbisvoice-web"
  if wait_http_healthy myorbisvoice-web 3000 /partner-portal/login; then
    ok "Web ready"
  else
    fail "Web did not become healthy after restart:\n$(ssh "$SERVER" "docker logs myorbisvoice-web --tail=30 2>&1")"
  fi
}

# Lead engine — a Python service, so no TS build / dist-inject. Sync the
# source + compose file, then rebuild the image and recreate the container
# via `docker compose up --build`. The container reads SERPER_API_KEY +
# LEADENGINE_INTERNAL_TOKEN from .env.prod (set there once, out of band).
step_render() {
  log "Render service — sync source → rebuild image → recreate container..."
  rsync -az --exclude='node_modules' --exclude='dist' \
    "$REPO_ROOT/apps/render/" "$SERVER:$REMOTE/apps/render/"
  rsync -az "$REPO_ROOT/infrastructure/docker/docker-compose.prod.yml" \
    "$SERVER:$REMOTE/infrastructure/docker/docker-compose.prod.yml"
  ssh "$SERVER" "cd $REMOTE/infrastructure/docker && docker compose -f docker-compose.prod.yml up -d --build render 2>&1 | tail -8" \
    || fail "render compose up failed"
  sleep 8
  local HEALTH
  HEALTH=$(ssh "$SERVER" "docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' myorbisvoice-render 2>/dev/null")
  if [[ "$HEALTH" == "healthy" || "$HEALTH" == "starting" ]]; then
    ok "Render service deployed (health: $HEALTH)"
  else
    fail "Render service container unhealthy after deploy: $HEALTH"
  fi
}

step_leadengine() {
  log "Lead engine — sync source → rebuild image → recreate container..."
  rsync -az --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
    "$REPO_ROOT/apps/lead-engine/" "$SERVER:$REMOTE/apps/lead-engine/"
  rsync -az "$REPO_ROOT/infrastructure/docker/docker-compose.prod.yml" \
    "$SERVER:$REMOTE/infrastructure/docker/docker-compose.prod.yml"
  ssh "$SERVER" "cd $REMOTE/infrastructure/docker && docker compose -f docker-compose.prod.yml up -d --build lead-engine 2>&1 | tail -8" \
    || fail "lead-engine compose up failed"
  sleep 6
  local HEALTH
  HEALTH=$(ssh "$SERVER" "docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' myorbisvoice-leadengine 2>/dev/null")
  if [[ "$HEALTH" == "healthy" || "$HEALTH" == "starting" ]]; then
    ok "Lead engine deployed (health: $HEALTH)"
  else
    fail "Lead engine container unhealthy after deploy: $HEALTH"
  fi
}

# ── 4. Run selected targets ────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  MyOrbisVoice Deploy: $TARGET"
echo "║  Reason: $REASON"
echo "╚══════════════════════════════════════╝"

case "$TARGET" in
  api)        step_api ;;
  gateway)    step_gateway ;;
  web)        step_web ;;
  leadengine) step_leadengine ;;
  render)     step_render ;;
  all)
    step_api
    step_gateway
    step_web
    step_leadengine
    # render intentionally NOT in 'all' yet — heavyweight Chromium image;
    # deploy explicitly with `./deploy.sh render "<reason>"` after the
    # initial standup is verified.
    ;;
  *)
    echo "Unknown target: $TARGET. Use api|web|gateway|leadengine|render|all"
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

# ── 6b. Post-deploy api smoke (always-on, no creds required) ─────────────
# Hits prod's public API surface: health, plans, RBAC boundaries, full
# auth flow (signup → /me → entitlements → /tenants/current → admin-block).
# Browser-free (pure HTTP) so it doesn't need credentials in the env.
# Creates one disposable @orbisvoice.test tenant per run; cleanup handled
# by the admin /api/admin/test-tenants endpoint when run.
log "Post-deploy api smoke (12 tests, ~3 sec)..."
if E2E_API_URL=https://api.myorbisvoice.com pnpm --filter @voiceautomation/e2e test:api 2>&1 | tail -20; then
  ok "API smoke: all checks green"
else
  echo ""
  echo "  ⚠ API smoke detected a regression in the just-deployed API."
  echo "  ⚠ Review the failed tests above. The deploy already shipped — "
  echo "  ⚠ if any failure looks real, roll back via the procedure in CLAUDE.md."
fi

# Clean up the disposable @orbisvoice.test tenant(s) the api smoke just created.
# The smoke signs up via the public API and has no admin creds to self-clean, so
# we soft-delete directly (deploy already has box access). Without this, a junk
# tenant + user accumulates on every deploy (and would otherwise sync to the Hub).
ssh "$SERVER" "docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation -c \"UPDATE \\\"Tenant\\\" SET \\\"deletedAt\\\"=now() WHERE \\\"deletedAt\\\" IS NULL AND \\\"registrationEmail\\\" LIKE '%@orbisvoice.test'; UPDATE \\\"User\\\" SET status='SUSPENDED' WHERE status='ACTIVE' AND email LIKE '%@orbisvoice.test';\"" >/dev/null 2>&1 \
  && ok "Smoke cleanup: @orbisvoice.test test tenants soft-deleted" \
  || echo "  ⚠ smoke cleanup skipped (non-fatal)"

# ── 6c. Browser smoke (opt-in via E2E_ADMIN_LOGIN_EMAIL) ──────────────────
# Heavier customer-journey flow (signup → onboarding → channels) requiring
# admin creds for cleanup. Skipped without creds. Set
# E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD in your shell or .envrc
# to enable.
if [[ -n "${E2E_ADMIN_LOGIN_EMAIL:-}" && -n "${E2E_ADMIN_LOGIN_PASSWORD:-}" ]]; then
  log "Browser smoke test (customer signup → onboarding flow)..."
  if pnpm smoke-test 2>&1 | tail -15; then
    ok "Browser smoke test: all checks green"
  else
    echo ""
    echo "  ⚠ Browser smoke detected a regression in the customer signup flow."
    echo "  ⚠ Review screenshots saved to /tmp/smoke-test-fail-*.png"
  fi
else
  echo "   ⓘ Browser smoke skipped — set E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD to enable"
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
