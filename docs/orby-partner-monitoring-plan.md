# Plan — Per-Partner Orby + Central Call Log + AI Conversation Monitor

**Status:** ✅ SHIPPED 2026-05-16. All three parts built + deployed.
Drafted 2026-05-17. Commits: Part 3 `96dfa43`, Part 2 `f599105`, Part 1
this commit. See `docs/build-log.md` for the build entry.

Supersedes the earlier "one shared master Orby" decision (see memory
`orby-default-agent-for-partner-numbers`). The model is now: **every
partner gets their own Orby**, plus platform-wide oversight.

---

## The model

1. **Per-partner Orby** — when a partner onboards, auto-create a
   partner-scoped Orby agent, cloned from the platform Orby's config.
   It runs the full job (calls, booking, follow-up) on the partner's
   marketing surfaces (their pages + their phone number), speaks the
   partner's name/business, books to the partner's calendar.
2. **Master central call log** — one admin view of every call across
   every partner and tenant. Nobody falls through the cracks.
3. **AI conversation monitor** — after each conversation, an AI pass
   flags ones that may need admin intervention. The central log
   color-codes (green / yellow / red) and alerts admin on red.

---

## Part 1 — Per-partner Orby agent

**Goal:** each partner's number/pages are answered by *their* Orby —
same proven behavior as the platform Orby, but in the partner's context.

- **`ensurePartnerOrbyAgent(partnerId)`** (agent.service.ts) — find-or-create
  a partner-scoped `AgentProfile` (role ORCHESTRATOR, displayName "Orby",
  enabled). Seed `modelProvider` / `modelName` / `settingsJson` and the
  prompt from the platform Orby agent — a clone, so quality is consistent.
  Idempotent. Replaces `ensureMasterOrbyAgent` for partner scope (the
  platform Orby stays as the fallback + the clone source).
- **Onboarding hook** — call `ensurePartnerOrbyAgent` when a partner is
  approved / acquires their first number (extend the existing
  `provisionPartnerNumber` hook that already sets `PhoneNumber.agentProfileId`).
- **Routing** — `PhoneNumber.agentProfileId` points at the *partner's*
  Orby (not the platform one). The inbound webhook + gateway resolve the
  agent from `agentProfileId` → run that agent's config.
- **Partner business context** — the partner Orby needs the partner's
  business info to speak for them (name, what they do, services). Source:
  `AffiliateAccount` (businessName, bio, displayName). If that is too thin,
  add a lightweight partner "business profile" (services, hours, pitch).
  **Open item — confirm what context the partner Orby needs.**
- **Voice runtime — verify.** Today partner numbers borrow the platform
  tenant's voice runtime. A genuine per-partner Orby answering live calls
  with the partner's own config + context must be confirmed to run end to
  end. **This is the main technical risk; verify before building the rest
  of Part 1.**

## Part 2 — Master central call log

**Goal:** one admin screen, every call, every scope.

- **Admin page** `/admin/call-log` — table of `CallLog` + `Conversation`
  joined, across all tenants + partners.
- **Columns:** time, caller (name / number), partner or tenant, direction,
  duration, outcome, booked?, **attention status** (color — from Part 3).
- **Filters:** partner, tenant, attention level, date range, booked-or-not.
- **API:** `GET /api/admin/call-log` — admin-only, cross-scope query,
  paginated. RBAC: Platform Super Admin + Platform Support (read-only).
  Keep it off Platform Admin if tighter control is wanted.
- Row click → the conversation detail (transcript, summary, recording).

## Part 3 — AI conversation monitor

**Goal:** surface conversations that need a human, automatically.

- **v1 = post-call classification.** When a conversation finalizes
  (`persistConversation` already builds a summary), add an AI pass
  (`gpt-4o-mini`, same pattern as the A2P compliance pre-check): score
  the transcript → `attentionLevel` + `attentionReason`. Signals:
  frustrated/angry caller, unresolved issue, failed/abandoned booking,
  explicit escalation ask, confusion, complaint.
- **Schema:** `Conversation.attentionLevel` enum `NONE | WATCH | ALERT`,
  `Conversation.attentionReason String?`.
- **Color:** central log rows — green (NONE) / yellow (WATCH) / red (ALERT).
- **Alert:** on `ALERT`, fire an admin notification (existing notification
  system / NotificationBell) so admin can call the customer back.
- **Future phase (not v1):** live mid-call monitoring — an agent on the
  audio stream flagging issues *during* the call. Much larger lift
  (streaming analysis, real-time infra). Post-call gets ~90% of the value.

---

## Schema changes

- `Conversation.attentionLevel` — enum `ConversationAttentionLevel`
  (`NONE` default / `WATCH` / `ALERT`).
- `Conversation.attentionReason String?`.
- Per-partner Orby uses the existing `AgentProfile.partnerId` +
  `PhoneNumber.agentProfileId` — no new columns.

## Sequencing

1. **Part 3 (monitor)** — most self-contained, highest immediate value,
   builds on the existing A2P AI-precheck pattern. Schema + the classify
   pass + alerting.
2. **Part 2 (central log)** — the admin view; consumes Part 3's
   `attentionLevel` for the color column.
3. **Part 1 (per-partner Orby)** — biggest, touches the voice runtime.
   Verify the runtime path first, then the clone + onboarding hook + routing.

## Open items to confirm before/while building

- Part 1: what business context the partner Orby needs (is
  `AffiliateAccount` enough, or a fuller partner business profile?).
- Part 1: per-partner voice-runtime path confirmed.
- Part 2: which admin roles see the central log.
