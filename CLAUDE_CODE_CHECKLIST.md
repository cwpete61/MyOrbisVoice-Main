# Claude Code Execution Checklist

> Done previously (see git): box #2 baseline (`ced8f9c`), Keycloak IdP (`23021b0`),
> Account Hub foundation (`MyOrbis-Hub` `3a6fcfa`), Hub deployed to box #1
> (`ba22eab`).

## Objective
Wire **Keycloak ↔ Account Hub OIDC**: configure the `myorbis` realm + client in
Keycloak; add Keycloak access-token validation to the Hub for user-facing
endpoints (distinct from the existing service-token auth). Verify end-to-end
internally (public issuer/hostname finalizes when Keycloak is exposed).

## Phases
- [x] Phase 1 — Keycloak realm `myorbis` + public client `myorbis-apps` + test user (kcadm)
- [x] Phase 2 — Hub OIDC code (jose JWKS verify, requireUser, /v1/me auto-provision)
- [x] Phase 3 — Local build (fix pnpm 9/10 store conflict), redeploy to box #1
- [x] Phase 4 — Verify end-to-end (token → /v1/me 200, bad token 401, persist)
- [x] Phase 5 — Clean test data + codify realm setup + commit

## Error Log
- **kcadm token verify in-container:** `curl: command not found` (Keycloak image
  has no curl). Fix: minted token/checked discovery via a throwaway
  `curlimages/curl` container on `myorbis_id_net`.
- **Local `tsc`: jose not found + `sub` missing:** pnpm 9 vs 10 store conflict
  blocked the install. Fix: clean reinstall via `corepack pnpm` (respects pinned
  pnpm@9.15.0) → jose resolved, build exit 0.

## Completed Work
- **Keycloak:** realm `myorbis`; public client `myorbis-apps` (auth-code + PKCE +
  direct grants); test user `testuser`. Issuer (internal):
  `http://myorbis-id-keycloak:8080/realms/myorbis`. Codified in
  `infrastructure/myorbis-id/setup-realm.sh` (idempotent; test user gated behind
  `TEST_USER_PASSWORD` env — no secret committed).
- **Hub:** `oidc.ts` (jose JWKS verify, issuer-pinned), `routes/me.ts`
  (requireUser → upsert User by Keycloak `sub`; `GET /v1/me` → user + memberships),
  `KC_ISSUER` env, api attached to `myorbis_id_net`. Two auth modes now:
  service-token (product→Hub) + OIDC user token. Commit `MyOrbis-Hub` `07de122`.
- **Verify:** token minted from realm → `/v1/me` 200 with auto-provisioned user;
  bad token 401; user persisted in Hub DB; both test rows then cleaned (Hub DB
  back to 0 users).

## Result
Keycloak ↔ Hub OIDC is **live + verified internally on box #1**. Hub now
authenticates both products (service token) and end users (Keycloak JWT).

## Pre-exposure cleanup (flag)
- Keycloak `testuser` (weak test password) still exists in the realm — internal
  only now; **remove/disable before public exposure**.
- Issuer is internal; set `KC_HOSTNAME` + finalize `KC_ISSUER` to the public IdP
  URL when Keycloak goes public.
