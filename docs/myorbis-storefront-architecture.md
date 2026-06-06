# MyOrbisResults Storefront + Consolidated Commerce — Architecture Sketch

> The commercial front door for the portfolio: one place to discover products,
> book a consultation, pick a package, check out once, and get one login across
> everything bought. Sits ON TOP of the already-built Account Hub.
> Sketch — for discussion, not yet a committed build. Drafted 2026-06-06.

## 1. Customer journey (the whole flow)
```
myorbisresults.com
  │
  ├─(A) Self-serve:  "Build your package" → pick products+tiers → see price
  │                   (à la carte or bundle) → Checkout
  │
  └─(B) Assisted:    Book a consultation (appointment) → call → recommend a
                      package → send a prefilled Checkout link
                              │
                              ▼
            ONE Stripe Checkout (multi-item subscription, MyOrbisResults brand)
                              │  pays
                              ▼
            Stripe → Hub webhook → entitlement matrix flips on per product
                              │
                              ▼
            Hub fires provisioning (per product) + sends SSO setup email
                              │
                              ▼
            Customer logs in once (Keycloak SSO) → reaches every product they bought
```

## 2. Components (NEW = to build, ✅ = already live)
| Layer | Component | Status |
|---|---|---|
| Front-end | **MyOrbisResults storefront/portal** (Next.js app): product picker, pricing, booking, checkout, account/billing | NEW |
| Catalog | **Price catalog + bundles** in the Hub (product×tier→Stripe Price; bundle = set + discount) | NEW |
| Checkout | Hub `POST /v1/tenants/:id/checkout` (multi-item subscription) | ✅ scaffolded (4d) |
| Identity/billing | Account Hub (tenant, entitlement matrix, one Stripe customer) | ✅ live |
| Billing feed | Stripe → Hub webhook → entitlements | ✅ live |
| Provisioning | **Hub → n8n → each product's provision API** (per established "n8n owns orchestration") | NEW (per product) |
| Auth | Keycloak SSO, one login across products | ✅ live |
| Access gating | Each product reads its entitlement from the Hub (Phase 3) | ⏳ designed |

## 3. New data (Hub catalog)
- `Product` (have: VOICE, REVIEWS … add LOCAL, WEB, TRAINING).
- `ProductPlan` — productCode + plan + `stripePriceId` + display price/interval. (Resolves the picker selection → real Stripe Price; today only VOICE Prices exist.)
- `Bundle` — code, name, set of {productCode, plan}, discount (or a bundle Stripe Price/coupon).
- `Order` (optional) — selected items + bundle + checkout session id + status, for assisted-sale links + reconciliation.

## 4. Checkout → provisioning sequence
1. Storefront builds a selection (products+tiers, or a bundle) → `POST /v1/tenants/:id/checkout` (Hub resolves selection→Stripe Prices via the catalog, applies bundle discount/coupon, creates the multi-item subscription Checkout session) → returns URL. (For a brand-new prospect: create the Hub tenant + Stripe customer first.)
2. Customer pays → Stripe fires `checkout.session.completed` + `customer.subscription.created` → **Hub webhook** (live) → entitlement matrix gets one ACTIVE entitlement per purchased product.
3. Hub emits a **`tenant.entitlements.changed`** event → **n8n** orchestration → calls each product's **provision** endpoint (Voice: create workspace — already does at signup; Local/Reviews: create their workspace). Idempotent + traceId per the n8n rules.
4. Hub triggers the **SSO setup email** (Keycloak) so the customer sets a password.
5. Customer logs in (SSO) → each product, on load, reads its entitlement from the Hub (Phase 3) → shows only what they bought.

## 5. The appointment/assisted path
- Booking lives on the storefront (reuse the existing public booking pattern, or a MyOrbisResults calendar). A consultation creates a **lead** (Hub tenant in TRIAL, no entitlements yet).
- After the call, generate a **prefilled checkout link** (`/v1/tenants/:id/checkout` with the recommended items) → email/text it → they pay → same provisioning flow.
- Self-serve + assisted converge on the **same Hub checkout** — no separate billing paths.

## 6. What's reused vs new
- **Reused (done):** Account Hub, entitlement matrix, one-Stripe-customer, Stripe→Hub feed, SSO, the 4d checkout endpoint.
- **New:** the storefront/portal UI, the price catalog + bundles, per-product provisioning orchestration (n8n), and productizing Local/Reviews/Web/Training (real Stripe Prices + provision APIs).

## 7. Phasing (ship value early)
- **Phase A — Voice-only storefront:** MyOrbisResults "choose your Voice plan" + checkout page → Hub 4d (enable flag + Voice Prices already exist) → existing Voice provisioning. Real, revenue-capable immediately. Validates the whole loop.
- **Phase B — add a second product:** productize Reviews (Prices + provision API) → add to the picker → first true multi-product sale.
- **Phase C — bundles + assisted sale:** bundle SKUs/pricing + the consultation-booking → prefilled-checkout link. Then Local/Web/Training as productized.

## 8. Open decisions (product/business)
1. **Storefront home:** a new MyOrbisResults Next.js app (storefront + customer portal) vs extend the existing marketing site with a dynamic checkout? (Lean: new small app — clean separation, reuses Hub APIs.)
2. **Pricing + bundles:** the actual packages + discounts (your pricing call).
3. **Provisioning per product:** Hub→n8n→provision API for each — needs each product to expose a provision endpoint (Voice ~has signup provisioning; Local/Reviews need theirs).
4. **Trial vs pay-first** for consultation leads (TRIAL tenant created at booking, entitlements only on payment).
5. **Where the customer "account/billing" portal lives** (manage subscription, add a product later) — same storefront app, reading the Hub.

## 9. Bottom line
The backend spine for this already exists (Hub + entitlements + consolidated checkout + SSO + Stripe feed). This sketch adds the **storefront UI + catalog + per-product provisioning** on top. Start with **Phase A (Voice-only storefront)** to make it real + revenue-capable, then add products into the same picker. This is the strategic endpoint of the whole consolidation.

## Phase A — backend foundation DONE 2026-06-06
- Hub price catalog: `ProductPlan` model + migration; `GET /v1/catalog` (storefront
  menu) + `PUT /v1/catalog/:product/:plan` (seed/admin).
- VOICE catalog seeded: Basic $197/mo, Pro $497/mo, Premier $997/mo, Enterprise
  $1997/mo, Lifetime $497 one-time (mapped to the live Stripe Prices).
- Checkout now resolves `{productCode, plan}` → Stripe Price via the catalog.
- All inert (consolidated checkout still flag-off). No customer/billing impact.

### Phase A remaining:
1. **Storefront UI** (new MyOrbisResults Next.js app): reads /v1/catalog → picker
   → calls /v1/tenants/:id/checkout. (Needs repo decision — new app.)
2. **Enable checkout** (money-gated): set STRIPE_SECRET_KEY + CONSOLIDATED_CHECKOUT_ENABLED
   on the Hub; test in Stripe test mode first. Until then the UI's "Buy" → 503.
3. Provisioning on purchase (Voice already provisions; storefront-purchase path).

## Phase A — STOREFRONT LIVE 2026-06-06 (pending DNS)
- New app: ~/Antigravity/MyOrbis-Storefront (Next.js, repo cwpete61/MyOrbis-Storefront).
- Deployed to box #2 (myorbis-storefront-api, edge_net). Renders the LIVE Hub
  catalog (server-side fetch of /v1/catalog with the service token) — all 5 VOICE
  plans with prices. (`force-dynamic` so it fetches at runtime, not prerendered.)
- Caddy route added: products.myorbisresults.com -> storefront:4300 (config valid,
  reloaded).
- **GO-LIVE STEP (you):** add DNS A `products.myorbisresults.com -> 109.123.249.34`
  (box #2, DNS-only) → Caddy auto-issues the cert → publicly live.

### Storefront remaining:
- `/start` checkout flow (CTA target): collect email/business → create Hub tenant →
  call /v1/tenants/:id/checkout → Stripe. Currently CTA links to /start (not built).
- Enable live checkout (Hub: STRIPE_SECRET_KEY + CONSOLIDATED_CHECKOUT_ENABLED,
  test-mode first) — until then it's a browse-only preview.

## /start checkout flow BUILT 2026-06-06
- /start?product=&plan= → form (business + email) → server action: create Hub
  tenant (lead) → POST /v1/tenants/:id/checkout → redirect to Stripe.
- Checkout flag-gated (503) → shows "you're on the list" (lead captured as TRIAL
  tenant). When enabled → redirects to Stripe Checkout.
- Fixed: Next standalone binding (pin HOSTNAME=0.0.0.0 in Dockerfile) — was 000.
- Verified: / 200 (catalog), /start 200 (form), Hub flow tenant→checkout→503.

**Phase A storefront COMPLETE as a preview.** Go-live needs: (1) DNS
products.myorbisresults.com → 109.123.249.34, (2) enable live checkout (Hub
STRIPE_SECRET_KEY + CONSOLIDATED_CHECKOUT_ENABLED, Stripe test-mode first).
