# Launch Blockers — Tracked Open Items

These are the items that **cannot be closed by code alone** — they require external signal (third-party approvals, off-repo actions, real-world data, or specific business decisions). They're tracked here so they don't get lost in conversation history but also don't block the build.

**Last reviewed:** 2026-05-06.

Items below sorted by urgency. Re-review weekly. When an item is closed, move it to the **Closed** section at the bottom with the date and what unblocked it.

---

## 🔴 Pre-launch must-do (blocks first paying customer)

### G1. Gemini Live WebSocket closing with code 1008 mid-call — open 2026-05-06

**What:** During an inbound test call on 2026-05-06 around 23:03 UTC, the agent stopped responding mid-conversation after 5 successful turns. Gateway logs show `[gemini] WebSocket closed, code: 1008 reason: Operation is not implemented, or supported, or enabled.` immediately after the agent's "Just to confirm, the email is …" turn. Our gateway correctly hung up the Twilio call (per the fix in commit `9e166c9`), so to Twilio the call appeared COMPLETED — but the AI experience was abruptly terminated.

**Pattern, not flake.** Three identical `code: 1008` closes in the last 24 hours, all with the same reason text. Different points in the session each time:
- Once immediately after `setupComplete` (no turns at all)
- Once after a successful `save_contact` tool call response
- Once mid-conversation (the test call) after 5 clean turns

**What this is NOT:**
- Not a latency issue — telemetry recorded median **7ms**, p95 **31ms** on the test call (so item 4a "latency telemetry not firing" is now CLOSED — it IS firing, see closed section below)
- Not our gateway closing the connection — Gemini sent the close frame
- Not a Twilio issue — Twilio recording stored cleanly, status COMPLETED

**Likely causes (ranked by probability):**
1. Model name `gemini-2.5-flash-native-audio-latest` is a `-latest` alias — preview/experimental variants sometimes get tighter limits or quietly deprecate. **Try the GA-stable name** (`gemini-2.5-flash-native-audio` without `-latest`) — fastest fix to attempt.
2. A specific tool function definition Gemini rejects on this model variant — supported by the 2nd disconnect happening right after `save_contact`.
3. API key tier / quota change at Google's end.
4. Specific input-pattern policy filter (less likely — conversations look clean).

**Required to diagnose further:**
- Switch to non-`-latest` model name, redeploy gateway, retest with one inbound call
- If still 1008: add diagnostic logging to capture the last 3 frames sent to Gemini before each close
- Check Google AI Studio / Vertex console for any quota or billing warnings on the project

**Verifies done when:** Two consecutive test inbound calls of 2+ minutes complete WITHOUT a Gemini-side WebSocket close (gateway log shows `[inbound] finalize` reached without an intervening `[gemini] WebSocket closed`).

**Owner:** Me to switch the model name + add logging; you to make the test call.

---

---

## 🟡 Recommended pre-launch (won't block customers, but reduces support load)

### 4. Capture real production call latency baseline

**What:** Once we have ~50 real production calls, query `SELECT metadataJson->'latency' FROM "Conversation" WHERE metadataJson ? 'latency' ORDER BY "createdAt" DESC` and look at the median + p95 distribution.

**Why:** Per-turn telemetry shipped 2026-05-05 (commit 85bcd46). The next move on backlog #3 (latency reduction) is data-gated by these distributions. Without 50+ real samples, tuning VAD silence_duration_ms or prompt size is just guessing.

**First sample landed 2026-05-06** from the test call diagnosing G1: `{"max":31,"min":2,"p95":31,"count":5,"turns":[31,2,3,7,23],"median":7}`. Median 7 ms, p95 31 ms across 5 turns. **Numbers look excellent on the first sample** — well below the 800ms target stated in backlog #3. If the next 49 calls land in the same distribution, latency tuning may not be needed at all and the item closes as "current numbers are acceptable, no further work."

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

### M1. Pick a contact email for the marketing site footer — closed 2026-05-06

Verified `admin@myorbisvoice.com` (General) and `support@myorbisvoice.com` (Support) are both wired into the home-page footer (`site/index.html`) and the legal pages (`terms.html`, `privacy.html`, `cookies.html`, `how-it-works.html`). User confirmed inboxes are monitored. Prospects now have a clear contact path before signing up.

### 4a. Latency telemetry isn't firing — closed 2026-05-06

**Closed because the original assumption was wrong.** A test inbound call on 2026-05-06 23:03 UTC populated `Conversation.metadataJson.latency` with `{"max":31,"min":2,"p95":31,"count":5,"turns":[31,2,3,7,23],"median":7}` and the gateway logs show `[inbound] turnaround: Xms (user→agent)` firing on every turn boundary. The earlier theory that Twilio media events were missing the `track` field was incorrect — `track="inbound"` is set, the filter is passing, the timing is captured, and the latency summary is persisting cleanly. No code change needed.

**Useful side effect:** the test call surfaced a different, real issue (G1 — Gemini 1008 disconnect) which is now the new top pre-launch blocker.

### 3. Recruit ONE real partner for live Stripe Connect onboarding — closed 2026-05-06

`onbrandcopywriter@gmail.com` (Stripe account `acct_1TTw6t2K2gztGZYP`) completed live-mode Stripe Express Connect onboarding end-to-end. Verified state in prod DB: `chargesEnabled: true`, `payoutsEnabled: true`, `detailsSubmitted: true`, `disabledReason: null`. Seven `affiliate.connect_status_synced` audit-log events confirm the `account.updated` webhook is firing and our handler is updating `payoutMethodJson` correctly.

**One bug found and fixed during this test:** `getConnectStatus` and `refreshConnectStatus` were using `findUniqueOrThrow` on `AffiliateAccount` lookup. Any logged-in non-partner hitting the partner-portal payouts/dashboard pages triggered P2025 → 500 → log-spamming `system.error.unhandled` audit entries. Fixed to use `findUnique` and return `NOT_CONNECTED` cleanly. Same pattern as the earlier `/affiliate/link` fix in memory.

### 1. Save the 4 Stripe live secrets to off-repo secret manager — closed 2026-05-05

All 4 values (`sk_live_…`, `pk_live_…`, `whsec_…` platform, `whsec_…` Connect) saved to the user's password manager during the launch-prep session on 2026-05-05. Verified preflight remained 8/8 green throughout. Recovery path now exists if AUTH_SECRET ever rotates.
