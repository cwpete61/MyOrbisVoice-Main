#!/usr/bin/env bash
# Configure the Keycloak `myorbis` realm + the portfolio OIDC client. Idempotent
# (skips anything that already exists). Runs kcadm INSIDE the myorbis-id-keycloak
# container on box #1. Admin creds read from /opt/myorbis-id/.env.prod.
#
#   ./infrastructure/scripts/... (ssh alias contabo-voice -> box #1)
#   # optional test user for verification (password from env, never committed):
#   TEST_USER_PASSWORD=... ./setup-realm.sh
#
# Realm + client are PROD config. The optional test user is for internal
# verification only and MUST be removed before public exposure.
set -euo pipefail

HOST="${BOX1_SSH:-contabo-voice}"
TEST_PW="${TEST_USER_PASSWORD:-}"

ssh "$HOST" 'bash -s' "$TEST_PW" <<'REMOTE'
set -uo pipefail
TEST_PW="$1"
ADMIN=$(grep '^KC_BOOTSTRAP_ADMIN_USERNAME=' /opt/myorbis-id/.env.prod | cut -d= -f2)
ADMINPW=$(grep '^KC_BOOTSTRAP_ADMIN_PASSWORD=' /opt/myorbis-id/.env.prod | cut -d= -f2)
KC="docker exec myorbis-id-keycloak /opt/keycloak/bin/kcadm.sh"

$KC config credentials --server http://localhost:8080 --realm master --user "$ADMIN" --password "$ADMINPW" >/dev/null

# realm
if $KC get realms/myorbis >/dev/null 2>&1; then
  echo "realm myorbis: exists"
else
  $KC create realms -s realm=myorbis -s enabled=true >/dev/null && echo "realm myorbis: created"
fi

# public client for product frontends (auth-code + PKCE; direct grants for tests)
if [ -n "$($KC get clients -r myorbis -q clientId=myorbis-apps --fields id --format csv 2>/dev/null | tr -d '"')" ]; then
  echo "client myorbis-apps: exists"
else
  $KC create clients -r myorbis \
    -s clientId=myorbis-apps -s enabled=true -s publicClient=true \
    -s standardFlowEnabled=true -s directAccessGrantsEnabled=true \
    -s 'redirectUris=["*"]' -s 'webOrigins=["*"]' \
    -s 'attributes={"pkce.code.challenge.method":"S256"}' >/dev/null && echo "client myorbis-apps: created"
fi

# optional verification user
if [ -n "$TEST_PW" ]; then
  if [ -z "$($KC get users -r myorbis -q username=testuser --fields id --format csv 2>/dev/null | tr -d '"')" ]; then
    $KC create users -r myorbis -s username=testuser -s email=test@myorbis.test \
      -s enabled=true -s emailVerified=true -s firstName=Test -s lastName=User >/dev/null
    echo "user testuser: created"
  fi
  $KC set-password -r myorbis --username testuser --new-password "$TEST_PW" >/dev/null && echo "user testuser: password set"
fi

echo "REALM_SETUP_COMPLETE"
REMOTE
