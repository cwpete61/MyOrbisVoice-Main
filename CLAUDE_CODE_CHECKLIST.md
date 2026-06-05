# Claude Code Execution Checklist

> Previous step (box #2 baseline provisioning) — DONE, see commit `ced8f9c`
> + `infrastructure/scripts/provision-box2.sh`.

## Objective
Deploy the **MyOrbis Account Hub identity provider (Keycloak)** as an ISOLATED
stack on box #1 (`147.93.183.4`) — own DB, own network, own volume, sharing
nothing with the live MyOrbisVoice stack. **Internal-first**: bound to
127.0.0.1; public exposure (hostname + TLS via shared Caddy) deferred to a
deliberate later step.

## Phases
- [x] Phase 1 — Recon box #1 (access, headroom, free local port, isolation check)
- [x] Phase 2 — Lock Keycloak image tag (26.4)
- [x] Phase 3 — Deploy myorbis-id stack (Keycloak + own Postgres, secrets, compose)
- [x] Phase 4 — Wait for ready + verify (health UP, admin console, isolation)
- [x] Phase 5 — Codify (compose + .env.example + deploy-keycloak-box1.sh, idempotent)
- [x] Phase 6 — Commit (no secrets; branch, no push without approval)
- [ ] Phase 7 — PUBLIC EXPOSURE — BLOCKED on decisions (see below)

## Error Log
None — all executed phases passed first time.

## Completed Work
- **Recon:** box #1 19 GiB free; no existing keycloak/myorbis-id stack; port 8080
  free; only `/opt/myorbis-id` created (isolation respected).
- **Image:** locked `quay.io/keycloak/keycloak:26.4` (pull-verified).
- **Deploy:** stack `myorbis-id` — `myorbis-id-keycloak` (KC 26.4) +
  `myorbis-id-db` (postgres:16-alpine), network `myorbis_id_net`, volume `id_db`.
  Secrets generated into `/opt/myorbis-id/.env.prod` (600, hidden, never committed).
  Keycloak bound to `127.0.0.1:8080` (SSO/admin) + `127.0.0.1:9000` (health).
- **Verify:** `/health/ready` → `status UP`; both containers Up (db healthy);
  `GET /` → 302 → `/admin/`; keycloak on `myorbis_id_net` ONLY (not Voice's net).
- **Codify:** `infrastructure/myorbis-id/{docker-compose.yml,.env.example}` +
  `infrastructure/scripts/deploy-keycloak-box1.sh` (idempotent; re-run kept
  secrets, reused containers, ready in ~5s, `KEYCLOAK_DEPLOY_COMPLETE`).

## BLOCKED — Phase 7 (public exposure) needs decisions
Going public requires, in order:
1. **IdP hostname** — e.g. `auth.myorbisresults.com` / `id.myorbisresults.com`
   (product/branding decision; not chosen yet).
2. **DNS A record** → `147.93.183.4` for that hostname (manual in the DNS panel;
   myorbisresults.com is on Cloudflare).
3. **Shared Caddyfile edit** — box #1's public proxy is `bps_zf-caddy` with the
   FRAGILE shared Caddyfile holding BOTH bpszerofees AND myorbisvoice host blocks
   (CLAUDE.md hazard). Adding the IdP host block must preserve all existing blocks
   + back up first (`/opt/bps_zf/caddy/Caddyfile.before-<reason>.<date>`).
4. Set `KC_HOSTNAME: https://<idp-host>` + re-tighten hostname strictness.

Stop here until the hostname + DNS are decided.

## Result
Keycloak IdP is **live, healthy, isolated, internal-only** on box #1. Live
MyOrbisVoice untouched. Ready for realm/client config + (later) public exposure.
