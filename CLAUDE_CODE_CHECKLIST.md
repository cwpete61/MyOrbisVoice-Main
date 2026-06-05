# Claude Code Execution Checklist

> Done previously (see git): box #2 baseline (`ced8f9c`), Keycloak IdP on box #1
> (`23021b0`).

## Objective
Scaffold the **MyOrbis Account Hub service** as a new standalone repo at
`~/Antigravity/MyOrbis-Hub` (local-only for now). Foundation to a running,
verified state: Node + TypeScript + Fastify + Prisma + Postgres, the shared
tenant data schema (canonical tenantId, business profile, users↔Keycloak,
entitlement matrix, Stripe customer), core read/create endpoints, service-token
auth, /health. Build clean + boot + migrate + smoke-test against a local DB.
Defer (later iterations): full Stripe sync, Keycloak OIDC token validation,
event/webhook sync, all CRUD, deploy to box #1.

## Phases
- [x] Phase 1 — Init repo + tooling (package.json, tsconfig, .gitignore, env)
- [x] Phase 2 — Prisma schema (shared tenant data) + generate + validate
- [x] Phase 3 — Fastify service (health, service-token auth, tenant routes)
- [x] Phase 4 — Build (tsc) clean
- [x] Phase 5 — Smoke test against local Postgres (migrate, /health, create+read tenant)
- [x] Phase 6 — README + Dockerfile + compose (for later box #1 deploy)
- [x] Phase 7 — git init + commit in the new repo

## Error Log
- **Smoke test, run 1:** `docker run -p 5433` → "port is already allocated"
  (another container on 5433); Prisma then auth-failed against the wrong DB.
  Root cause: 5433 occupied. Fix: re-ran on free port 5439 → all green.
- **`prisma validate` exit 1:** missing `DATABASE_URL` env at validate time
  (not a schema bug). Confirmed valid via `prisma db push` ("in sync") + tsc.

## Completed Work
- **Repo:** `~/Antigravity/MyOrbis-Hub` (local git, commit `3a6fcfa`). Node 22 +
  TS + Fastify 5 + Prisma 6 + Postgres 16. node_modules/dist/.env gitignored.
- **Schema:** Tenant (canonical id, adopts Voice UUIDs), BusinessProfile, User
  (keycloakId-linked), Membership, Product, Entitlement (matrix), StripeCustomer.
- **Service:** `/health`, `/health/ready` (DB check), service-token auth on /v1,
  `POST /v1/tenants`, `GET /v1/tenants/:id` (aggregate), `.../entitlements`.
  Fail-fast zod env, CORS, graceful shutdown.
- **Build:** `tsc` exit 0; `prisma generate` + `db push` ok.
- **Smoke test (port 5439):** health ok · ready db up · no-token 401 · bad-body
  400 · create 201 (tenant+profile) · aggregate read ok · entitlements [] · 404
  missing · clean teardown.
- **Ops:** Dockerfile (multi-stage) + docker-compose (own isolated stack) for box #1.

## Result
MyOrbis Account Hub **foundation complete + verified locally**. Lives in its own
repo (not the Voice repo — brand boundary respected). Deferred to next iterations:
Stripe webhook → entitlement sync, Keycloak OIDC user-token validation,
event/webhook cache invalidation, full CRUD, deploy to box #1.
