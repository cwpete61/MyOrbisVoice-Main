# Claude Code Execution Checklist

> Done previously (see git): box #2 baseline (`ced8f9c`), Keycloak IdP on box #1
> (`23021b0`), Account Hub foundation repo (`MyOrbis-Hub` `3a6fcfa`).

## Objective
Deploy the **MyOrbis Account Hub** to box #1 (`147.93.183.4`) as an ISOLATED
stack (own DB + own network), internal-first (bound to 127.0.0.1), with versioned
Prisma migrations. Greenfield — does not touch the live MyOrbisVoice stack.

## Phases
- [x] Phase 1 — Pin pnpm + create init migration (replace db push for prod)
- [x] Phase 2 — Write idempotent deploy script (scripts/deploy-box1.sh)
- [x] Phase 3 — Deploy (rsync, gen secrets, compose build+up)
- [x] Phase 4 — Fix Dockerfile multi-stage Prisma issue, redeploy
- [x] Phase 5 — Verify (health, authed CRUD smoke, migration applied, isolation)
- [x] Phase 6 — Clean smoke data + commit (Hub repo + checklist)

## Error Log
- **Docker build fail (Dockerfile:19):** `COPY --from=build /app/node_modules/.prisma`
  → "not found". Root cause: pnpm generates the Prisma client under the nested
  `node_modules/.pnpm/@prisma+client@.../node_modules/.prisma` layout, not at
  top-level `node_modules/.prisma`. Fix: copy the build stage's `node_modules`
  wholesale into runtime (client comes along intact); run `migrate deploy` via
  `./node_modules/.bin/prisma`. Redeploy → built + healthy.

## Completed Work
- **Init migration:** `prisma/migrations/20260605140713_init` (versioned schema);
  `packageManager` pinned to `pnpm@9.15.0` for deterministic Docker builds.
- **Deploy:** stack `myorbis-hub` on box #1 — `myorbis-hub-api` + `myorbis-hub-db`
  (postgres:16-alpine), network `myorbis_hub_net`, volume `hub_db`. Secrets
  (POSTGRES_PASSWORD + SERVICE_TOKEN) in `/opt/myorbis-hub/.env.prod` (600), never
  committed. API bound to `127.0.0.1:4100`.
- **Verify:** `/health/ready` db up; 401 no-token; authed create + aggregate read
  ok; `_prisma_migrations` shows `init` applied; hub-api on `myorbis_hub_net` ONLY
  (not Voice/Keycloak nets); all three stacks (voice/id/hub) coexist healthy.
- **Cleanup:** removed the smoke-test tenant from the prod Hub DB (count back to 0).

## Result
Account Hub is **live + isolated + internal-only on box #1**, alongside Keycloak
and Voice — nothing shared, Voice untouched. Ready for the next iteration:
Keycloak OIDC user-token validation, Stripe webhook → entitlement sync, then
public exposure (hostname + TLS via shared Caddy) and MyOrbisReviews.
