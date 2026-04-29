#!/usr/bin/env bash
# deploy.sh — build locally, push to server, restart containers
# Usage: ./infrastructure/scripts/deploy.sh [api|web|gateway|all]
set -euo pipefail

SERVER="root@147.93.183.4"
REMOTE="/opt/myorbisvoice"
TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$REPO_ROOT"

log() { echo ""; echo "── $*"; }

# ── 1. Build locally ──────────────────────────────────────────────────────────
build_api() {
  log "Building API..."
  pnpm --filter @voiceautomation/api build
}

build_web() {
  log "Building web..."
  pnpm --filter @voiceautomation/web build
}

build_gateway() {
  log "Building voice-gateway..."
  pnpm --filter @voiceautomation/voice-gateway build 2>/dev/null || true
}

# ── 2. Sync source + build artifacts to server ───────────────────────────────
sync_prisma() {
  log "Syncing Prisma schema..."
  rsync -az prisma/schema.prisma "$SERVER:$REMOTE/prisma/schema.prisma"
  rsync -az schema.prisma         "$SERVER:$REMOTE/schema.prisma"
}

sync_api() {
  log "Syncing API source..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    apps/api/src/ "$SERVER:$REMOTE/apps/api/src/"
  rsync -az apps/api/package.json "$SERVER:$REMOTE/apps/api/package.json"
}

sync_web() {
  log "Syncing web source..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    apps/web/src/ "$SERVER:$REMOTE/apps/web/src/"
  rsync -az apps/web/package.json "$SERVER:$REMOTE/apps/web/package.json"
}

sync_packages() {
  log "Syncing shared packages..."
  rsync -az --delete \
    --exclude='node_modules' \
    packages/ "$SERVER:$REMOTE/packages/"
}

# ── 3. Build Docker image on server ──────────────────────────────────────────
remote_build_api() {
  log "Building API Docker image on server..."
  ssh "$SERVER" "cd $REMOTE && docker build --no-cache -f apps/api/Dockerfile -t myorbisvoice-api:latest . 2>&1 | tail -5"
}

remote_build_web() {
  log "Building web Docker image on server..."
  ssh "$SERVER" "cd $REMOTE && docker build --no-cache -f apps/web/Dockerfile -t myorbisvoice-web:latest . 2>&1 | tail -5"
}

remote_build_gateway() {
  log "Building gateway Docker image on server..."
  ssh "$SERVER" "cd $REMOTE && docker build --no-cache -f apps/voice-gateway/Dockerfile -t myorbisvoice-gateway:latest . 2>&1 | tail -5" || true
}

# ── 4. Recreate container with new image ─────────────────────────────────────
recreate_api() {
  log "Restarting API container..."
  ssh "$SERVER" "
    docker stop myorbisvoice-api 2>/dev/null || true
    docker rm   myorbisvoice-api 2>/dev/null || true
    $(docker_run_api_cmd)
    sleep 4
    docker logs myorbisvoice-api --tail 4
  "
}

recreate_web() {
  log "Restarting web container..."
  ssh "$SERVER" "
    docker stop myorbisvoice-web 2>/dev/null || true
    docker rm   myorbisvoice-web 2>/dev/null || true
    $(docker_run_web_cmd)
    sleep 4
    docker logs myorbisvoice-web --tail 4
  "
}

recreate_gateway() {
  log "Restarting gateway container..."
  ssh "$SERVER" "docker restart myorbisvoice-gateway && sleep 3 && docker logs myorbisvoice-gateway --tail 4" || true
}

docker_run_api_cmd() {
  # Read env from running container if it exists, otherwise use stored env file
  cat <<'EOF'
docker run -d \
  --name myorbisvoice-api \
  --restart unless-stopped \
  --network myorbisvoice_internal \
  --network bps_zf_caddy_app_edge \
  --env-file /opt/myorbisvoice/.env.api \
  myorbisvoice-api:latest
EOF
}

docker_run_web_cmd() {
  cat <<'EOF'
docker run -d \
  --name myorbisvoice-web \
  --restart unless-stopped \
  --network myorbisvoice_internal \
  --network bps_zf_caddy_app_edge \
  --env-file /opt/myorbisvoice/.env.web \
  myorbisvoice-web:latest
EOF
}

# ── Write env files on server if they don't exist ────────────────────────────
ensure_env_files() {
  log "Checking env files on server..."
  ssh "$SERVER" "
    if [ ! -f /opt/myorbisvoice/.env.api ]; then
      docker inspect myorbisvoice-api --format '{{range .Config.Env}}{{.}}\n{{end}}' 2>/dev/null \
        | grep -v '^PATH=\|^NODE_VERSION=\|^YARN_VERSION=' \
        > /opt/myorbisvoice/.env.api || true
      echo 'Created .env.api from running container'
    fi
    if [ ! -f /opt/myorbisvoice/.env.web ]; then
      docker inspect myorbisvoice-web --format '{{range .Config.Env}}{{.}}\n{{end}}' 2>/dev/null \
        | grep -v '^PATH=\|^NODE_VERSION=\|^YARN_VERSION=' \
        > /opt/myorbisvoice/.env.web || true
      echo 'Created .env.web from running container'
    fi
  "
}

# ── Clean stale server artifacts ─────────────────────────────────────────────
clean_server() {
  log "Cleaning stale artifacts on server..."
  ssh "$SERVER" "
    set -e

    echo '→ Removing stale source dirs (will be replaced by rsync)...'
    rm -rf $REMOTE/apps/api/src
    rm -rf $REMOTE/apps/web/src
    rm -rf $REMOTE/packages

    echo '→ Removing old Docker build cache...'
    docker builder prune -f

    echo '→ Removing dangling images...'
    docker image prune -f

    echo '→ Removing old myorbisvoice images (keeping :latest)...'
    docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
      | grep '^myorbisvoice-' \
      | grep -v ':latest' \
      | awk '{print \$2}' \
      | xargs -r docker rmi -f || true

    echo 'Clean done.'
  "
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo "=== MyOrbisVoice Deploy: $TARGET ==="

case "$TARGET" in
  clean)
    clean_server
    ;;
  api)
    ensure_env_files
    sync_packages
    sync_prisma
    build_api
    sync_api
    remote_build_api
    recreate_api
    ;;
  web)
    ensure_env_files
    sync_packages
    sync_prisma
    build_web
    sync_web
    remote_build_web
    recreate_web
    ;;
  gateway)
    ensure_env_files
    build_gateway
    remote_build_gateway
    recreate_gateway
    ;;
  all)
    ensure_env_files
    sync_packages
    sync_prisma
    build_api
    build_web
    sync_api
    sync_web
    remote_build_api
    remote_build_web
    recreate_api
    recreate_web
    ;;
  *)
    echo "Usage: $0 [api|web|gateway|all|clean]"
    exit 1
    ;;
esac

echo ""
echo "=== Done ==="
echo "  App: https://app.myorbisvoice.com"
echo "  API: https://api.myorbisvoice.com/health"
