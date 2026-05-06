# Comp-Codes Setup — Stripe Dashboard

One-time setup. Do this **before** generating any comp codes from
`/admin/comp-codes`, or the admin UI will show "no coupon configured for
{tier}" and the generators stay disabled for those tiers.

The system architecture (why these specific Stripe objects):

- **Coupon** = the discount rule. We need 4 — one per tier (Basic, Pro,
  Premier, Enterprise). Each one is `100% off forever` and restricted to its
  tier's product via `applies_to`. The `applies_to` is the safety net — a
  Premier coupon physically cannot be applied to an Enterprise checkout.
- **Promotion Code** = the redeemable string a recipient types in. Generated
  by the admin UI per giveaway, attached to the matching tier's coupon,
  `max_redemptions: 1` (single-use), with metadata for recipient tracking.

LTD is intentionally **not** part of this system. LTD is a limited-slot
lifetime offer; we do not comp it.

---

## Step 1 — Find the 4 product IDs in Stripe

Navigate to <https://dashboard.stripe.com/products>. You should see 5
products created from the price seed:

- LTD
- Basic
- Pro
- Premier
- Enterprise

For **each of the 4 tiers we comp** (Basic, Pro, Premier, Enterprise — *not*
LTD), click the product and copy the `prod_…` ID from the right rail. Set
them aside; you'll paste each one into a coupon's `applies_to` in step 2.

---

## Step 2 — Create 4 coupons

For each of the 4 tiers, navigate to
<https://dashboard.stripe.com/coupons> and click **+ New**, filling the form
exactly like this:

| Field | Value |
|---|---|
| Type | Percentage discount |
| Percent off | `100` |
| Duration | Forever |
| ID (auto-generated) | leave as-is |
| Name | `Comp - Basic` (or `Pro` / `Premier` / `Enterprise`) |
| Apply to specific products? | **Yes** → select the matching tier product |
| Max redemptions | leave blank (unlimited at the coupon level — we cap per *promotion code* with `max_redemptions: 1`) |
| Redeem by date | leave blank |
| **Metadata** | Add key `tier` with value `BASIC` (or `PRO`, `PREMIER`, `ENTERPRISE` — uppercase, exact match) |

**The `metadata.tier` value is critical** — that's how our admin UI finds
the right coupon when you click "Generate" on a tier. If the tier value is
mismatched or missing, the admin UI will show that tier as unconfigured.

Click **Create coupon**. Repeat for all 4 tiers.

---

## Step 3 — Verify in admin

1. Navigate to <https://app.myorbisvoice.com/admin/comp-codes>.
2. The "Setup required" banner should disappear once all 4 coupons exist.
3. All 4 generator cards (Basic, Pro, Premier, Enterprise) should be enabled
   and ready to generate.
4. If any tier still says "Coupon not configured for this tier", re-check
   step 2 for that tier — the most common gotcha is metadata: the key must
   be exactly `tier` (lowercase) and the value must be exactly `BASIC` /
   `PRO` / `PREMIER` / `ENTERPRISE` (uppercase).

The system caches coupon lookups for 60 seconds, so changes in Stripe
Dashboard show up in the admin UI within ~1 minute.

---

## Step 4 — End-to-end test (recommended once)

1. In `/admin/comp-codes`, fill the **Basic** generator: any test recipient
   name + email. Click "Generate code". Copy the resulting code (e.g.
   `BASIC-X7Q9F2`).
2. Open an incognito browser window. Sign up a new test tenant with a fresh
   email.
3. Go to `/billing` and click "Choose plan" on Basic.
4. On the Stripe Checkout page, click "Add promotion code" and paste the
   code. You should see the line-item total drop to `$0.00`.
5. Stripe should skip card collection (because of the `payment_method_collection: 'if_required'` flag we set on the session). Complete checkout.
6. The test tenant should now have Basic-tier entitlements active. Verify
   in `/billing` (subscription card shows Basic) and on `/admin/tenants`
   for that tenant.
7. Back in `/admin/comp-codes`, the row for that code should now show
   status **Redeemed**.

If any step fails, check API logs and the AuditLog table:
- `admin.comp_code.generated` action confirms the code was created
- `billing.checkout_completed` action confirms the redemption webhook fired
- `system.error.unhandled` will surface any 500-level issues during
  redemption

---

## Step 5 — When you give a code away

Workflow per giveaway:

1. Navigate to `/admin/comp-codes`.
2. Pick the tier, fill in the recipient's name + email + (optional) purpose.
3. Click "Generate code".
4. Copy the displayed code and send it to the recipient by email.
5. The recipient signs up at `app.myorbisvoice.com`, picks the matching
   tier on `/billing`, enters the code on Stripe Checkout, and gets the
   plan for $0.

You can disable an unredeemed code at any time via the **Disable** button
in the table. Disabled codes are permanent — Stripe doesn't allow
re-enabling. If you need a new code for the same recipient, generate a
fresh one.

---

## What stays the same as a normal paid sub

The redeemed comp code creates a real Stripe subscription (just at $0). All
the existing subscription infrastructure works exactly as it does for paid
customers:

- Audit log entries (`billing.checkout_completed`, `billing.invoice_paid`,
  `billing.subscription_updated`)
- Entitlement sync from plan → tenant
- Stripe Billing Portal access for the customer to manage / cancel
- Subscription lifecycle webhooks (`customer.subscription.deleted` if the
  comp recipient cancels)
- Affiliate-attribution if the customer signed up through a partner link
  (`recordConversion` fires normally, with conversion value = $0 — no
  commission earned, but the conversion is tracked)

If you ever convert a comp customer to paid, they go through the regular
upgrade flow — no special handling needed.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin UI shows "Setup required" for all 4 tiers | Stripe API key not configured | Set `STRIPE_SECRET_KEY` in Admin → System Settings |
| Admin UI shows "Setup required" for *some* tiers only | Coupon not created or `metadata.tier` mismatch | Re-verify step 2 for the missing tiers |
| Recipient enters code at checkout, gets "this code can't be applied to your purchase" | The recipient picked a different tier than the code allows (e.g. Premier code on a Basic checkout) | Tell them to pick the matching tier; or generate a code for the tier they actually want |
| Recipient enters code at checkout, gets "this code is no longer valid" | Code already redeemed (single-use), or you disabled it | Generate a new code |
| `/admin/comp-codes` is slow | Stripe API round-trip per page load | First load only — the coupon lookup is cached for 60s after that |
| Code shows as "Active" in admin UI but recipient says it was used | 60-second cache; refresh the page | Wait 60s and refresh |
