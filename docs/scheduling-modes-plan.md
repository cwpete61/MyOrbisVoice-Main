# Scheduling Modes — Booking / Windows / Callback

Per-tenant scheduling behavior so field-service businesses (HVAC, plumbing,
handyman, towing, pest, landscaping, cleaning) aren't forced into precise
calendar slots they can't honor (jobs overrun, traffic, emergencies).

## The three modes

| Mode | Orby behavior | Calendar tool |
|---|---|---|
| **BOOKING** (current default) | precise appointment slots | `check_availability` + `book_appointment` |
| **WINDOWS** | books a day + arrival window ("Tue morning 8–12"), no exact time | `book_window` |
| **CALLBACK** | no calendar; qualify + capture the lead + promise "{Owner} calls back within {SLA}" | `request_callback` |

All modes keep `save_contact`, `record_disposition`, `end_call`.

## Data model

Settings live in `ChannelConfig.configJson.scheduling` (no migration):

```
scheduling = {
  mode: 'BOOKING' | 'WINDOWS' | 'CALLBACK',   // unset → resolve by vertical
  callbackSla: 'ONE_HOUR' | 'SAME_DAY' | 'NEXT_BUSINESS_DAY' | <freeText>,
  callbackWho: '<Owner display name>',        // "Mike will call you back"
  arrivalWindows: ['MORNING_8_12','AFTERNOON_12_4','EVENING_4_8'],  // WINDOWS
  ownerNotify: { sms: true, email: true, phone: '+1…' },  // dedicated notify #
  urgencyTriage: true,
  callerTextBack: true,
}
```

## Locked decisions (2026-07-24)

1. **SLA is owner-configured** (consistent brand promise), not caller-chosen.
2. **MVP rides `record_disposition` `CALLBACK_REQUESTED`** — dedicated
   `CallbackRequest` worklist table is Phase 2.
3. **Dedicated `ownerNotify.phone`**, not `tenant.publicPhone` (which the code
   already warns can be a personal/contact number — appointment.service.ts:867).

## Gateway — per-session tool gating

Today: static `tools: [...TOOL_DECLARATIONS]` (session.ts, inbound.ts). Change to
build the list from `scheduling.mode`:
- CALLBACK omits `book_appointment` + `check_availability` entirely (Orby *cannot*
  offer a slot), adds `request_callback`.
- WINDOWS swaps `book_appointment` → `book_window`.
- New tools in `apps/voice-gateway/src/services/tools.ts`.
  `request_callback` → captures lead → `record_disposition` CALLBACK_REQUESTED →
  fires the notify backbone → returns the SLA so Orby states it truthfully.

## Prompt-resolver — mode block (Layer 4/5)

Pass `scheduling` into `resolveSystemPrompt` (same as the vertical persona).
Inject a mode block (same pattern as the payments block, inbound.ts:520):
- CALLBACK: "Do NOT offer or imply appointment times — you don't book here.
  Capture name, callback number, service address, the problem, and urgency. Then
  tell them {callbackWho} will call back {callbackSla} and a confirmation text is
  coming. Never promise a specific arrival time."
- WINDOWS: "Offer arrival windows (morning/afternoon), never an exact clock time."

## Backbone (shared: WINDOWS + CALLBACK)

- **Instant owner notification** — `sms.service.sendSms` to `ownerNotify.phone`
  + `notify.service.sendCallNotificationEmail`, carrying name, number, address,
  problem, urgency.
- **Caller text-back** — `sendSms` to caller `From`: "Got it — {Owner} will call
  you back {SLA}. Reply with a photo if it helps."
- **Urgency triage** (Phase 3) — Orby asks "emergency?" once; urgent → notify
  flagged URGENT + optional live transfer via existing `escalationMode` /
  `forwardingTarget`.

## Web UI

`apps/web/src/app/(dashboard)/channels/page.tsx` — Scheduling control group beside
`greetingMode` (~L495), written via `updateConfig(key, value)` (~L312). Bilingual
`t()` keys in both dictionaries.

## Vertical defaults (unset mode)

- `home_services`, `logistics`, TOWING, trades → WINDOWS (or CALLBACK)
- `medical`, `wellness`, salon/dental → BOOKING
- else → BOOKING. Tenant override always wins.

## Build order

- **Phase 1 (MVP, no migration):** `scheduling.mode` in configJson · CALLBACK mode
  · `request_callback` tool + tool-gating · CALLBACK prompt block · owner
  SMS/email notify + caller text-back · channels UI (Booking/Callback + SLA +
  who + owner-notify + text-back). Rides `record_disposition` CALLBACK_REQUESTED.
- **Phase 2:** WINDOWS mode · `book_window` + Appointment window rows · windows UI
  · `CallbackRequest` table + owner callback worklist page.
- **Phase 3:** urgency triage + emergency live-transfer · vertical smart-defaults
  · analytics (callback SLA hit rate).

## Verification (per phase)

Set mode → **live test call** → Orby never offers a slot (CALLBACK), captures the
lead, states the SLA → owner SMS+email arrived → caller got text-back →
disposition persisted. Bilingual: same in Spanish. Build clean, deploy
gateway+api+web per protocol.
