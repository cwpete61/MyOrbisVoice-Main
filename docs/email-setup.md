# Email Setup (sending + receiving)

Canonical reference for how email works across the two brand domains. Last
verified/fixed **2026-07-01**.

## Domains + roles

| Domain | Role | Sending | Receiving |
|---|---|---|---|
| **myorbisvoice.com** | Voice product, transactional | Resend (`notify@myorbisvoice.com`) | Spacemail (`mx1/mx2.spacemail.com`) ✅ |
| **myorbisresults.com** | Parent brand + **partner** sends | Brevo (partner `<slug>@…`), + SES/Postmark configured | Spacemail (`mx1/mx2.spacemail.com`) ✅ |

Both domains receive on **Spacemail** (Spaceship's mailbox product). DNS is on
**Cloudflare** for both.

## myorbisresults.com — the 2026-07-01 fix

**Symptom:** inbound mail to `@myorbisresults.com` bounced.
**Root cause:** the MX pointed at `mail.myorbisresults.com` → `147.93.183.4`
(Contabo) which was **Cloudflare-proxied** (orange cloud kills SMTP) *and* had
**port 25 closed**. It was never on Spacemail like its healthy sibling
myorbisvoice.com. (Earlier it was a Spaceship pending-verification placeholder
`_dc-mx.<hash>` MX.)
**Fix (Cloudflare):**
- MX → `mx1.spacemail.com` (10) + `mx2.spacemail.com` (10), DNS only. Removed the
  `mail.myorbisresults.com` MX.
- SPF: `v=spf1 include:spf.spacemail.com include:spf.brevo.com ip4:147.93.183.4 ~all`
- DMARC present (`p=none`, rua → Cloudflare dmarc-reports). Consider tightening to
  `quarantine` later (myorbisvoice.com already uses `quarantine`).
- DKIM: Brevo (`brevo1/2._domainkey` CNAME), Resend, Postmark, `default._domainkey`.
- `send.myorbisresults.com` MX → `feedback-smtp.us-east-1.amazonses.com` (SES bounces).

**Note:** a mail host must never be Cloudflare-proxied. `mail/auth/hub/webdisk`
proxied A records can also break cPanel/webmail — separate cleanup.

## Spacemail mailboxes (myorbisresults.com) — plan cap: 5

Created 2026-07-01 (5/5 used, limit reached):
`hello@`, `support@`, `bookings@`, `admin@`, `compliance@`.
Passwords live in the Spacemail panel / owner's password manager — **never in the
repo**.

**Catch-all → `admin@`** (REQUIRED — set in Spacemail domain settings). At the
5-mailbox cap the ~15 partner `<slug>@` addresses + `legal@`/`affiliates@`/
`unsubscribe@`/`orby-system@` are NOT mailboxes and would bounce without it.
Optional: add `legal@`/`affiliates@`/`unsubscribe@` as **aliases** on `admin@`
(free, no slot).

## Addresses the app uses (@myorbisresults.com)

- **System:** `noreply@` (send-only, no mailbox needed), `affiliates@`,
  `compliance@`, `legal@`, `unsubscribe@` (fallback only — real opt-out is the
  one-click URL + `/unsubscribe` page + provider webhooks), `bookings@`.
- **User account:** `orby-system@` (a `User` row).
- **Partners:** `<slug>@myorbisresults.com`, one per partner (dynamic, ~15+).

## ⚠️ Partner-reply ingestion is BROKEN by the Spacemail move

**Design:** partners have an in-app mailbox (`partner-portal/mailbox`). It was fed
by Contabo **Postfix** receiving `*@myorbisresults.com` → catch-all pipe
(`orbis-mail-ingest.sh`) → `POST /api/internal-mail` → matches `<slug>` → inserts
an `Email` row → shows in the partner's mailbox (+ optional forward to their Gmail
when `forwardPlatformEmails`). See `apps/api/src/routes/internal-mail.ts`.

**Now:** mail routes to **Spacemail**, not Contabo Postfix → that pipe never
fires. Prospect replies land in the `admin@` catch-all inbox but do **not** reach
the individual partner or their in-app mailbox.

**Fix (TODO, moderate build):** add an **IMAP poller** that reads the `admin@`
catch-all → parse `To: <slug>@myorbisresults.com` → reuse the existing
`internal-mail` slug-match + Email-insert logic → partner sees the reply in-app
(+ optional Gmail forward). Reuses existing code; only the source changes
(Spacemail IMAP instead of Postfix). Per-address Spacemail forwarding does NOT
scale (partners are created dynamically).

## Verify

- DNS: `dig +short MX myorbisresults.com` → `10 mx1.spacemail.com` + `mx2…`.
- Delivery: email `hello@` (lands in its inbox) + `zzz-test@` (lands in `admin@`
  via catch-all). Both arrive = domain email works.
- Sending stays on Brevo/Resend/SES (authenticated via SPF/DKIM) — unaffected by
  the receiving fix.
