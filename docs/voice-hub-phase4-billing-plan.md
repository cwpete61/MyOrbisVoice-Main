# Phase 4 — Consolidated Billing Plan (Hub as billing source)

> **PLANNING ONLY. No execution.** Money-sensitive — touches live Stripe + real
> customer charges. Every step is Stripe-test-mode-first, reversible, and gated.
> Companion to [voice-hub-cutover-plan.md](voice-hub-cutover-plan.md) +
> [myorbis-portfolio-architecture.md](myorbis-portfolio-architecture.md) (§2 locked decisions).
> Drafted 2026-06-06.

## Current billing state (Voice)
- **One Stripe account** (Voice's). Legal entity confirmed = **MyOrbisResults**
  (so the rebrand is display-only, no new account).
- **Webhook → Voice** (`/api/webhooks/stripe`): updates Voice subscriptions →
  `syncEntitlementsFromPlan` → (Phase 1b) pushes the VOICE entitlement to the Hub.
- 6 active plans (free, basic/pro/premier/enterprise_monthly, ltd), each with
  `stripePriceId` (+ `stripeRecurringPriceId` for LTD, `stripeBuyLinkUrl`).
- 9 subscriptions (4 active, 5 canceled). Per-product (Voice only) today.
- The **Hub already has a signature-verified Stripe webhook** (`/webhooks/stripe`)
  that maps `subscription.metadata.tenantId` + `price.metadata.{productCode,plan}`
  → entitlement matrix. Currently a placeholder secret; Stripe isn't pointed at it.

## Target (locked decisions §2)
- **One Stripe account** = Voice's, **rebranded display → MyOrbisResults**.
- **Hub = billing source of truth**: Stripe webhook → Hub → entitlement matrix.
- **One Stripe customer per tenant**, **single subscription with multiple items**
  (one item per product) → one consolidated invoice with per-product line items.
- **Grandfather** existing Voice subs; **new + expansion** bill consolidated.
- Pricing à la carte **+** bundles.

## Phased plan (each: Stripe test mode first → verify → gate → prod)

### 4a — Stripe rebrand (display-only, no migration)
- Stripe Dashboard → Settings → Business: public name + statement descriptor +
  branding → **MyOrbisResults**. (Same legal entity → safe.)
- **Customer comms:** email existing customers BEFORE the descriptor flips
  (`MYORBISVOICE → MYORBISRESULTS`) — classic chargeback trigger.
- Risk: low (no data change). Reversible.

### 4b — Add product/plan metadata to Stripe Prices
- For each Stripe Price, set `metadata.productCode` (VOICE) + `metadata.plan`
  (PRO/BASIC/…). New products (LOCAL/REVIEWS) get their own Prices + metadata.
- Required so the Hub webhook can map events. Backfill via Stripe API. No charge impact.

### 4c — Point Stripe webhook at the Hub (the pivot)
- Create a Stripe webhook endpoint → `https://hub.myorbisresults.com/webhooks/stripe`;
  put its real `whsec_` into the Hub `.env.prod` (replace placeholder) + recreate hub.
- **Transition safety — avoid double-processing:** Voice's webhook still runs +
  pushes to Hub (Phase 1b). Two writers to the Hub entitlement = OK (idempotent
  upserts, same data), but decide the authority: once the Hub webhook is live +
  verified, **retire Phase 1b's push** (Voice → Hub) so the Hub's source is Stripe
  directly, not Voice. Sub.metadata.tenantId must be set on all subs (backfill).
- Test: Stripe test-mode events → Hub entitlement updates correctly.

### 4d — New/expansion on consolidated subscription
- New checkouts create ONE subscription on the tenant's Stripe customer with the
  chosen product item(s). Adding a product = add a subscription item (proration).
- Central onboarding/checkout at MyOrbisResults selects products → builds the
  multi-item subscription.

### 4e — Migrate legacy subs (optional, gradual)
- Move grandfathered Voice subs onto the multi-item model (Stripe supports moving
  items). Per-customer, verified, reversible. No forced cutover.

### Then: Phase 3 enforcement flip becomes meaningful
With the Hub as the independent billing source (4c), flip Voice to READ
entitlements from the Hub (cached, fallback-to-local, hot-path safe).

## Safety / gates (every step)
- **Stripe TEST MODE first** for every change; verify; then prod.
- **Never double-charge / double-process.** Reconcile after each step
  (Stripe ↔ Hub ↔ Voice).
- Customer email before the statement-descriptor change.
- Each phase manually verified before the next; all reversible.

## Open decisions
1. Retire Phase 1b push at 4c (Hub source = Stripe) vs keep both (belt-and-suspenders)?
2. Bundle SKUs / pricing for Local + Reviews (product/pricing call).
3. Migrate legacy subs (4e) now or leave grandfathered indefinitely?
4. Who sends the customer billing-rebrand email + when (4a)?

## 4b — DONE 2026-06-06 (Stripe price metadata)
Tagged all 6 live Voice Stripe prices with metadata productCode=VOICE + plan
(BASIC/PRO/PREMIER/ENTERPRISE/LTD ×2). Money-neutral (metadata only, no charge
impact, inert until 4c). The Hub webhook can now map Voice subscription events.

### 4c is the PIVOT — needs a conscious go (gated)
4c (point Stripe webhook at the Hub) requires, and each is a real decision:
- Backfill `subscription.metadata.tenantId` on live subs (so the Hub maps them) —
  money-neutral but a live-Stripe write; needs Voice's stripe-sub-id ↔ tenant map.
- Create a live Stripe webhook endpoint → hub.myorbisresults.com/webhooks/stripe
  + put its whsec in the Hub (Hub starts receiving REAL billing events).
- **Open decision:** retire the Phase 1b Voice→Hub push (Hub source = Stripe
  direct) vs keep both (idempotent). 
- New-checkout code must set subscription.metadata.tenantId going forward.
This is the consolidation pivot — do it deliberately, Stripe-test-first, you-in-loop.

## 4c — DONE 2026-06-06 (Stripe→Hub webhook live, keep-both mode)
- Created live Stripe webhook endpoint → hub.myorbisresults.com/webhooks/stripe
  (5 sub/customer events, real whsec loaded into Hub, Hub recreated + healthy).
  Voice's own webhook untouched.
- New subs already carry subscription.metadata.tenantId (Voice checkout sets it) +
  prices tagged (4b) → Hub maps them directly.
- **Finding:** 4 of 5 active subs are LEGACY (no tenantId metadata + untagged
  legacy prices) → the direct Hub feed skips them. **Phase 1b (Voice→Hub push)
  covers them, so the Hub matrix stays accurate.**
- **DECISION (open #1): keep BOTH feeds. Do NOT retire Phase 1b** — the direct
  feed can't fully map legacy subs; Phase 1b is the complete/reliable feed.
- Customer impact: NONE. The Hub matrix is informational (not enforced by Voice
  until the Phase 3 flip), so the feed source change charges/affects nothing.

### Remaining (4d/4e + Phase 3 flip) — still gated, money/charge-affecting:
- 4a Stripe display rebrand (needs customer comms — descriptor change).
- 4d consolidated multi-item subscription for NEW checkouts (changes how new
  customers are billed) + central MyOrbisResults checkout.
- 4e migrate legacy subs (optional; or leave grandfathered + on Phase 1b).
- Phase 3 enforcement flip (Voice reads entitlements from Hub) — after the above.

## 4a — PREPARED 2026-06-06 (email drafted; execution = your dashboard + send)
- Customer heads-up email drafted (bilingual, on-brand): docs/comms/billing-rebrand-email.md.
  NOT sent.
- 4a Stripe change (public business name + statement descriptor → MyOrbisResults)
  is a **Stripe Dashboard** action on your own account (not reliably API-settable
  for the platform's own account) → **you do it in the dashboard, after the email
  goes out.** Reversible (display setting).

## Open decisions — resolved where safe:
1. Retire Phase 1b? → NO, keep both (done, 4c).
2. Bundle SKUs/pricing for Local+Reviews → YOUR call (product/pricing).
3. Migrate legacy subs? → DEFAULT: grandfather (leave on Phase 1b); revisit later.
4. Who sends rebrand email + when → YOUR call (operational).

## Status: all autonomous-safe Phase 4 work done (4b, 4c). 4a needs you (email
## send + dashboard). 4d/Phase-3-flip are charge/access-affecting — gated.
