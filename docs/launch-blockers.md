# Launch Blockers — Tracked Open Items

These are the items that **cannot be closed by code alone** — they require external signal (third-party approvals, off-repo actions, real-world data, or specific business decisions). They're tracked here so they don't get lost in conversation history but also don't block the build.

**Last reviewed:** 2026-05-05.

Items below sorted by urgency. Re-review weekly. When an item is closed, move it to the **Closed** section at the bottom with the date and what unblocked it.

---

## 🔴 Pre-launch must-do (blocks first paying customer)

### M1. Pick a contact email for the marketing site footer — open 2026-05-06

**What:** The marketing site (myorbisvoice.com) has no contact mechanism — no `support@`, `hello@`, or contact form anywhere. Footer has only the legal address. Prospects can't ask pre-sales questions before signing up, and once they're signed up, the only contact is "reply to the welcome email."

**Required from you:** Pick the email address — `support@myorbisvoice.com` is the standard choice but `hello@myorbisvoice.com` works too. Confirm the inbox is set up and being monitored. Then I'll add it to the marketing-site footer (EN + ES) and the welcome email signature, and ship a quick `mailto:` Contact link.

**Verifies done when:** Footer of every marketing page shows a contact email; clicking opens the user's mail client; emails to that address actually land in a real inbox.

---

---

## 🟡 Recommended pre-launch (won't block customers, but reduces support load)

### 4a. Latency telemetry isn't firing — needs a fresh inbound call to debug — open 2026-05-06

**What:** Out of 28 completed inbound conversations in the last 14 days, `Conversation.metadataJson` is null on all 28. Per [apps/voice-gateway/src/inbound.ts:97-110](apps/voice-gateway/src/inbound.ts#L97-L110), the code SHOULD push `(agentFirstAudio - lastUserAudio)` ms onto `turnLatenciesMs` at every turn boundary, then [persistConversation()](apps/voice-gateway/src/services/conversation.service.ts#L20) writes it to `metadataJson.latency` at finalize. Neither is happening — `grep "turnaround:" gateway-logs` returns ZERO matches across all history.

**Code audit (2026-05-06) found no bug on paper:**
- `lastUserAudioAt` correctly set on each Twilio media event with track==='inbound' ([inbound.ts:404-411](apps/voice-gateway/src/inbound.ts#L404-L411))
- `agentTurnStart` correctly reset to `null` on each `onTurnComplete` ([inbound.ts:299](apps/voice-gateway/src/inbound.ts#L299))
- `sendAudioToTwilio` correctly enters the measurement block when `agentTurnStart === null` ([inbound.ts:104-108](apps/voice-gateway/src/inbound.ts#L104-L108))

But `"first audio chunk → Twilio"` (the else-branch log meaning `lastUserAudioAt === null`) fires once per call, and `"turnaround:"` never fires. That implies `lastUserAudioAt` is null whenever the agent's first chunk for turn N+1 arrives — which can only happen if user audio frames never update line 410. Most likely cause: Twilio is sending media events with `track` field empty or non-'inbound', so the filter at line 405 silently drops them. Cannot confirm without a fresh inbound call to trace.

**Verifies done when:** Make one inbound call to a tenant's number, hold a 2-3 turn conversation, then check `Conversation.metadataJson.latency` is populated. If still null, add a log line at [inbound.ts:404](apps/voice-gateway/src/inbound.ts#L404) that prints `msg.media.track` for the first 5 media events, deploy, call again, read logs.

**Owner:** You (drive a real inbound call), me (read logs in parallel + ship the fix).

### 4. Capture real production call latency baseline

**What:** Once we have ~50 real production calls, query `SELECT metadataJson->'latency' FROM "Conversation" WHERE metadataJson ? 'latency' ORDER BY "createdAt" DESC` and look at the median + p95 distribution.

**Why:** Per-turn telemetry shipped 2026-05-05 (commit 85bcd46). The next move on backlog #3 (latency reduction) is data-gated by these distributions. Without 50+ real samples, tuning VAD silence_duration_ms or prompt size is just guessing.

**Owner:** Me, once data exists.

**Verifies done when:** A documented decision in CLAUDE.md backlog #3 saying "median is X, p95 is Y, we'll tune Z" OR "current numbers are acceptable, no further work."

---

### 5. Backlog #14 — Help-center screenshot capture (full pass)

**What:** Annotate the ~80 screenshot slots in `helpContent.ts` and `adminHelpContent.ts` with `capture` metadata, seed a demo tenant with realistic content, and run `pnpm capture-screenshots` to capture all PNGs.

**Why:** The framework is shipped (commit bb6ce54) but only one slot is annotated. Help center renders placeholder boxes for the other 79.

**Gated by:** Browser-based feature-testing sprint stabilizing the UI. The 2026-05-06 audit pass shipped a code-level pattern fix (global ZodError handler — 15+ silent 500s now properly 422'd) but did NOT include per-page click-through testing. That second part is what's gating this item: running screenshot capture against a UI that hasn't been clicked through end-to-end produces PNGs that rot the moment the first UI bug is fixed.

**Owner:** Me, once browser feature-testing has surfaced and fixed the major UI bugs.

**Sequencing for whoever picks this up next:**
  1. Spin up a fresh tenant in a real browser, walk every flow (signup → onboarding → Business DNA → prompts → agents → channels → integrations → billing → first call → conversation review → partner referral). Catalog every UI bug, copy issue, broken state.
  2. Fix the high-impact ones until the UI is stable.
  3. THEN annotate screenshot slots + seed demo tenant + run Playwright capture script.

**Verifies done when:** All ~80 screenshot slots show real PNGs, no placeholder boxes left in either help center.

---

### 6. Backlog #6 — Tooltips full per-field sweep across remaining pages

**What:** Add `Tooltip` wrappers on misunderstood fields across pages that don't yet have any: business profile, agent role config, admin storage tier, integration setup forms.

**Why:** Priority surfaces are covered (channels, agents, usage, dashboard, billing, prompts, settings). Bulk per-field sweep is editorial work better driven by real user-confusion signal than a single big push.

**Owner:** Me, incrementally. Drive from real signal — when a customer asks "what does this mean?" in support, that field gets a tooltip.

**Verifies done when:** Closed when the rate of "what does X mean?" support questions drops below threshold; not on a code-coverage metric.

---

## 🔵 External wait queues (no action — just track)

### 2. Twilio toll-free verification — not a launch blocker

**What:** Submit the package drafted at [docs/twilio-toll-free-verification.md](twilio-toll-free-verification.md) via the Twilio console when convenient.

**Why this is NOT a launch blocker:** Toll-free SMS is one outbound channel among several (email works today, voice inbound works today, in-app notifications work today). First customers can run their full receptionist + partner program flow without it. Submit when there's a customer who specifically wants outbound SMS from a toll-free number.

**Owner:** You (Twilio Console, ~10 min to submit; then 2-5 business days in Twilio's queue).

**Verifies done when:** Twilio Console shows the toll-free number's verification status as "Approved."

---

### 7. Twilio A2P 10DLC approval

**What:** Per-tenant SMS sending from tenant subaccounts. Backlog #16.

**Status:** Submitted. Awaiting Twilio's review (1–4 weeks queue).

**Verifies done when:** Twilio Console shows brand status "Verified" + campaign status "Approved" for the platform-level brand we registered.

**What to do meanwhile:** Campaign SMS uses master-account `sendTestMessage()` for testing only. Real per-tenant SMS dispatch flips on automatically when this clears (per backlog #16 implementation plan).

---

### 8. Outbound voice carrier reputation

**What:** Outbound calls placed by the AI agent are getting filtered to "busy" by Verizon/AT&T/T-Mobile spam filters. Backlog #19.

**Status:** Deferred to v1.1 per backlog. Verified that the underlying outbound dispatch code works correctly — this is a carrier-side filtering issue, not our code.

**Unblocks via:**
- (a) STIR/SHAKEN attestation registration (~$300 + 1 week through Twilio Trust Hub), OR
- (b) Organic reputation build via low-volume legitimate traffic over weeks-to-months, OR
- (c) Twilio Trust Hub Customer Profile + Voice Brand registration (formal process, days)

**Owner:** Defer until customer demand justifies. Inbound voice (the more important channel for our target verticals — dental, legal, home services, fitness, beauty) works fine and unaffected.

**Verifies done when:** A test outbound call from the platform's number to a non-contact phone connects normally instead of returning busy in 0 seconds.

---

## ✅ Closed

*(items move here with a date + what unblocked them)*

### 3. Recruit ONE real partner for live Stripe Connect onboarding — closed 2026-05-06

`onbrandcopywriter@gmail.com` (Stripe account `acct_1TTw6t2K2gztGZYP`) completed live-mode Stripe Express Connect onboarding end-to-end. Verified state in prod DB: `chargesEnabled: true`, `payoutsEnabled: true`, `detailsSubmitted: true`, `disabledReason: null`. Seven `affiliate.connect_status_synced` audit-log events confirm the `account.updated` webhook is firing and our handler is updating `payoutMethodJson` correctly.

**One bug found and fixed during this test:** `getConnectStatus` and `refreshConnectStatus` were using `findUniqueOrThrow` on `AffiliateAccount` lookup. Any logged-in non-partner hitting the partner-portal payouts/dashboard pages triggered P2025 → 500 → log-spamming `system.error.unhandled` audit entries. Fixed to use `findUnique` and return `NOT_CONNECTED` cleanly. Same pattern as the earlier `/affiliate/link` fix in memory.

### 1. Save the 4 Stripe live secrets to off-repo secret manager — closed 2026-05-05

All 4 values (`sk_live_…`, `pk_live_…`, `whsec_…` platform, `whsec_…` Connect) saved to the user's password manager during the launch-prep session on 2026-05-05. Verified preflight remained 8/8 green throughout. Recovery path now exists if AUTH_SECRET ever rotates.
