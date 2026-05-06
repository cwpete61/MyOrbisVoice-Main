# Runbook — Real Partner Live Stripe Connect Onboarding Test

**Goal:** before opening the partner program to real partners, take ONE trusted person through the full live Stripe Connect Express onboarding flow with their real SSN, real bank, real KYC. Find any config/branding/UX issue NOW with one cooperative person, not when 50 partners are stuck mid-flow.

This is launch-blocker #3. Closes the moment the partner's `payoutsEnabled` flips to `true`.

## Who's a good first partner

Pick one person you trust to share live SSN + bank info with Stripe (not us — Stripe). Good candidates:
- You yourself (cleanest — full control, can iterate fast)
- A co-founder
- A close customer who'll benefit from the partner program anyway

**Don't pick:** anonymous test accounts, friends-of-friends, anyone who'd be put off by sharing real KYC for a first run.

## Prep — 2 minutes

1. **Confirm preflight is green:** `pnpm preflight` should report 8/8 ✓.
2. **Confirm the partner has an MyOrbisVoice partner account:**
   - If not, they sign up at https://app.myorbisvoice.com/partner-portal/signup (auto-approved).
   - If yes, confirm their email matches what they'll use to log in.
3. **Open the live monitor in one terminal:**
   ```
   pnpm watch-partner-onboarding <partner-email>
   ```
   This polls their onboarding state every 3 seconds and tails the API logs filtered for partner/connect activity.
4. **Open Stripe Dashboard in another browser tab:** https://dashboard.stripe.com/connect/accounts (live mode). You'll see their connected account appear here once Stripe creates it.

## During — partner-side instructions

Send these to the partner verbatim:

> 1. Go to https://app.myorbisvoice.com/partner-portal/login
> 2. Sign in with your MyOrbisVoice partner credentials (username + password you set when you signed up).
> 3. Click **Payouts** in the left sidebar.
> 4. Click the teal **Connect now** button.
> 5. Your browser will jump to a Stripe-hosted onboarding page. **Do not navigate to dashboard.stripe.com directly — only follow the redirect.**
> 6. Stripe will ask for your **mobile phone number** first, send a 6-digit SMS code. Enter it.
> 7. Provide your legal name, DOB, address, SSN, bank routing + account, accept terms.
> 8. After you submit, you'll be redirected back to MyOrbisVoice automatically. The Payouts page should show "Verified — payouts enabled."

**If they get stuck at any step**, check the watch-partner-onboarding terminal — most issues show up there in real time.

## What to watch for in the monitor output

| Output line | What it means | Action |
|---|---|---|
| `state change: stripeConnectAccountId: null → acct_…` | Partner clicked Connect now → Stripe account created | Normal — keep watching |
| `state change: detailsSubmitted: false → true` | Partner finished filling out the Stripe form | Stripe is now verifying — wait |
| `state change: payoutsEnabled: false → true` | ✅ Onboarding complete | Done — close the watcher |
| `disabledReason: … → requirements.past_due` | Partner abandoned mid-flow, requirements aged | Re-issue an AccountLink or roll the account |
| `disabledReason: … → requirements.currently_due` | Stripe needs more info from partner | Partner gets an email; resume from MyOrbisVoice "Update payout details" |

## Expected timing

- Phone SMS verification: 30 seconds
- Form fill: 5-10 minutes
- Stripe internal verification: 30 seconds to 5 minutes
- **Total: 6-15 minutes** for a smooth flow

If it's been over 30 minutes without `payoutsEnabled: true`, the watcher times out automatically. Investigate via Stripe Dashboard → Connected accounts.

## What "passes the test"

After the test, all of these should be true:

- [ ] `payoutsEnabled` = true on the AffiliateAccount
- [ ] `detailsSubmitted` = true
- [ ] `chargesEnabled` = true
- [ ] `disabledReason` = null
- [ ] The partner's account appears in Stripe Dashboard → Connect → Connected accounts
- [ ] The Payouts page in MyOrbisVoice shows "Verified — payouts enabled" + "Update payout details" button
- [ ] No errors in the API logs during the flow
- [ ] The Connect branding (MyOrbisVoice logo + teal color) was visible on the Stripe-hosted onboarding page

If all 8 pass: launch-blocker #3 is closed. The partner program is ready for real partners. Move that item to ✅ Closed in `docs/launch-blockers.md`.

## What if something fails

| Symptom | Likely cause | Recovery |
|---|---|---|
| "Connect now" button shows alert "You can only create new accounts if you've signed up for Connect" | Connect platform deactivated for the live key | Check https://dashboard.stripe.com/settings/connect → reactivate |
| Stripe form shows generic "Stripe" branding instead of MyOrbisVoice | Connect branding not set in live mode | Stripe Dashboard → Settings → Connect → Branding (live mode) |
| Partner stuck after "Submit" — never returns to MyOrbisVoice | Stripe redirect URL mismatch | Check `/api/affiliate/connect/onboard` `returnUrl` value |
| Watcher shows `payoutsEnabled: false` even after partner clicks back | Stripe-side verification still pending | Wait 5 min, then check Stripe Dashboard → Connected accounts |
| "Stripe webhook signature" errors in API logs | Webhook signing secret mismatch | Compare prod secret to Stripe Dashboard webhook secret; rotate if needed |

## Cleanup if the test partner backs out

If the partner decides not to continue and wants their data removed:

```
ssh root@147.93.183.4 'docker exec myorbisvoice-api node -e "
const { deletePartner } = require(\"/app/apps/api/dist/services/affiliate.service.js\");
const { bootStripeFromConfig } = require(\"/app/apps/api/dist/lib/stripe.js\");
const { prisma } = require(\"/app/apps/api/dist/lib/prisma.js\");
(async () => {
  await bootStripeFromConfig();
  const u = await prisma.user.findUnique({ where: { email: \"<partner-email>\" }, include: { affiliateAccount: true } });
  if (u?.affiliateAccount) {
    const r = await deletePartner(u.affiliateAccount.id, { reason: \"Live-partner test cleanup — partner withdrew\" });
    console.log(r);
  }
})();
"'
```

This calls the upgraded `deletePartner` service path: full erasure across DB + Stripe Connect + audit log without PII.
