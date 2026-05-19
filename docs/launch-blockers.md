# Launch Blockers — Tracked Open Items

These are the items that **cannot be closed by code alone** — they require external signal (third-party approvals, off-repo actions, real-world data, or specific business decisions). They're tracked here so they don't get lost in conversation history but also don't block the build.

**Last reviewed:** 2026-05-19.

Items below sorted by urgency. Re-review weekly. When an item is closed, move it to the **Closed** section at the bottom with the date and what unblocked it.

---

## 🔴 Pre-launch must-do (blocks first paying customer)

*(none open — D1 closed 2026-05-12 via Cloudflare 301 redirect; G1 closed earlier same day. See Closed section below.)*

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

### S1. Next.js 14→15 upgrade — ✅ CLOSED 2026-05-19

**Closed:** upgraded to Next 15.5.18 + React 19.2.6. The codebase was already
Next-15-clean — `layout.tsx` used `await headers()`, App Router only, no
Pages Router, no middleware, no sync `params`/`cookies` server-prop usage —
so the version bump needed zero source changes. `pnpm audit --audit-level=high`
went 5 high → 0 (2 moderate remain). type-check 8/8, all 8 prod surfaces
verified (200 / 307 root redirect). The S1 fear of a risky major bump did not
materialize because the code had been written in the forward-compatible style.

Original item, for reference:

#### S1 (original). Next.js 14.2.35 → 15.x upgrade for two open CVEs

**What:** Two high-severity Next.js advisories require ≥15.0.8 and ≥15.5.15:
- GHSA-h25m-26qc-wcjf — HTTP request deserialization DoS via insecure RSC
- GHSA-q4gf-8mx6-v5v3 — Server Components DoS

**Why deferred:** 14 → 15 is a major-version bump touching App Router, RSC, middleware, redirects, and the manifest format. We already had two prod incidents (`bjcai7pph`/`bii3fr7ws`) tonight from Next.js manifest issues; rushing a major upgrade in the same session is exactly the wrong move. The CVEs are exploitable only via crafted RSC requests, and our exposure is bounded by Caddy rate limits + helmet headers + auth gating on most routes.

**Owner:** Me, in a dedicated session.

**Sequencing for whoever picks this up:**
  1. Read Next.js 14 → 15 codemod docs and run `npx @next/codemod@canary upgrade`
  2. Diff `next.config.mjs`, `app/layout.tsx`, all server components for breaking changes (async request APIs, fetch caching defaults, `params` is now Promise<>)
  3. Verify tar-pipe deploy still works (the `/_not-found/page.js` sanity-check files may move in 15)
  4. Test all 8 prod surfaces (200/307 check) + a real call flow + the Stripe webhook path
  5. Re-run `pnpm audit --audit-level=high` and confirm Next.js entries are gone

**Verifies done when:** `pnpm audit --audit-level=high` shows ≤1 high finding (or zero) AND prod smoke passes.

---

### S2. Wire Sentry SDK across api / web / voice-gateway

**What:** Currently zero error-aggregation tooling — we rely on the in-house `system.error.unhandled` audit-log row and manual `docker logs` inspection. That's fine for low-volume launch but won't scale: source maps aren't symbolicated, errors aren't grouped, no email/Slack alerting on new patterns.

**Why deferred:** Wiring Sentry across three services touches `index.ts`, error middleware, `next.config.mjs`, `instrumentation.ts`, and adds a new external dependency. Requires creating a Sentry project (user action) and getting DSNs. Doing this at the same time as a security patch + deploy hardening compounds risk — this is its own session.

**Owner:** Me to wire the SDK + the user to create the Sentry project + paste DSN into `Admin → System Settings`.

**Sequencing:**
  1. User creates Sentry project; gets DSN per service (api, web, voice-gateway)
  2. Add SDK wrapper in `apps/api/src/lib/sentry.ts` that no-ops if DSN is missing
  3. Init at top of each `index.ts`; wire `Sentry.Handlers.errorHandler()` in api after routes but before our custom errorHandler (so both fire)
  4. Web: `@sentry/nextjs` integration via `instrumentation.ts` + `sentry.client.config.ts` + `sentry.server.config.ts`
  5. Voice-gateway: `@sentry/node` init at top of `index.ts` + manual capture in WebSocket handlers
  6. Add `SENTRY_DSN_API`, `SENTRY_DSN_WEB`, `SENTRY_DSN_GATEWAY` to `.env.prod` template
  7. Deploy each service separately, verify health, generate one synthetic error per service to confirm Sentry receives it

**Verifies done when:** A deliberately-thrown test error in each of the three services appears in the Sentry dashboard within 60s.

---

### S3. Wire uptime monitoring (recommended: UptimeRobot free tier)

**What:** Today, if `api.myorbisvoice.com` goes down at 3 AM, we find out when a customer complains. Need a passive watcher that pings every 5 min and emails on failure.

**Why minimal effort:** UptimeRobot's free tier covers 50 monitors at 5-min intervals. ~5 min of user setup time:
  1. Sign up at uptimerobot.com (free, no credit card)
  2. Add monitors: `https://api.myorbisvoice.com/health` (HTTP keyword: `"status":"ok"`), `https://app.myorbisvoice.com/login` (HTTP 200), `https://myorbisvoice.com` (HTTP 200), `https://api.myorbisvoice.com/api/billing/plans` (HTTP keyword: `"plans"`)
  3. Set notification email to admin@myorbisvoice.com + a backup personal address

**Alternatives considered:** Better Stack ($), self-hosted Uptime Kuma (needs another machine), GitHub Actions cron (works but slow alerting). Free SaaS is the right choice for v1.

**Owner:** User (5 min in UptimeRobot UI).

**Verifies done when:** UptimeRobot dashboard shows 4 green monitors and a test pause on one of them produces an email within 10 min.

---

### S4. Voice runtime end-to-end retest (single real call)

**What:** Place one real inbound call from a personal phone to the platform's Twilio number and verify the full pipeline:
- Twilio routes inbound → gateway accepts WebSocket
- Gemini Live session establishes; agent greets first
- 2+ conversational turns complete cleanly without `code: 1008` (G1 watch)
- Call ends; recording webhook fires; recording lands in Bunny
- Conversation row in DB has `transcriptJson`, `summaryText`, `recordingRef`, `metadataJson.latency`

**Why this is open:** Last verified 2026-05-06 — surfaced G1 (Gemini 1008 mid-call disconnect, separate item). Recently shipped: theme overhaul, Google sign-in, deploy-script hardening. None of those touched the voice path, but per the autonomous-verify rule we should re-test before claiming "voice is launch-ready" with confidence.

**Owner:** User to place the call (from a phone NOT in their Google contacts to avoid the carrier reputation issue from #8).

**Verifies done when:** One inbound call of 90+ seconds completes with all artifacts (recording + transcript + summary + latency) populated in the DB.

---

### S5. Approve the Postmark account (transactional email)

**What:** The Postmark account is still in "pending approval" mode. While
pending, Postmark rejects any send whose recipient domain differs from the
`From` domain (`422 — all recipient addresses must share the same domain as
the 'From' address`). So real customer/partner email (gmail.com etc.) cannot
go out through Postmark yet.

**Why this is NOT a hard blocker:** The transactional path falls back to the
local Postfix relay on send failure, and that fallback delivers fine for
`From: bookings@myorbisresults.com` (DKIM-signed, SPF passes). Password
resets, booking confirms and welcome emails using that From currently reach
Gmail with `250 OK`. Postmark approval upgrades deliverability + gives webhook
event correlation; it doesn't gate first customers.

**Context:** The double-decrypt bug that made *every* Postmark send fail with
`Invalid ciphertext format` is fixed (commit 7bf17f2, deployed 2026-05-19).
Postmark now authenticates correctly — the only thing left is the account
being approved on Postmark's side.

**Owner:** User — complete Postmark account approval in the Postmark dashboard
(provide sending-domain + use-case detail Postmark requests).

**Verifies done when:** A transactional send to an external domain (e.g. a
gmail.com address) returns `{ sent: true, provider: 'postmark' }` instead of
falling back to SMTP — visible in API logs as `[forgot-password] reset email
sent to X via postmark`.

---

### S6. SPF + DKIM for `myorbisvoice.com` (Contabo relay)

**What:** The Contabo host IP `147.93.183.4` is not in `myorbisvoice.com`'s
SPF record, and there is no DKIM signing for that domain. Any mail sent
through the local Postfix relay `From:` a `@myorbisvoice.com` address bounces
at Gmail: `550-5.7.26 Your email has been blocked because the sender is
unauthenticated`. opendkim already signs `myorbisresults.com` (which is why
mail From `bookings@myorbisresults.com` delivers); `myorbisvoice.com` has no
equivalent.

**Impact:** Anything that explicitly sets a `@myorbisvoice.com` From bounces —
observed on `notify@myorbisvoice.com` synthetic/smoke sends. The password-reset
email dodges this only because `smtp_from` is `Orby Bookings
<bookings@myorbisresults.com>`. It's a latent landmine: any future caller that
passes a `@myorbisvoice.com` From, or a change to `smtp_from`, silently bounces.

**Fix (DNS + host config):**
  1. Add `147.93.183.4` to `myorbisvoice.com`'s SPF TXT record (e.g.
     `v=spf1 ip4:147.93.183.4 include:... ~all`).
  2. Add a DKIM signing entry for `myorbisvoice.com` in opendkim on the
     Contabo host (mirror the existing `myorbisresults.com` `s=default` setup)
     and publish the public key as a DNS TXT record.
  3. Confirm a `_dmarc.myorbisvoice.com` policy exists.

**Owner:** User for the DNS records; the opendkim host config can be done
together (host-level, not container — `/etc/opendkim`).

**Verifies done when:** A test send `From: notify@myorbisvoice.com` to a
gmail.com address shows `status=sent (250 ... OK)` in `/var/log/mail.log` with
`opendkim ... DKIM-Signature field added (d=myorbisvoice.com)`.

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

### D1. myorbisresults.com web hosting unreachable — closed 2026-05-12

**What unblocked it:** Cloudflare 301 redirect rule at the edge. User added an A record `@ → 66.29.148.134` (orange-clouded / proxied) and a Redirect Rule that points all incoming requests to `concat("https://myorbisvoice.com", http.request.uri.path)` with status 301. Cloudflare intercepts before traffic ever reaches Spaceship, so the missing Addon-Domain + TLS-cert problem at the Spaceship origin becomes irrelevant.

**Smoke verified end-to-end** (forced Cloudflare anycast IP to bypass local DNS cache during propagation):

```
https://myorbisresults.com/                        → 301 → https://myorbisvoice.com/                        → 200
https://myorbisresults.com/p/sample/voice-1/       → 301 → https://myorbisvoice.com/p/sample/voice-1/       → 200
https://myorbisresults.com/p/sample/voice-2/       → 301 → https://myorbisvoice.com/p/sample/voice-2/       → 200
https://myorbisresults.com/p/sample/voice-3/       → 301 → https://myorbisvoice.com/p/sample/voice-3/       → 200
https://myorbisresults.com/preview/                → 301 → https://myorbisvoice.com/preview/                → 200
https://myorbisresults.com/p/_assets/partner-hydrate.js → 301 → ...                                        → 200
https://www.myorbisresults.com/p/sample/voice-1/   → 301 → https://myorbisvoice.com/p/sample/voice-1/      → 200
```

**Side benefit:** the deploy-script-secondary-target feature shipped in `568d236` stays dormant (no `MOR_FTP_HOST` set) but is ready if a future decision needs partner pages to be served natively at `myorbisresults.com` (e.g. brand-strategy shift, or a customer-specific demand). Path to flip back: add Spaceship Addon Domain → add netrc entry → set `MOR_FTP_HOST` → remove Cloudflare redirect rule.

**Two gotchas that cost ~30 min of debugging — captured here so future-me doesn't repeat them:**

1. **Cloudflare Redirect Rules only fire when DNS is proxied (orange cloud), not DNS-only (gray cloud).** I initially recommended gray cloud thinking we'd serve from Spaceship origin; for the redirect path, that's wrong. Orange cloud is required because the rule runs at Cloudflare's edge, which only sees the request if Cloudflare is in the path.

2. **Cloudflare's redirect URL field has Type=Static and Type=Dynamic.** Static treats whatever you type as a literal URL. Dynamic evaluates it as an expression. To preserve the request path with `concat("https://myorbisvoice.com", http.request.uri.path)`, you must pick **Dynamic**. If you pick Static and paste the expression, Cloudflare 301s every request to the literal string `concat(...)` — visible to curl, fatal to browsers.

### G1. Gemini Live WebSocket closing with code 1008 mid-call — closed 2026-05-12

**What unblocked it:** The model-snapshot pin landed in commit `a8721a8` (default moved from `gemini-2.5-flash-native-audio-latest` rolling alias → `gemini-2.5-flash-native-audio-preview-09-2025` pinned snapshot, plus a ring-buffer dump of the last 5 outbound frames on every close). Gateway logs in the 7 days following showed **zero** `code: 1008` closes — only clean `code: 1000` closes from the agent's own `end_call` tool invocation. The G1 hypothesis that `-latest` was the cause appears to have been correct. Closing without the formal "two consecutive 2+ minute test calls" verification because real production traffic has already demonstrated the absence of the failure mode.

**Side-effect bug surfaced during the 2026-05-12 G1 review and fixed in the same session:** `record_disposition` was returning `{"ok":false,"error":"Provide conversationId or externalCallId"}` on **every** widget call. Widget sessions weren't creating their `Conversation` row until session END (in `persistConversation()`), so mid-call tool invocations had no target. Confirmed bite: the 5 most-recent widget conversations across 3 days all had `outcomeCode = NULL` despite the agent calling `record_disposition` on every one. Fix shipped in same deploy: new `startWidgetConversation()` helper creates the row in `OPEN` status at session start; `persistConversation()` updates the existing row at end; ring-buffer preview raised from 200 → 800 chars so future tool-error payloads aren't truncated.

**Re-open if:** Any new `[gemini] WebSocket closed, code: 1008` line appears in `docker logs myorbisvoice-gateway`.

### S0. xlsx (SheetJS 0.18.5) prototype-pollution + ReDoS CVEs — closed 2026-05-09

GHSA-4r6h-8v6p-xvw6 (prototype pollution) and GHSA-5pgg-2g8v-p4x9 (ReDoS) were both unfixable on npm because SheetJS pulled their package and only ships from `cdn.sheetjs.com`. Pinned `apps/api/package.json` `"xlsx"` to the official tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, rebuilt, deployed (clean health check). Existing input-bound mitigations (5MB cap, 100k cell cap in `knowledge-base.service.ts`) remain as defense-in-depth. `pnpm audit --audit-level=high` now shows 2 highs (both Next.js — see S1) instead of 4.

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
