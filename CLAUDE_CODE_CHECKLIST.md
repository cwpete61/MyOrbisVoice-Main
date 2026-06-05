# Claude Code Execution Checklist

> Done (see git): box #2 baseline · Keycloak IdP (public auth.) · Account Hub
> (foundation + box #1 + OIDC + Stripe→entitlement + public hub.) · MyOrbisReviews
> (box #2, consuming Hub cross-box) · Voice→Hub cutover PLAN.

## Objective
Build the Hub prerequisites for the Voice→Hub Phase 0 backfill: idempotent
admin upserts (tenant, entitlement, stripe-customer). Greenfield Hub code; no
Voice risk.

## Phases
- [x] Phase 1 — Add PUT upsert endpoints (tenant / entitlement / stripe-customer)
- [x] Phase 2 — Build + local verify (idempotent; param-conflict fix)
- [x] Phase 3 — Deploy to box #1 + verify on prod hub + commit

## Error Log
- **All PUTs 404 + stale 401:** Fastify rejects differing param names at the same
  path position (`:id` vs `:tenantId`); a stale local hub server on 4100 answered
  with old code. Fix: use `:id` consistently; `fuser -k 4100`. (Also: `pkill -f
  dist/server.js` self-killed the shell — removed.)

## Completed Work
- `PUT /v1/tenants/:id` (upsert tenant+profile), `PUT .../entitlements/:productCode`
  (upsert entitlement + ensure Product), `PUT .../stripe-customer` (upsert link).
  Service-token auth; 404 on missing tenant. MyOrbis-Hub `1f1aa81`.
- Verified local + box #1: idempotent PUT x2 → 200/200; entitlement (lc→UC) +
  stripe; aggregate reflects all three; missing-tenant 404. Prod probe cleaned.

## Result
Hub can now accept the Phase 0 backfill (idempotent writes). Next: the backfill
script (Voice read-only → Hub PUTs, dry-run first) — see docs/voice-hub-cutover-plan.md.
