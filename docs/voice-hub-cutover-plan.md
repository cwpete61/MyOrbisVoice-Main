# MyOrbisVoice → Account Hub — Backfill (Phase 0) + Cutover Plan

> Planning doc. **No production writes yet.** Voice is the most-affected, live
> product (real customers + billing). Everything here is phased + gated; Phase 0
> is read-only on Voice (writes only to the Hub).
>
> Companion to [myorbis-portfolio-architecture.md](myorbis-portfolio-architecture.md).
> Status: drafted 2026-06-05 from live prod recon.

## 1. Current Voice prod state (measured 2026-06-05)

| Metric | Count | Note |
|---|---|---|
| Tenants (total) | 211 | mostly junk |
| **Tenants active (`deletedAt` IS NULL)** | **11** | 9 TRIAL + 2 ACTIVE — the real base |
| Users | 366 | 364 bcrypt password, 1 Google |
| Memberships | 213 | |
| BusinessProfiles | 210 | |
| StripeCustomerRef | 209 | |
| Subscriptions | 9 | 4 ACTIVE, 5 CANCELED |
| Active plans | 6 | free, basic/pro/premier/enterprise_monthly, ltd |

**Backfill scope: the 11 active tenants.** Skip the 200 soft-deleted (junk/trial).

## 2. Data mapping (Voice → Hub)

| Voice | Hub | Notes |
|---|---|---|
| `Tenant.id` | `Tenant.id` | **adopt the UUID verbatim** (canonical key; no FK rewrite on Voice) |
| `Tenant.slug` | `Tenant.slug` | |
| `Tenant.status` (TRIAL/ACTIVE) | `Tenant.status` | direct |
| `Tenant.{displayName,legalName,timezone,publicEmail,publicPhone,website}` + `BusinessProfile` | `BusinessProfile` | merge into one profile |
| `StripeCustomerRef.stripeCustomerId` | `StripeCustomer` | one per tenant |
| `Plan` + `Subscription` | `Entitlement{productCode:"VOICE", plan, status}` | plan code → normalized (FREE/BASIC/PRO/LTD/PREMIER/ENTERPRISE); status: subscription ACTIVE→ACTIVE, CANCELED→CANCELED, else tenant TRIAL→TRIALING |
| `User` + `TenantMember` | `User` + `Membership` | **DEFERRED to Phase 2** — Hub `User.keycloakId` is required; users land when imported into Keycloak |

## 3. Phase 0 — Backfill (READ-ONLY on Voice → writes to Hub)

For each of the 11 active Voice tenants:
1. `POST hub /v1/tenants` with explicit `id` = Voice tenant id, `slug`, `profile`.
2. Upsert `StripeCustomer` (tenantId, stripeCustomerId).
3. Upsert `Entitlement` (VOICE, mapped plan, mapped status).

**Excluded from Phase 0:** users, auth, memberships (Phase 2). No Voice writes.

### Phase 0 prerequisites (Hub enhancements)
- [x] **Idempotent tenant upsert** — `PUT /v1/tenants/:id` (re-runnable). DONE,
  live on box #1 (MyOrbis-Hub `1f1aa81`).
- [x] **Entitlement admin endpoint** — `PUT /v1/tenants/:id/entitlements/:productCode`. DONE.
- [x] **StripeCustomer admin endpoint** — `PUT /v1/tenants/:id/stripe-customer`. DONE.
- [ ] **Backfill script** — reads Voice DB read-only (or a Voice export endpoint),
  PUTs to `https://hub.myorbisresults.com` with the Hub service token. Idempotent,
  dry-run first, per-tenant result log. **NEXT.**

### Phase 0 verification gate
- Hub active-tenant count == 11; each profile/stripe/entitlement spot-checked vs
  Voice. Rollback = delete the 11 backfilled Hub tenants (cascades). Voice
  untouched (read-only), so zero Voice risk.

## 4. Cutover phases (after Phase 0)

- **Phase 1 — New + expansion via the Hub.** New signups create the Hub tenant
  first (canonical id), Voice consumes it. Central onboarding + consolidated
  billing for new/cross-product. Existing Voice subs grandfathered.
- **Phase 2 — SSO (the hard one).** Import the 366 users into Keycloak **with
  their bcrypt hashes** (Keycloak supports bcrypt credential import → same
  passwords keep working); the 1 Google user relinks via Keycloak's Google IdP.
  Backfill Hub `User`+`Membership` (now with `keycloakId`). Voice becomes an OIDC
  client; run Keycloak alongside Voice's current auth, then retire the local path.
- **Phase 3 — Entitlements from Hub.** Voice reads its entitlement set from the
  Hub (cached); keeps its existing gating/enforcement code (only the *source*
  changes). **Hot-path rule:** widget/inbound sessions resolve tenant from the
  local cached projection — never block voice on Hub availability.
- **Phase 4 — Legacy billing migration (optional/gradual).** Move grandfathered
  Voice subs onto the consolidated multi-item subscription.

## 5. Safety / gates (every phase)
- Phase 0: read-only on Voice; Hub writes only; dry-run; per-tenant verify;
  trivial rollback (delete Hub rows).
- No Voice schema change until Phase 3+, and even then additive only.
- Each phase has a manual verification gate before the next (per CLAUDE.md).
- Voice realtime (widget/inbound) must never gain a synchronous Hub dependency.

## 6. Open decisions
1. **Plan code normalization** — keep Voice codes (`pro_monthly`) or normalize to
   `PRO`/`BASIC`/…? (Recommend normalize; map monthly variants → base.)
2. **Backfill source** — read Voice DB directly (read-only psql/Prisma) vs add a
   Voice read-only export endpoint? (Recommend a small read-only export endpoint —
   cleaner than cross-service DB access.)
3. **Keycloak bcrypt import** — confirm Voice's hash format/cost matches what
   Keycloak's bcrypt hash-provider accepts (verify with one user before bulk).
4. Backfill all 211 (preserving deleted) vs only the 11 active? (Recommend 11.)
