# Plan — Bulk Email (cold-email engine)

**Status:** plan / awaiting Phase 0 decisions. Drafted 2026-05-17.

The Bulk Email system = cold-email outreach to the businesses a partner
finds in Leads Search, carried through to a booking. This is "idea #2"
from the lead-engine work — the *Dynamic Lead-gen → Booking* funnel.
**Distinct from the transactional Mailbox**, which is reply-only.

---

## Principles (decided)

- **Per-partner sending domains** — true reputation isolation. One
  partner's spam complaints can never touch another's. Each partner who
  opts into cold email gets a dedicated `.com`.
- **Cloudflare** for domain registration + DNS. (Confirm programmatic
  new-`.com` registration at build time; if limited, Namecheap handles
  the register step, DNS stays Cloudflare.)
- **50 emails/day cap per partner** — already exists in the
  `email-bulk-policy` system, alongside send-window + drip-interval.
- **Cold email only.** Never the transactional stream (would burn
  booking-confirmation deliverability). Never Gmail (ToS violation +
  partner-account-suspension risk).
- **CAN-SPAM always** — unsubscribe link, instant opt-out honoring,
  suppression list, partner postal address in the footer.
- **Compliance wall (already enforced)** — scraped leads are
  cold-email-only: promoted Contacts are born opted-out of voice + SMS.

## Already built — the head start

- Bulk Email nav tab + intro page (red nav, deployed).
- `email-bulk-policy` — per-partner `emailDailyCap` (default 50),
  send window, drip interval, `emailBulkEnabled` admin gate,
  complaint/bounce auto-pause.
- `email-suppression` + `email-webhook` scaffolding (in tree).
- AI email-intro generator (in the lead engine).
- Email verification (Reoon) integration exists.
- Lead engine — discover, enrich, review, promote to CRM.

## Phase 0 — decisions + accounts (blocks everything)

- **Pick the ESP** — the cold-email-capable sending provider. HARD
  blocker: the wizard's DKIM records come from it.
- **Cloudflare account + API token** — and confirm programmatic
  registration (else Namecheap for the register step).
- **Who pays the ~$12/yr domain** — recommend the partner's card
  (mirror the phone-number billing model).
- **Automation level** — fully automated lead→email→booking, or
  partner approves each send. Shapes Phase 4.

## Phase 1 — sending infrastructure (the domain wizard)

- `PartnerSendingDomain` model — partnerId, domain, status, registrar/
  zone refs, DNS state, verified, warmup state.
- Cloudflare API client — register domain, create DNS zone, write
  SPF/DKIM/DMARC.
- ESP integration — domain verification + DKIM records.
- `provisionSendingDomain` service — register → DNS → verify, async +
  status-tracked.
- Billing — charge the partner for the domain (Stripe, mirroring
  `provisionPartnerNumber`).
- Warmup runner — background gentle ramp to the 50/day cap.
- Wizard UI — the Bulk Email page's "Set up sending domain" CTA goes
  live: name → pay → provision → progress → done.
- **Deliverable:** a partner can get a verified, warming, dedicated
  sending domain.

## Phase 2 — sending engine (one compliant email)

- Cold-email send path — one email through the partner's domain via
  the ESP.
- CAN-SPAM — unsubscribe link + token + public unsubscribe page;
  suppression check before every send; partner postal address footer.
- Consume `email-bulk-policy` — daily cap (50), send window, drip.
- Reoon verification before each send — drop bounces.
- ESP bounce/complaint webhooks → suppression + auto-pause.
- **Deliverable:** the system sends one compliant, capped, verified
  cold email from a partner domain.

## Phase 3 — campaigns + sequences

- Cold-email campaign model — a partner picks accepted leads and builds
  a touch sequence (touch 1 = AI intro, plus follow-ups).
- Campaign UI in the Bulk Email section.
- **Deliverable:** a partner can build a multi-touch cold-email campaign.

## Phase 4 — the sequencer (the "dynamic" engine)

- Background runner — advances each enrolled lead through the sequence
  (send → wait → no reply → next touch), respecting cap/window/drip.
- Engagement tracking — opens, clicks, replies. A reply or a booking
  stops the sequence.
- **Deliverable:** campaigns run automatically.

## Phase 5 — lead-gen → booking (close the funnel)

- Email CTA → the partner's booking page (`/book/<slug>`) or their Orby.
- Track lead → emailed → clicked → booked; conversion reporting.
- **Deliverable:** the full Dynamic Lead-gen → Booking funnel —
  discover → outreach → booking on the partner's calendar.

## Recurring cost (needs authorization)

- Domain registration — ~$12/yr per *actively cold-emailing* partner,
  provisioned on demand (not every partner).
- The ESP — usage / subscription cost.
- Reoon verification — per-check cost.

## Sequencing

Build 1 → 5 in order; each phase ships something usable. Phase 1 is
gated on Phase 0's ESP pick + Cloudflare account. Phases 4-5 depend on
the automation-level decision.
