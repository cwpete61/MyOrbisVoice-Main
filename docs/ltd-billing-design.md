# LTD Plan Billing Design

Decision recorded 2026-05-06. Not yet implemented.

## Current state (unchanged)

LTD = $497 one-time payment. `Plan.interval = 'ONE_TIME'`. Stripe checkout
runs in `mode: 'payment'`. Entitlements granted via
`syncEntitlementsFromPlan` on `checkout.session.completed`.

## Target state

LTD = **$497 one-time** (lifetime access) + **$24.99/mo recurring** (token
coverage), bundled in a single Stripe Checkout session. Trial period of 30
days on the recurring portion so month 1 charges $497 only, month 2+ charges
$24.99/mo until the subscription is cancelled.

### Cancellation policy (decided)

**The account stays open.** When a customer cancels the $24.99/mo recurring,
the ONLY thing that's affected is the recurring charge — they stop being
billed. Nothing else changes:

- LTD entitlements remain active forever (it's a lifetime deal)
- AI features stay enabled (calls, widget, agents)
- Dashboard access unchanged
- Conversations / appointments / data — all retained

Implication: the platform absorbs token costs for any LTD customer who
cancels the recurring. This is intentional — the "lifetime" promise is
honored as a hard guarantee. The recurring is offered as a way for honest
customers to cover their own usage costs, not as a gate on access.

### Implementation outline

1. **Stripe Dashboard** — add a $24.99/mo recurring price to the existing
   LTD product (`prod_URJmRKtxIeAGcM` or similar; verify the actual ID at
   build time). Note its `price_…` ID.

2. **DB schema** — add `Plan.stripeRecurringPriceId` (nullable). For LTD,
   populate with the new price ID. Other plans leave it null.

3. **Checkout flow** (`apps/api/src/services/stripe.service.ts`):
   - LTD session switches from `mode: 'payment'` to `mode: 'subscription'`
   - `line_items` includes BOTH:
     - The existing $497 one-time price (`stripePriceId`)
     - The new $24.99 recurring price (`stripeRecurringPriceId`)
   - `subscription_data.trial_period_days: 30` so the recurring doesn't
     charge until month 2

4. **Webhook handler** (`handleCheckoutCompleted`):
   - LTD will now arrive as `mode: 'subscription'`, hits the recurring
     branch automatically
   - Existing entitlement-grant logic via `upsertSubscription` works
     unchanged

5. **Cancellation handler** (`customer.subscription.deleted`):
   - Currently: marks subscription canceled + (presumably) syncs
     entitlements to a downgraded state
   - For LTD: must NOT downgrade entitlements. The customer keeps LTD
     access regardless.
   - Add LTD-specific branch that audits the cancellation event but skips
     the entitlement clear

6. **Frontend pricing display:**
   - Marketing site: "$497 one-time + $24.99/mo for token usage (cancel
     anytime, lifetime access remains)"
   - In-app `/billing` plan card: same copy
   - i18n EN+ES

7. **Tooltips / help text** on the LTD plan card explaining the model so
   it's clear what they're paying for.

### Open implementation question

Stripe Checkout in `mode: 'subscription'` may require ALL line items to be
recurring prices, with one-time charges added via
`subscription_data.add_invoice_items` instead of as a regular line item.
Need to verify which path Stripe v2026-04-22.dahlia accepts. Two options:

- **Option A:** mixed line items (one-time + recurring) directly. Simpler if
  it works.
- **Option B:** recurring line item + `subscription_data.add_invoice_items`
  for the $497. Slightly more complex but well-documented.

Verify at build time with a test checkout in Stripe test mode before
committing to one path.

### What this does NOT do

- Doesn't gate AI features behind the recurring payment
- Doesn't suspend tenants who cancel
- Doesn't auto-downgrade LTD entitlements on cancellation
- Doesn't grandfather any existing LTD customers (zero exist as of
  2026-05-06)

The lifetime promise is honored as a strict promise.
