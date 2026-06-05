# Claude Code Execution Checklist

> Done (see git): box #2 baseline · Keycloak IdP · Account Hub (foundation +
> box #1 deploy + OIDC + Stripe→entitlement) · MyOrbisReviews (box #2).

## Objective
Publicly expose the Account Hub (and IdP) so products on box #2 can reach the Hub
on box #1, then wire MyOrbisReviews to the live Hub. Hostnames:
`auth.myorbisresults.com` (Keycloak), `hub.myorbisresults.com` (Hub).

## Phases
- [x] Phase 1 — Read-only recon of the shared (fragile) Caddyfile on box #1
- [x] Phase 2 — Decide hostnames (auth. + hub.) + confirm DNS
- [x] Phase 3 — Expose HUB (guarded Caddy edit) — backup, append, validate, reload
- [x] Phase 4 — Verify no regression (both stacks) + hub public TLS/health
- [x] Phase 5 — Wire Reviews → public Hub + cross-box entitlement verify
- [ ] Phase 6 — Expose KEYCLOAK (auth.) — BLOCKED: auth. DNS record not present yet

## Error Log
None. Caddy edit validated before reload; backup taken first.

## Completed Work
- **Recon:** `bps_zf-caddy-1` owns 80/443; `/opt/bps_zf/caddy/Caddyfile` holds
  BOTH myorbisvoice + bpszerofees host blocks (the CLAUDE.md hazard); proxies by
  container name over shared docker nets.
- **DNS:** `hub.myorbisresults.com` → 147.93.183.4 (DNS-only/direct). `auth.` NOT
  yet present (both resolvers empty).
- **Hub exposure (guarded):** backed up Caddyfile →
  `Caddyfile.before-hub-exposure.2026-06-05`; appended a `hub.myorbisresults.com`
  block (`reverse_proxy myorbis-hub-api:4100`); connected `bps_zf-caddy-1` to
  `myorbis_hub_net`; `caddy validate` → valid; `caddy reload`. All existing host
  blocks preserved.
- **Verify:** api/app/gateway.myorbisvoice.com + app.bpszerofees.com all still
  serve with valid TLS (no regression); `https://hub.myorbisresults.com/health`
  → 200 (cert auto-issued).
- **Cross-box wiring:** set Reviews `.env.prod` `HUB_URL=https://hub.myorbisresults.com`
  + the Hub's real service token; recreated. Repo defaults updated (commit
  `MyOrbisReviews` `6faeb61`).
- **Cross-box verify:** entitled tenant (REVIEWS on box #1 Hub) → Reviews on
  box #2 → POST review-request **201** (was 503); non-entitled → 403. Test data
  cleaned both DBs.

## Result
The Account Hub is **publicly reachable** (`hub.myorbisresults.com`, service-token
+ OIDC protected) and **MyOrbisReviews on box #2 now consumes it live across
boxes.** Both pre-existing stacks (myorbisvoice, bpszerofees) verified intact.

## Remaining / next
- **Expose Keycloak (`auth.`)** — add the `auth.myorbisresults.com` DNS A record
  → 147.93.183.4, then the same guarded Caddy edit (`reverse_proxy
  myorbis-id-keycloak:8080`) + set Keycloak `KC_HOSTNAME=https://auth...` and
  finalize Hub `KC_ISSUER` (the issuer-finalization chain).
- Security follow-up: Hub is public with a static service token + OIDC; consider
  IP allowlist / mTLS later. Keycloak `testuser` still present — remove.
- Voice → Hub backfill (Phase 0), still pending/planned.
