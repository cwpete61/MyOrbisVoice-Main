#!/usr/bin/env bash
# Provision Contabo box #2 (109.123.249.34) to a deploy-ready baseline for the
# Local family (MyOrbisLocal + MyOrbisReviews).
#
# Installs: Docker Engine + Compose plugin, base /opt layout, and a shared Caddy
# edge with per-product conf.d/ fragments. Does NOT deploy any product.
#
# Greenfield only — box #2 is separate from the live MyOrbisVoice box #1; this
# script never touches Voice.
#
# Idempotent: safe to re-run. Run from a machine with key access to box #2:
#   ./infrastructure/scripts/provision-box2.sh
# (uses the `contabo-local` ssh alias → root@109.123.249.34, key id_ed25519_box2)
#
# First executed + verified 2026-06-05: Ubuntu 24.04.4, Docker 29.5.3,
# Compose v5.1.4, edge-caddy healthy on :80/:443.
set -euo pipefail

HOST="${BOX2_SSH:-contabo-local}"

ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "== box =="; hostname; . /etc/os-release; echo "$PRETTY_NAME"

echo "== prereqs =="
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null

echo "== Docker Engine + Compose =="
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  [ -f /etc/apt/keyrings/docker.asc ] || {
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  }
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null 2>&1
fi
docker --version; docker compose version

echo "== base directory layout =="
mkdir -p /opt/edge/conf.d /opt/myorbislocal /opt/myorbisreviews
touch /opt/edge/conf.d/.gitkeep

echo "== shared Caddy edge (only written if absent — preserves manual edits) =="
if [ ! -f /opt/edge/Caddyfile ]; then
  cat > /opt/edge/Caddyfile <<'CADDY'
{
	email admin@myorbisresults.com
}

# Per-product site blocks live here, one fragment per product.
import /etc/caddy/conf.d/*.caddy

# Baseline HTTP health for unmatched hosts. No ACME while conf.d is empty.
:80 {
	respond /health "ok" 200
	respond "edge up" 200
}
CADDY
fi

if [ ! -f /opt/edge/docker-compose.yml ]; then
  cat > /opt/edge/docker-compose.yml <<'COMPOSE'
name: edge
services:
  caddy:
    image: caddy:2
    container_name: edge-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./conf.d:/etc/caddy/conf.d:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - edge_net
networks:
  edge_net:
    name: edge_net
volumes:
  caddy_data:
  caddy_config:
COMPOSE
fi

echo "== bring edge up =="
cd /opt/edge && docker compose up -d

echo "== verify =="
sleep 2
docker run --rm hello-world >/dev/null 2>&1 && echo "docker run: OK"
docker exec edge-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 && echo "caddy config: valid"
curl -fsS http://localhost/health >/dev/null && echo "edge /health: OK"
echo "PROVISION_COMPLETE"
REMOTE
