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

## Partner-reply ingestion — IMAP poller (BUILT 2026-07-01, commit `5a7294b`)

**Design:** partners have an in-app mailbox (`partner-portal/mailbox`), fed by a
parse → match `<slug>` → insert `Email` row (+ optional Gmail forward when
`forwardPlatformEmails`) pipeline. That logic now lives in
`apps/api/src/services/mail-ingest.service.ts` (`ingestRawMessage`), shared by
both the legacy `POST /api/internal/mail/ingest` route and the poller.

**The poller** (`apps/api/src/jobs/imap-poller.ts`, `startImapPollerJob` at boot):
every 2 min it logs into the Spacemail **catch-all** mailbox over IMAP, fetches
UNSEEN messages, runs each through `ingestRawMessage` (idempotent by messageId),
and marks them Seen. Replaces the dead Contabo Postfix pipe. Per-address Spacemail
forwarding was rejected — partners are created dynamically, so catch-all + IMAP is
the only scalable path.

**To ACTIVATE (config, not code):**
1. Spacemail: set **catch-all → `admin@`** (so partner `<slug>@` mail lands there).
2. Admin → System Settings → **"Inbound Mail (partner replies)"** card: enter
   `imap.spacemail.com` / `993` / `admin@myorbisresults.com` / the mailbox password.
   Keys: `imap_host`/`imap_port`/`imap_user`/`imap_password` (password encrypted).
3. Within 2 min the poller ingests; a prospect reply to `<slug>@` appears in that
   partner's in-app mailbox. Unconfigured → the job idles (logs once, no crash).

## Verify

- DNS: `dig +short MX myorbisresults.com` → `10 mx1.spacemail.com` + `mx2…`.
- Delivery: email `hello@` (lands in its inbox) + `zzz-test@` (lands in `admin@`
  via catch-all). Both arrive = domain email works.
- Sending stays on Brevo/Resend/SES (authenticated via SPF/DKIM) — unaffected by
  the receiving fix.
