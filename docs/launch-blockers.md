# Launch Blockers — Tracked Open Items

These are the items that **cannot be closed by code alone** — they require external signal (third-party approvals, off-repo actions, real-world data, or specific business decisions). They're tracked here so they don't get lost in conversation history but also don't block the build.

**Last reviewed:** 2026-05-05.

Items below sorted by urgency. Re-review weekly. When an item is closed, move it to the **Closed** section at the bottom with the date and what unblocked it.

---

## 🔴 Pre-launch must-do (blocks first paying customer)

### 3. Recruit ONE real partner for live Stripe Connect onboarding

**What:** Have one trusted person (you, a co-founder, a close customer) complete Stripe Express Connect onboarding via the Partner Portal in **live mode** (with real SSN, real bank, real KYC).

**Why:** Bob's onboarding was test mode. Real partners go through deeper KYC than test mode covers. Doing it once before public launch closes the unknown — if there's a config gap or branding issue, find it now, not when 50 partners are stuck mid-flow.

**Owner:** You (recruit + walk them through). Me (monitor logs in parallel).

**Verifies done when:** A real `AffiliateAccount` row in prod has `stripeConnectAccountId` set + `payoutsEnabled: true` + audit log shows `affiliate.connect_status_synced` event.

---

## 🟡 Recommended pre-launch (won't block customers, but reduces support load)

### 4. Capture real production call latency baseline

**What:** Once we have ~50 real production calls, query `SELECT metadataJson->'latency' FROM "Conversation" WHERE metadataJson ? 'latency' ORDER BY "createdAt" DESC` and look at the median + p95 distribution.

**Why:** Per-turn telemetry shipped 2026-05-05 (commit 85bcd46). The next move on backlog #3 (latency reduction) is data-gated by these distributions. Without 50+ real samples, tuning VAD silence_duration_ms or prompt size is just guessing.

**Owner:** Me, once data exists.

**Verifies done when:** A documented decision in CLAUDE.md backlog #3 saying "median is X, p95 is Y, we'll tune Z" OR "current numbers are acceptable, no further work."

---

### 5. Backlog #14 — Help-center screenshot capture (full pass)

**What:** Annotate the ~80 screenshot slots in `helpContent.ts` and `adminHelpContent.ts` with `capture` metadata, seed a demo tenant with realistic content, and run `pnpm capture-screenshots` to capture all PNGs.

**Why:** The framework is shipped (commit bb6ce54) but only one slot is annotated. Help center renders placeholder boxes for the other 79.

**Gated by:** Tenant feature-testing sprint per backlog #14's own dependency note ("capturing screenshots against a buggy UI = wasted effort"). Re-open after that sprint stabilizes the UI.

**Owner:** Me, once feature-testing has surfaced and fixed the major UI bugs.

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

### 1. Save the 4 Stripe live secrets to off-repo secret manager — closed 2026-05-05

All 4 values (`sk_live_…`, `pk_live_…`, `whsec_…` platform, `whsec_…` Connect) saved to the user's password manager during the launch-prep session on 2026-05-05. Verified preflight remained 8/8 green throughout. Recovery path now exists if AUTH_SECRET ever rotates.
