# Claude Code Execution Checklist

> Done previously (see git): box #2 baseline (`ced8f9c`), Keycloak IdP (`23021b0`),
> Account Hub foundation (`MyOrbis-Hub` `3a6fcfa`), Hub→box #1 (`ba22eab`),
> Keycloak↔Hub OIDC (`07de122` / `9097e5e`).

## Objective
Add **Stripe → entitlement sync** to the Hub: a signature-verified webhook that
maps Stripe subscription events onto the entitlement matrix + Stripe customer
link. Greenfield; verify locally + on box #1.

## Phases
- [x] Phase 1 — Webhook code (constructEvent verify, subscription→entitlement, customer link)
- [x] Phase 2 — rawBody capture, env (STRIPE_WEBHOOK_SECRET), stripe client
- [x] Phase 3 — Local build + end-to-end (signed event → entitlement, idempotent, bad-sig)
- [x] Phase 4 — Deploy to box #1 (fix 3 deploy bugs)
- [x] Phase 5 — Verify on box #1 (signed event → entitlement) + commit

## Error Log
- **Crash #1 — env-validation:** `STRIPE_WEBHOOK_SECRET Required`. Backfilled into
  `.env.prod` but not declared in compose `environment:` → not passed to container.
  Fix: declare `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` in compose.
- **Crash #2 — Stripe ctor:** "Neither apiKey nor config.authenticator". compose
  passes `${STRIPE_SECRET_KEY:-}` = "" (empty); code used `??` (nullish, doesn't
  catch ""). Fix: `||`. (Local passed because the var was unset→undefined.)
- **Crash #3 — Prisma engine:** added `openssl` to the runtime image → Prisma
  flipped to a 3.0 engine the generated client doesn't bundle → engine load crash.
  Fix: reverted; base libssl3 + the cosmetic detection warning is the working
  config (proven by prior deploys). Documented "do not add openssl" in Dockerfile.

## Completed Work
- `routes/stripe-webhook.ts`: `POST /webhooks/stripe`, signature-verified; maps
  `customer.subscription.created/updated/deleted` → entitlement matrix
  (tenantId from `subscription.metadata`, productCode/plan from `price.metadata`,
  Stripe status → EntitlementStatus); `customer.*` → StripeCustomer link.
  Idempotent upserts.
- `server.ts` rawBody capture; `stripe.ts` client; env additions; compose env;
  deploy-script backfill; `test/webhook-smoke.mjs`. Commit `MyOrbis-Hub` `66ff6d6`.
- **Verified local + box #1:** signed event → 200 + entitlement (VOICE/PRO/ACTIVE,
  +REVIEWS/STARTER local); bad-sig → 400; idempotent re-fire; test data cleaned.

## Result
Stripe → entitlement sync is **live + verified on box #1**, isolated, internal.
`STRIPE_WEBHOOK_SECRET` is a placeholder until the real Stripe endpoint is created
(then replace + point the Stripe dashboard webhook at the public Hub URL).

## Backlog flag
- Base image `node:22-slim` reports CVEs (1 critical / 13 high) — pin to a patched
  digest or move to a hardened base in a later pass.
