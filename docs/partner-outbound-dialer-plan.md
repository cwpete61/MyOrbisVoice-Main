# Partner Outbound Dialer — Plan (backlog #19)

Status: **PLAN — approved to build this week (2026-06-28)**. Owner: Crawford.
Scope: let **partners (affiliates)** dial out through Twilio to work directory
leads, without exposing the platform to TCPA / carrier-reputation risk.

---

## TL;DR / the decision

Build it in **two phases, compliance-first**:

- **Phase 1 — Human Power-Dialer (ship this week).** Partner clicks "Call",
  Twilio bridges the **partner's own phone** to the lead. A **human** (the
  partner) talks. Low TCPA risk: human-initiated, partner is the caller, no
  prerecorded/AI voice to a cold party. This is the real "partners can dial
  out" answer.
- **Phase 2 — AI Auto-Dialer (gated, deferred).** AI agent auto-calls leads.
  **Only legal with prior express consent** — and directory leads are *born*
  `optedOutVoice`. So Phase 2 only dials leads who later granted voice consent,
  behind an admin entitlement + legal sign-off. Not this week.

We do NOT auto-AI-cold-call directory leads. That's the wall #19 exists for.

---

## Why a fork (the compliance reality)

The partner calls **third parties** (directory businesses), so liability lands
on the **platform**, not the partner. Two facts force the split:

1. **Directory leads are cold.** `partner-crm.ts` creates them
   `optedOutVoice = true` by birth ("Cold lead — no consent. Born opted out of
   voice + SMS"). The partner cold-CALLS to *earn* permission.
2. **TCPA treats AI/prerecorded voice to a non-consented number as the high-risk
   category** (statutory damages per call). A **human** dialing a business line
   they researched is the ordinary, low-risk case.

So: human dialing = fine now. AI dialing = consent-gated, later.

---

## What already exists (reuse, don't rebuild)

| Capability | Where | Reuse for partner |
|---|---|---|
| Partner → Twilio one-off call | `placeEvalTestCall()` `outbound.service.ts:267`, called at `partner.ts:976` | Pattern for partner-scoped origination |
| Partner owns a Twilio number | `provisionPartnerNumber` `partner.ts:493`; `PhoneNumber{partnerId,e164Number,purchaseStatus}` | The FROM number for the bridge |
| Consent / DNC flags | `Contact.optedOutVoice`/`optedOutVoiceAt`, `MessagingConsent`, `OptOutLog` | The DNC gate before any dial |
| Tenant dialer engine | `outbound-campaign.service.ts` (CRUD), `outbound.service.dispatchPendingCalls()`, `jobs/campaign-scheduler.ts` (optimistic PENDING→IN_PROGRESS claim) | Phase 2 partner auto-dial |
| Admin policy gate | bulk-email `getPlatformPolicy`/`setPlatformPolicy` + per-partner `PartnerBulkEmailPolicy` (enabled/suspended/dailyCap/window) | Template for `PartnerVoicePolicy` |
| Manual cold-call script | `components/ColdCallConsole.tsx` (tab in partner /campaigns) | Phase 1 lands the dialer button here |

`OutboundCampaign` + `OutboundCallAttempt` are both keyed `tenantId` only —
that's the one structural change for Phase 2 (add a partner ownership path).

---

## Phase 1 — Human Power-Dialer (this week)

**Flow (Twilio "click-to-call bridge"):**
1. Partner is on a directory lead (cockpit / ColdCallConsole / contact page).
2. Clicks **Call**. API `POST /api/partner/dialer/call { contactId }`.
3. Server checks the **compliance gate** (below). If pass:
   `client.calls.create({ to: <partner's own phone>, from: <partner Twilio #>,
   url: /webhooks/twilio/partner-dial/twiml?contactId=... })`.
4. Partner's phone rings first. On answer, TwiML `<Dial>`s the **lead**.
   Partner ↔ lead connected, partner speaks.
5. Status callback logs the call (`PartnerCallLog`), call window enforced,
   recording optional (with disclosure).

**Why dial the partner first:** keeps the partner the human initiator, uses
their number as FROM (caller-ID they own), and never plays AI audio to the lead.

**Compliance gate (server-side, every call):**
- `contact.optedOutVoice === true` AND lead is on a **federal/state DNC**? →
  for a *human* business-to-business call this is generally permissible, but we
  still **block if the contact explicitly opted out of voice** (`OptOutLog`),
  and respect a per-partner DNC list.
- **Call-window**: only between policy `callWindowStartH`–`EndH` in the **lead's
  timezone** (reuse the timezone approach from `twilio-inbound.service.ts`
  `isWithinBusinessHours`). Hard block outside 8am–9pm local default.
- **Per-partner daily cap** (`PartnerVoicePolicy.dailyCap`).
- **Partner has a provisioned, APPROVED Twilio number** + voice capability.
- **Policy enabled + not suspended** (admin gate, mirrors bulk-email).
- Log every attempt + outcome to `PartnerCallLog` (audit).

**Data model (new):**
```prisma
model PartnerVoicePolicy {        // per-partner gate, mirrors PartnerBulkEmailPolicy
  partnerId        String   @id
  enabled          Boolean  @default(false)
  suspended        Boolean  @default(false)
  suspendedReason  String?
  dailyCap         Int      @default(50)
  callWindowStartH Int      @default(8)   // lead-local
  callWindowEndH   Int      @default(21)
  recordCalls      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model PartnerCallLog {            // audit + daily-cap counting + outcomes
  id             String   @id @default(uuid())
  partnerId      String
  contactId      String?
  providerCallSid String? @unique
  fromNumber     String
  toNumber       String
  status         String            // initiated/ringing/answered/completed/failed/no-answer
  outcomeCode    String?           // booked / callback / not-interested / voicemail / bad-number
  durationSec    Int?
  recordingUrl   String?
  startedAt      DateTime?
  endedAt        DateTime?
  createdAt      DateTime @default(now())
  @@index([partnerId, createdAt])
}
```

**API (new, partner-scoped via existing partner auth):**
- `GET  /api/partner/dialer/policy` — partner sees their gate (enabled/cap/window).
- `POST /api/partner/dialer/call { contactId }` — bridge call (gate enforced).
- `POST /api/partner/dialer/outcome { callLogId, outcomeCode, note }` — log result → advances CRM contact.
- `POST /api/webhooks/twilio/partner-dial/twiml` — `<Dial>` the lead.
- `POST /api/webhooks/twilio/partner-dial/status` — status callback → `PartnerCallLog`.

**Admin API (mirror bulk-email policy):**
- `GET/PUT /api/admin/partners/:id/voice-policy` — enable/suspend/cap/window.
- Surface in storefront admin partner board (the same place as bulk-email gate).

**UI:**
- `ColdCallConsole.tsx` — add a **Call** button (was script-only) that hits
  `/dialer/call`, shows live status, then an **outcome** picker → logs + advances
  the CRM contact. Keep the research-first script above it.
- Directory-leads + contact pages — upgrade the `tel:` link to an optional
  "Call via MyOrbisVoice" (bridge) when policy enabled; keep `tel:` fallback.
- Bilingual: all new strings EN + ES (`pnpm i18n:check`).

**Effort:** ~1–1.5 days. Origination + numbers + consent flags already exist;
this is the bridge TwiML, the gate, two models, the partner+admin routes, and
the ColdCallConsole button.

---

## Phase 2 — AI Auto-Dialer (deferred, consent-gated)

Reuse the tenant engine, partner-scoped:
- **Generalize ownership.** Add `partnerId String?` to `OutboundCampaign` +
  `OutboundCallAttempt` (or an `ownerType`/`ownerId` pair) so the scheduler can
  claim partner enrollments. Keep `tenantId` nullable-or-paired.
- **Scheduler** (`campaign-scheduler.ts`) already claims PENDING optimistically
  — extend `buildContext` + dispatch to resolve partner FROM number + partner
  AI script.
- **Hard consent gate:** auto-dial ONLY contacts with a recorded
  `MessagingConsent` voice opt-in (NOT the cold `optedOutVoice` default). No
  consent → not enrolled, full stop.
- **Entitlement:** new admin flag, off by default, legal sign-off required.
- AI script = the eval/permission ask (reuse eval-testcall TwiML shape), not a
  sales pitch.

**Effort:** ~3–5 days + legal review. Do NOT start until Phase 1 is live and the
consent-capture path (cold → voice-consented) exists.

---

## Open decisions (resolve before Phase 1 build)

1. **Recording default** — off (cleanest) vs on-with-disclosure (better QA +
   dispute proof, needs two-party-consent states handling). Recommend **off by
   default**, partner-opt-in per policy, with an automatic disclosure preamble
   when on.
2. **FROM number** — require the partner to own a provisioned Twilio number
   (cleanest caller-ID + billing), vs a shared platform pool number. Recommend
   **partner-owned**; block the dialer until they have one (they already can buy
   one in `/partner-portal/phone-numbers`).
3. **Who pays the minutes** — partner's number billing already exists; confirm
   outbound voice minutes meter to the partner (reuse `partner-billing`).
4. **DNC source** — internal opt-out only (fast) vs integrate a DNC-scrub
   provider (safer at scale). Recommend internal `OptOutLog` + per-partner list
   for Phase 1; revisit a scrub provider before Phase 2.

## Risks

- **TCPA** — mitigated in Phase 1 by human-initiated + business-to-business +
  call-window + opt-out honor. Phase 2 is the real exposure → consent wall.
- **Carrier spam-labeling** the partner's number — mitigated by partner-owned
  number, low daily cap, human calls. Worsens fast with AI auto-dial (Phase 2).
- **Scope creep** — keep Phase 1 to the bridge + gate + log. No predictive
  dialing, no parallel dialing (those raise TCPA + abandonment-rate rules).
```
