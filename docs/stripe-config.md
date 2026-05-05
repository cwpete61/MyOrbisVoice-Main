# Stripe Configuration — Reconstruction Reference

This doc captures every Stripe-side setting that is **not** in our codebase, so that if the Stripe account is ever lost, suspended, or rebuilt from scratch, reconstruction is mechanical instead of archaeological.

Last verified: 2026-05-05 against `acct_1TSNGGRsXNhM9LwU` (live mode).

---

## Platform account

- **Account ID:** `acct_1TSNGGRsXNhM9LwU`
- **Account email:** `admin@myorbisvoice.com`
- **Country:** US
- **Default currency:** USD
- **Account type:** Standard (with Connect platform enabled)
- **Connect activated:** ✅ live mode + ✅ test mode (each is a separate activation)
- **Statement descriptor:** `MYORBISVOICE`

If you ever lose access and need to find the account: it's the one tied to `admin@myorbisvoice.com` on dashboard.stripe.com.

---

## API keys

The four secrets that need to be saved off-repo (1Password / Bitwarden, **not** in this file):

| Key | Where it's used | Where it lives |
|---|---|---|
| `sk_live_…` | Server-side API calls (apps/api, apps/voice-gateway) | DB: `SystemConfig.stripe_secret_key` (encrypted) |
| `pk_live_…` | Stripe.js on the frontend (Checkout / Connect onboarding redirects) | DB: `SystemConfig.stripe_publishable_key` |
| `whsec_icvaOo…` | Verifies signatures on platform-events webhook deliveries (elegant-wonder destination) | DB: `SystemConfig.stripe_webhook_secret` (encrypted) |
| `whsec_FIhui3…` | Verifies signatures on Connect-events webhook deliveries (empowering-dream destination) | DB: `SystemConfig.stripe_webhook_secret_connect` (encrypted) |

All four are stored encrypted in `SystemConfig` via AES-256-GCM (key derived from `AUTH_SECRET`). They hydrate into `process.env` at API boot via `bootStripeFromConfig()` in `apps/api/src/lib/stripe.ts`.

**To rotate any key:** paste the new value into Admin → System Settings → Stripe. The hydration runs on save (no container restart needed).

---

## Connect platform branding (live mode)

These are visible on the Stripe-hosted Express onboarding page that partners see when they click "Connect now" in the partner portal. Set in **Stripe Dashboard → Settings → Connect → Branding** while in **Live mode**.

| Field | Value |
|---|---|
| Business name | MyOrbisVoice |
| Icon | Square logo PNG (uploaded — `file_1TTjLGRsXNhM9LwUe6y4NOjm`) |
| Logo | Wide wordmark logo PNG (uploaded — `file_1TTjuwRsXNhM9LwUcqk87L14`) |
| Primary color | `#1a9898` (teal — matches the rest of the app) |
| Secondary color | `#0a5c5c` (darker teal) |
| Support phone | +1 929-497-7803 |
| Support address | 716 Washington Street, Suite 2, Allentown, PA 18102 |
| Support email | (currently null — `support@myorbisvoice.com` recommended once that inbox exists) |
| Support URL | (currently null — `https://myorbisvoice.com/support` recommended once that page exists) |
| URL | `https://myorbisvoice.com` |
| Statement descriptor | `MYORBISVOICE` |

Test mode uses similar branding (set separately in Stripe Dashboard while in test mode); the test branding is less critical but lets internal QA see the production look during dev.

---

## Webhook destinations

Stripe Workbench (`dashboard.stripe.com/webhooks` in live mode) lists **two** destinations, both pointing at the same URL but scoped to different event sources. Both must exist.

### Destination 1 — `elegant-wonder` (platform events)

- **Endpoint URL:** `https://api.myorbisvoice.com/api/webhooks/stripe`
- **Events from:** Your account
- **API version:** `2026-04-22.dahlia`
- **Signing secret:** `whsec_icvaOo…` (saved as `SystemConfig.stripe_webhook_secret`)
- **Subscribed events (8):**
  - `account.updated` (platform-account variant — fires when MyOrbisVoice's own Stripe account changes)
  - `charge.refunded` (drives commission reversal in `handleChargeRefunded`)
  - `charge.dispute.created` (puts commissions on HOLD via `handleChargeDisputeCreated`)
  - `checkout.session.completed` (records affiliate conversions, syncs entitlements)
  - `customer.subscription.deleted` (cancels subscription, demotes tenant to TRIAL)
  - `customer.subscription.updated` (syncs plan changes / status)
  - `invoice.created` (pushes overage line items before invoice finalizes)
  - `invoice.paid` (marks subscription ACTIVE)

### Destination 2 — `empowering-dream` (Connect events)

- **Endpoint URL:** `https://api.myorbisvoice.com/api/webhooks/stripe` (same URL)
- **Events from:** Connected and v2 accounts
- **API version:** `2026-04-22.dahlia`
- **Signing secret:** `whsec_FIhui3…` (saved as `SystemConfig.stripe_webhook_secret_connect`)
- **Subscribed events (1):**
  - `account.updated` (connected-account variant — fires when a partner's Express account onboarding state changes)

The "Events from" field is locked at destination creation in Stripe's modern Workbench — it's why we run two destinations instead of one with both scopes. Our endpoint accepts both via the multi-secret verification loop in `handleStripeWebhook`.

---

## Plans / Prices

Each MyOrbisVoice plan has a Stripe Price ID stored in DB column `Plan.stripePriceId`. Prices are the live IDs from the live-mode Products dashboard.

| Plan code | Display name | Price | Interval | Stripe Price ID lives in |
|---|---|---|---|---|
| `ltd` | LTD (Lifetime Deal) | $497 one-time | ONE_TIME | DB |
| `basic_monthly` | Basic | $197/mo | MONTHLY | DB |
| `pro_monthly` | Pro | $497/mo | MONTHLY | DB |
| `premier_monthly` | Premier | $997/mo | MONTHLY | DB |
| `enterprise_monthly` | Enterprise | $1,997/mo | MONTHLY | DB |

To see the actual `price_…` IDs in production: `SELECT code, "stripePriceId" FROM "Plan";` against the prod DB.

If prices need to be recreated (e.g. account loss + restore), create them in Stripe with the same human prices, then `UPDATE "Plan" SET "stripePriceId" = '<new_id>' WHERE code = '<plan_code>';`.

---

## Reconstruction checklist (worst-case rebuild)

If we ever need to rebuild this Stripe account from scratch:

1. **Activate Connect platform** — both test mode and live mode (separate signups at https://dashboard.stripe.com/connect/accounts/overview and https://dashboard.stripe.com/test/connect/accounts/overview). Fill in the platform profile per the values in this doc.
2. **Set Connect branding** — both modes — per the table above.
3. **Generate API keys** — sk_live, pk_live, sk_test, pk_test from Developers → API Keys.
4. **Re-create Products + Prices** for each of the 5 plans. Set the `stripePriceId` column in DB.
5. **Re-create the 2 webhook destinations** — copy the event lists exactly. Capture the new signing secrets and paste them into Admin → System Settings → Stripe.
6. **Re-create the platform's customer profile and statement descriptor** per the values above.
7. **Update the off-repo secret manager** with the new `sk_live_…`, `pk_live_…`, and the two `whsec_…` values.
8. **Verify** — run the diagnostic from `docs/` or `apps/api/src/lib/stripe.ts` (`bootStripeFromConfig` + `accounts.create({type:'express'})` + balance.retrieve `livemode === true`).

Total reconstruction time: ~1 hour, mechanical.

---

## Day-to-day operations

- **See current configured state in admin UI:** Admin → System Settings → Stripe. Status indicators show whether each secret is configured (boolean — never reveals plaintext).
- **Change keys:** paste new values into the same form. Hydration runs on save.
- **View live deliveries:** dashboard.stripe.com/webhooks → click a destination → Event deliveries tab.
- **Re-send a failed delivery:** Stripe webhook event detail page has a "Send again" button.
- **Test the multi-secret verification:** `apps/api/src/lib/stripe.ts` exports `getWebhookSecrets()` and the test pattern from this session's deploy log shows how to programmatically verify both secrets resolve correctly.
