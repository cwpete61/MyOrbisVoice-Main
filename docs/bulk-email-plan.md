# Plan — Bulk Email (cold-email engine)

**Status:** Phase 4 complete + deployed (2026-05-19). Next: Phase 5.

## Phase 4 — DONE, deployed 2026-05-19

- `cold-email-sequencer.service` — `runSequencerTick()` walks every ACTIVE
  campaign's enrolled leads through the touch sequence on schedule
  (`currentTouch` / `nextTouchAt`). Sends go through `sendColdEmail`, so the
  cap / window / drip gate is reused, not reimplemented.
- `jobs/cold-email-sequencer.ts` — runner, 5-minute tick, registered in `index.ts`.
- Lead outcomes: SENT advances, SUPPRESSED/INVALID stops the lead, BLOCKED/
  FAILED retries next tick; campaign auto-completes when no lead is in flight.
- Engagement tracking (reply/booking stops a sequence): the model + sequencer
  already honor REPLIED/BOOKED status — setting them needs inbound-mail
  detection, carried into Phase 5.

## Phase 3 — DONE, deployed 2026-05-19

- Models: `ColdEmailCampaign`, `ColdEmailCampaignTouch`, `ColdEmailCampaignLead`
  (the enrollment row carries `currentTouch` + `nextTouchAt` — Phase-4-ready).
- `cold-email-campaign.service` — create/list/get/update campaign (activation
  gated on ≥1 touch + ≥1 lead), save touch sequence, enroll/remove accepted
  leads, eligible-leads pool.
- Campaign routes added to `routes/cold-email.ts` — full CRUD + touches +
  leads + eligible-leads.
- Campaign-builder UI — `/partner-portal/bulk-email/campaigns`: campaign list,
  builder (name, touch-sequence editor, lead picker, activate/pause). Bilingual.
- "Campaigns →" link on the Bulk Email page.
- Verified live: routes mounted, page serves, schema pushed.

## Phase 2 — DONE, deployed 2026-05-19

- `ColdEmailSend` model — send log (cap count, unsubscribe token, bounce
  reconciliation). Schema pushed.
- `cold-email.service` — `sendColdEmail()` full pre-send gate (active domain →
  policy → send window → daily cap → drip → suppression → Reoon), SES send,
  CAN-SPAM footer (postal address + unsubscribe), `List-Unsubscribe` header.
- `unsubscribeByToken` + public `/api/public/unsubscribe` (GET page + one-click
  POST) → suppression list.
- `recordSesEvent` + auto-pause — hard bounce / complaint → suppress + pause
  the partner if rates cross policy thresholds.
- `routes/cold-email.ts` — partner send route. `routes/webhooks-ses.ts` —
  SNS-signed SES event webhook.
- AWS wired: SNS topic `myorbisvoice-ses-events`, configuration set
  `my-first-configuration-set` + `sns-bounce-complaint` event destination,
  confirmed HTTPS subscription to the webhook.
- Verified live: routes mounted, subscription CONFIRMED, event destination
  enabled (BOUNCE + COMPLAINT).

Real sending at volume still waits on SES production access (case
177918023400963 — pending AWS review of the use-case reply).

## Phase 1 — DONE (code), deployed 2026-05-18

- `PartnerSendingDomain` model + `SendingDomainStatus` enum — schema pushed.
- Provider services: `cloudflare.service` (DNS zone + SPF/DKIM/DMARC),
  `aws-ses.service` (domain identity + Easy DKIM), `route53-domains.service`
  (availability, price, register, NS update).
- `sending-domain.service` — provisioning state machine; `sending-domain-runner`
  background job (2-min tick); idempotent + retry-safe.
- `partner-billing.chargePartnerForSendingDomain` — one-time card charge.
- `routes/sending-domain.ts` — partner routes (check / create+pay / pay / card-setup / cancel).
- Wizard UI on the Bulk Email page — bilingual; name → check → pay → live progress.

**Blockers — status 2026-05-18:**
- ✅ AWS account upgraded Free→paid — Route 53 registration works.
- ✅ Registrant contact set — `domain_registrant_email` (support@myorbisvoice.com)
  + `domain_registrant_phone` (+1.4043830220).
- ⏳ SES production access — pending (~24h AWS approval). Only blocks Phase 2
  *sending*; domain provisioning (Phase 1) works in the SES sandbox.

The Phase 1 domain wizard is now functionally ready end-to-end. First real
registration costs ~$15 (partner's card).

## Phase 0 — DECIDED (2026-05-17)

- **ESP:** Amazon SES. Cold-email-capable, per-domain DKIM identities,
  SNS bounce/complaint webhooks, ~$0.10/1k. New accounts start sandboxed
  — production-access request pending (~24h AWS approval).
- **Registrar:** AWS Route 53 Domains (`RegisterDomain` API). Same AWS
  account as SES — no third provider. Cloudflare hosts DNS only.
- **Cloudflare:** master account + API token stored + verified.
- **Domain billing:** the partner's card (Stripe, at the wizard's pay
  step). Mirrors the phone-number billing model.
- **Automation level:** still open — decide at Phase 3/4.

Drafted 2026-05-17.

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
