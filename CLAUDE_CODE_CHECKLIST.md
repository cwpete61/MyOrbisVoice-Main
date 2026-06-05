# Claude Code Execution Checklist

> Done (see git): box #2 baseline, Keycloak IdP, Account Hub (foundation + box #1
> deploy + OIDC + Stripe→entitlement sync). Repos: MyOrbis-Hub, MyOrbisReviews.

## Objective
Scaffold **MyOrbisReviews** (Local-family wedge) as its own repo
`~/Antigravity/MyOrbisReviews`, demonstrating the **Hub-consumer pattern** (read
entitlements from the Account Hub, gate features), with its own ops DB. Verify
the Hub integration locally; deploy to box #2 internal-first.

## Phases
- [x] Phase 1 — Repo + tooling
- [x] Phase 2 — Prisma (ReviewRequest, Review) + init migration
- [x] Phase 3 — Hub client (cached, degrade-to-stale) + entitlement gate
- [x] Phase 4 — Routes (health + gated review-requests) + server
- [x] Phase 5 — Build clean
- [x] Phase 6 — Local e2e vs a local Hub (entitled→201, not→403, no-token→401)
- [x] Phase 7 — Dockerfile + compose + deploy-box2.sh
- [x] Phase 8 — Deploy to box #2 internal-first + commit

## Error Log
None — clean (reused the Hub's proven Dockerfile/patterns; no openssl).

## Completed Work
- Repo `~/Antigravity/MyOrbisReviews` (commit `b55b5d2`). Node/TS/Fastify/Prisma/PG.
- `src/hub.ts`: entitlements from Hub (service-token), ~30s cache, stale-on-blip.
- `src/entitlement.ts`: `requireEntitlement('REVIEWS')` → 403 missing / 503 Hub-down.
- Own ops model (ReviewRequest, Review) + init migration; gated POST review-requests.
- **Local e2e (Hub + Reviews together):** T1 entitled (VOICE+REVIEWS via Hub
  webhook) → POST 201; T2 not entitled → 403; no-token → 401; list ok.
- **Box #2 deploy:** stack `myorbis-reviews` (api + db), `myorbis_reviews_net`,
  internal-only `127.0.0.1:4200`. Verified: health 200, ready db up, isolated;
  gated endpoint → 503 (graceful — Hub not cross-box reachable yet), no-token 401.
  Box #2 now runs edge-caddy + the reviews stack.

## Result
MyOrbisReviews is **live internal-first on box #2**, with the Hub-consumer +
entitlement-gate pattern proven (locally end-to-end; on box #2 it degrades
gracefully to 503 until the Hub is reachable).

## Known dependency / next
Live Reviews→Hub calls need the Hub reachable from box #2 → lands with **Hub
public exposure** (IdP/Hub hostnames + DNS + the careful shared-Caddy edit), the
recommended next infra step. Then set Reviews' real `HUB_URL`/`HUB_SERVICE_TOKEN`.
