# Email Service Provider (ESP) setup — what you need to do

Phase F.4 ships the email reputation **foundation** on the existing SMTP. The schema, suppression list, bounce-aware MessageLog, admin policy controls, and ESP webhook handlers are all in production now. SMTP keeps working as-is for every existing transactional send.

The next step requires **your action** because it involves account signups, billing, and DNS records on your own domains.

## Why two ESPs

Transactional and bulk live on different reputations:

- **Postmark — transactional only.** Welcome emails, password resets, booking confirmations. Postmark has the best transactional deliverability in the industry. Keeping these on a separate provider means a partner blasting a scraped list (and tanking marketing reputation) can never break your password-reset flow.
- **Resend — bulk + partner sends.** Native sub-account isolation per partner (one bad partner's complaints stay scoped to their reputation, not the whole platform's). Best webhook ergonomics for the bounce/complaint flow we already wired in.

## What I need from you, in order

### 1. Sign up Postmark
1. Go to https://postmarkapp.com → "Get Started"
2. Verify your account
3. Create a Server called `myorbisvoice-transactional`
4. Inside that Server → **API Tokens** → copy the Server Token
5. Go to **Servers** → click your server → **Settings** → enable **Webhook** → URL: `https://api.myorbisvoice.com/api/email-webhooks/postmark` → enable **Bounce**, **Spam Complaint**, **Delivery** event types
6. Under **HTTP Authentication** for the webhook, set Basic auth username + password (anything — record both for me)

### 2. Sign up Resend
1. Go to https://resend.com → "Get Started"
2. Verify your account
3. **API Keys** → create one named `myorbisvoice-bulk` → copy the key
4. **Webhooks** → add endpoint `https://api.myorbisvoice.com/api/email-webhooks/resend` → enable `email.bounced`, `email.complained`, `email.delivered`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 3. DNS records

**On `myorbisvoice.com` (for transactional via Postmark):**

I'll generate the exact DKIM + Return-Path records after you add the sending domain in Postmark. Postmark's dashboard will show:
- A TXT record at `mxauto._domainkey.notify.myorbisvoice.com` (DKIM)
- A CNAME at `pm-bounces.notify.myorbisvoice.com` (Return-Path)

Add a subdomain `notify.myorbisvoice.com` in your DNS first, point it at Postmark per their setup wizard.

**On `myorbisresults.com` (for bulk via Resend):**

Resend's dashboard will give you:
- 3 TXT records for SPF + DKIM
- A CNAME for tracking
- A TXT for DMARC at `_dmarc.mail.myorbisresults.com`

Add a subdomain `mail.myorbisresults.com` in your DNS first.

**Where to add DNS records:** Spaceship (where `myorbisvoice.com` is registered) → cPanel → Zone Editor.

### 4. Send me the credentials

Once you have all four:
- Postmark Server Token
- Postmark webhook Basic auth username:password
- Resend API key
- Resend Webhook Signing Secret (`whsec_...`)

I'll add them to:
- Postmark token → SystemConfig `email.postmark.server_token`
- Resend key → SystemConfig `email.resend.api_key`
- Postmark basic auth → environment variable `POSTMARK_WEBHOOK_BASIC_AUTH` (in `/opt/myorbisvoice/infrastructure/docker/.env.prod`)
- Resend signing secret → environment variable `RESEND_WEBHOOK_SECRET`

Then I'll swap the `email.service.ts` transport to use Postmark for transactional and Resend for bulk — same `sendEmail()` API, just a different backing transport. Existing call sites don't change.

## What works today, without ESP

- Suppression list (manual entries via /admin or /partner/suppression endpoints)
- Admin policy page at `/admin/email-policy`
- Per-partner overrides on the admin partner detail page (coming next)
- `sendEmail()` checks suppression before sending — global hard-bounce list is consulted for every send

## What needs ESP to fully work

- **Bounce auto-suppression** — without webhooks we never learn an address is dead, so the suppression list won't auto-grow
- **Complaint auto-suspension** — same; complaints arrive async only
- **Per-partner reputation evaluation** — depends on real bounce/complaint data
- **Sub-account isolation per partner** — Resend-specific, kicks in after ESP swap

## Cost expectation

- Postmark: free for 100 emails/month, then $15/mo for 10k. You'll be on the free tier for a while.
- Resend: free for 3,000 emails/month + 100 emails/day. Then $20/mo for 50k. You won't hit the paid tier until partners are actively bulk-sending.

Both bill monthly, both have a no-card free tier you can start with.

## Tell me when ready

Reply with the four credential values when you have them and I'll wire it all up in one push. No DNS waiting on my end — that's all between you and your registrar.
