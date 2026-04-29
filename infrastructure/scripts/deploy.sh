#!/usr/bin/env bash
set -euo pipefail

SERVER="root@147.93.183.4"
REMOTE_DIR="/opt/myorbisvoice"
COMPOSE_FILE="infrastructure/docker/docker-compose.prod.yml"
ENV_FILE="infrastructure/docker/.env.prod"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== MyOrbisVoice Production Deploy ==="

# 1. Build images locally
echo ">> Building Docker images..."
cd "$REPO_ROOT"
docker build -f apps/api/Dockerfile -t myorbisvoice-api:latest .
docker build -f apps/web/Dockerfile -t myorbisvoice-web:latest .

# 2. Save images to tarballs
echo ">> Saving images..."
docker save myorbisvoice-api:latest | gzip > /tmp/myorbisvoice-api.tar.gz
docker save myorbisvoice-web:latest | gzip > /tmp/myorbisvoice-web.tar.gz

# 3. Upload images and config to server
echo ">> Uploading to server..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
scp /tmp/myorbisvoice-api.tar.gz "$SERVER:/tmp/"
scp /tmp/myorbisvoice-web.tar.gz "$SERVER:/tmp/"
scp "$REPO_ROOT/$COMPOSE_FILE" "$SERVER:$REMOTE_DIR/docker-compose.prod.yml"

if [ -f "$REPO_ROOT/$ENV_FILE" ]; then
  scp "$REPO_ROOT/$ENV_FILE" "$SERVER:$REMOTE_DIR/.env.prod"
else
  echo "WARN: $ENV_FILE not found — ensure .env.prod exists on the server at $REMOTE_DIR/.env.prod"
fi

# 4. Load images and restart on server
echo ">> Loading images on server..."
ssh "$SERVER" "
  set -e
  cd $REMOTE_DIR

  docker load < /tmp/myorbisvoice-api.tar.gz
  docker load < /tmp/myorbisvoice-web.tar.gz
  rm -f /tmp/myorbisvoice-api.tar.gz /tmp/myorbisvoice-web.tar.gz

  echo '>> Stopping old containers...'
  docker compose -f docker-compose.prod.yml --env-file .env.prod down --remove-orphans || true

  echo '>> Starting stack...'
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

  echo '>> Running migrations...'
  docker exec myorbisvoice-api node -e \"
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', { stdio: 'inherit' });
  \" || docker exec myorbisvoice-api sh -c 'cd /app && npx prisma migrate deploy --schema=prisma/schema.prisma'

  echo '>> Seeding database...'
  docker exec myorbisvoice-api node -e \"
    const { execSync } = require('child_process');
    try {
      execSync('node apps/api/dist/seed.js', { stdio: 'inherit' });
    } catch(e) {
      console.log('Seed via dist failed, trying prisma db seed...');
    }
  \" 2>/dev/null || true

  echo '>> Stack status:'
  docker compose -f docker-compose.prod.yml ps
"

# 5. Update Caddyfile
echo ">> Updating Caddyfile..."
ssh "$SERVER" "
  CADDYFILE=/opt/bps_zf/caddy/Caddyfile

  # Add myorbisvoice blocks if not already present
  if ! grep -q 'app.myorbisvoice.com' \$CADDYFILE; then
    cat >> \$CADDYFILE << 'CADDY'

app.myorbisvoice.com {
    import common
    reverse_proxy myorbisvoice-web:3000
}

api.myorbisvoice.com {
    import common
    reverse_proxy myorbisvoice-api:4000
}
CADDY
    echo 'Added app + api domains to Caddyfile'
  else
    echo 'app.myorbisvoice.com already in Caddyfile'
  fi

  if ! grep -q 'n8n.myorbisvoice.com' \$CADDYFILE; then
    cat >> \$CADDYFILE << 'CADDY'

n8n.myorbisvoice.com {
    import common
    reverse_proxy myorbisvoice-n8n:5678
}
CADDY
    echo 'Added n8n domain to Caddyfile'
  else
    echo 'n8n.myorbisvoice.com already in Caddyfile'
  fi

  # Reload Caddy
  docker exec bps_zf-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  echo 'Caddy reloaded'
"

echo ""
echo "=== Deploy complete ==="
echo "  App: https://app.myorbisvoice.com"
echo "  API: https://api.myorbisvoice.com/health"
echo "  n8n: https://n8n.myorbisvoice.com"
