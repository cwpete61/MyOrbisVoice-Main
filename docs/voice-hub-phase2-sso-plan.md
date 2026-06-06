# Phase 2 — SSO (Keycloak) Migration Plan

> Companion to [voice-hub-cutover-plan.md](voice-hub-cutover-plan.md). Highest-stakes
> phase (live auth). Every user-affecting step is gated. Drafted 2026-06-05.

## Decision: forced-reset import (NOT seamless bcrypt)
- Keycloak has **no built-in bcrypt** hash provider (verified — providers/ empty,
  lib = pbkdf2/argon2). Importing Voice's bcrypt hashes for seamless login would
  require a **third-party JAR** (`keycloak-bcrypt`) in the public auth server —
  supply-chain risk, KC26 compat risk.
- Real user base is tiny (11 active tenants). So: **import users into Keycloak
  WITHOUT passwords + `UPDATE_PASSWORD` required action.** Each user sets a new
  password once, on first SSO login. (Proven: a probe user imported + verified.)
- Google users → Keycloak **Google IdP** (re-link via Google), no password.

## Linking
- **Voice ↔ Keycloak: by email** (both have it) — no Voice schema change.
- **Hub User ↔ Keycloak: by `keycloakId`** (= Keycloak `sub`), the existing field.
- Hub `Membership` links Hub User → Hub Tenant (tenants already backfilled).

## Why this is safe to progress now
Importing users into Keycloak + backfilling Hub Users is **INERT** — Voice still
authenticates locally; `UPDATE_PASSWORD` only fires when a user first logs in via
Keycloak, which doesn't happen until the OIDC cutover (2.4). So 2.1–2.3 carry no
user impact and are reversible. Only 2.4 is user-facing → hard gate.

## Sub-steps
- **2.0 (done)** — bcrypt reality-check + forced-reset import proof.
- **2.1 — Hub user/membership admin endpoints** (greenfield Hub code): 
  `PUT /v1/users` (upsert by keycloakId; email/name) + 
  `PUT /v1/tenants/:id/members` (upsert membership by userId+role).
- **2.2 — Bulk import** (script, INERT): for the **active-tenant** users
  (read-only from Voice) → create Keycloak users (forced-reset) → upsert Hub
  User(keycloakId) + Membership. Dry-run first.
- **2.3 — Keycloak Google IdP** (for Google-signin users): configure Google IdP
  in the realm (needs the Google OAuth client id/secret — reuse Voice's).
- **2.4 — Voice as OIDC client (GATED, user-facing):** add "Sign in with
  MyOrbis" (Keycloak) to Voice, validate KC tokens, map by email, run ALONGSIDE
  local auth. Then flip primary → retire local auth. Phased, reversible.

## Scope
Import only users of the **11 active tenants** first (the real accounts), not the
200 soft-deleted junk. Expand later if needed.

## Safety / rollback
- 2.1–2.3: additive + inert; rollback = delete imported KC users + Hub rows.
- 2.4: feature-flagged; local auth stays until verified; can disable the KC login
  path instantly. No Voice user data deleted; email-match keeps both in sync.

## Open items
- Confirm import scope (active-tenant users vs all enabled).
- Google IdP needs Voice's Google OAuth client id/secret.
- Decide reset-email timing (send at cutover, not at import — avoid premature mails).

## EXECUTED 2026-06-05
- **2.0** bcrypt reality-check + forced-reset import proof — done.
- **2.1** Hub user/membership admin upserts (`PUT /v1/users`,
  `PUT /v1/tenants/:id/members/:userId`) — built, deployed, verified (MyOrbis-Hub).
- **2.2** User import — `MyOrbis-Hub/scripts/backfill-users.mjs`. Imported **9 real
  active-tenant users** (6 test/junk filtered) → Keycloak (forced-reset) + Hub
  User+Membership. INERT (no login change/emails yet), idempotent.

### Finding (deploy hygiene) — flag for separate fix
deploy.sh's post-deploy smoke test signs up `e2e-api-*@orbisvoice.test` on EVERY
api deploy and never cleans up. Accumulated 4 junk active tenants + 337 test users
(now soft-deleted/suspended). Phase 1a/1b also briefly mirrored some to nothing
(Hub stayed clean). **Fix later:** make the smoke test clean up its tenant, or run
it against a disposable account and delete after.

### Remaining (GATED — user-facing)
- **2.3** Keycloak Google IdP (needs Voice's Google OAuth client id/secret) — for
  the 1 Google user.
- **2.4** Voice as OIDC client: add "Sign in with MyOrbis" alongside local auth,
  validate KC tokens (map by email), then flip primary + retire local. Phased,
  reversible, feature-flagged.

## 2.3 / 2.4 status (2026-06-05)
- **2.3 Google IdP — BLOCKED:** Voice `GOOGLE_CLIENT_ID` empty in env; configuring
  Keycloak's Google IdP also needs the Keycloak broker redirect URI added to the
  Google OAuth app in Google Cloud Console (manual, owner-only). Deferred — the 1
  Google user can password-reset like the rest, or do this later.
- **2.4 STARTED (safe step):** registered Keycloak confidential client
  `myorbis-voice` (redirect `https://api.myorbisvoice.com/api/auth/oidc/callback`,
  webOrigin app.myorbisvoice.com). Secret/issuer/client-id staged in Voice
  `/opt/myorbisvoice/infrastructure/docker/.env.prod` (OIDC_CLIENT_SECRET/
  OIDC_ISSUER/OIDC_CLIENT_ID).

### 2.4 remaining — GATED (user-facing login change), build deliberately:
1. Voice api: `/api/auth/oidc/login` (redirect → KC authorize) + `/api/auth/oidc/
   callback` (code exchange w/ client secret → validate id_token → find Voice user
   by email → issue Voice session). Behind a feature flag (OFF).
2. Voice web: "Sign in with MyOrbis" button on the login page (flag-gated).
3. **Test with ONE account in a browser** (set that KC user a password) end-to-end
   before any default change.
4. Flip primary → retire local auth (separate gate). Reversible via the flag.
Recommended as a focused, browser-tested unit — not a rushed flip.

## 2.4 API side — DONE 2026-06-05 (flagged OFF, inert)
Voice api OIDC routes deployed: `/api/auth/oidc/login` + `/callback`
(apps/api/src/routes/auth-oidc.ts), confidential client `myorbis-voice`, CSRF
state cookie, code-exchange -> userinfo -> find user by email ->
issueTokensForUserId -> tokens to SPA via URL fragment. **OIDC_ENABLED unset =
OFF**: /login bounces to /login (verified 302). No user impact.

### Remaining (GATED — user-facing):
1. Web: `/oidc-complete` page (read token fragment -> setTokens -> /dashboard) +
   "Sign in with MyOrbis" button on the login page (env-gated NEXT_PUBLIC_OIDC_ENABLED).
2. Flip `OIDC_ENABLED=true`, **browser test ONE account** (set that KC user a
   password, run authorize->callback->session), confirm, then surface to all.
3. State cookie verified; consider id_token signature verify (currently trusts
   userinfo over TLS to the same KC) — fine, optionally harden.
