#!/usr/bin/env bash
# Deploy the MyOrbis Account Hub identity provider (Keycloak) as an ISOLATED
# stack on box #1 (147.93.183.4). Own DB, own network, own volume — shares
# nothing with the MyOrbisVoice stack on the same host.
#
# Internal-first: Keycloak binds to 127.0.0.1 only. Public exposure (hostname +
# TLS via the shared Caddy edge) is a separate, deliberate step.
#
# Idempotent. Generates secrets into /opt/myorbis-id/.env.prod (600) on first
# run and never overwrites them. Run from a machine with key access:
#   ./infrastructure/scripts/deploy-keycloak-box1.sh
# (uses ssh alias `contabo-voice` -> root@147.93.183.4)
#
# First executed + verified 2026-06-05: Keycloak 26.4 + Postgres 16,
# /health/ready UP, admin console 302 -> /admin/, network myorbis_id_net only.
set -euo pipefail

HOST="${BOX1_SSH:-contabo-voice}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_DIR="/opt/myorbis-id"

echo "== ship compose =="
ssh "$HOST" "mkdir -p $REMOTE_DIR"
rsync -az "$REPO_ROOT/infrastructure/myorbis-id/docker-compose.yml" "$HOST:$REMOTE_DIR/docker-compose.yml"

ssh "$HOST" 'bash -s' "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
DIR="$1"; cd "$DIR"

if [ ! -f .env.prod ]; then
  echo "== generate secrets (.env.prod, 600) =="
  umask 077
  cat > .env.prod <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -hex 24)
EOF
  chmod 600 .env.prod
  echo "secrets written (hidden)"
else
  echo ".env.prod exists — keeping"
fi

echo "== up =="
docker compose --env-file .env.prod up -d

echo "== wait for ready =="
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:9000/health/ready 2>/dev/null | grep -q '"status": "UP"'; then
    echo "READY after ~$((i*5))s"; break
  fi
  sleep 5
done

echo "== verify =="
docker ps --filter name=myorbis-id --format '{{.Names}} | {{.Status}}'
curl -s -o /dev/null -w "admin console / -> %{http_code}\n" http://127.0.0.1:8080/
echo "KEYCLOAK_DEPLOY_COMPLETE"
REMOTE
