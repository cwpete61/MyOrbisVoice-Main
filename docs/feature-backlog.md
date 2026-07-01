# Feature Backlog

> Confirmed product requirements with status, design notes, and effort estimates. Do not skip or reorder without reviewing the impact on tenant isolation, entitlement gating, and audit requirements. Linked from CLAUDE.md.

### Status legend

- ✅ **DONE** — shipped and verified in production
- 🟡 **PARTIAL** — partially built; remaining work documented in the item
- ❌ **TODO** — not yet built; real gap
- 🔵 **DEFERRED** — blocked on an external dependency or intentionally pushed to v1.1

### Backlog status snapshot (audited 2026-05-05)

| # | Item | Status |
|---|---|---|
| 1 | Admin impersonation / support mode | ✅ DONE — per-action audit attribution shipped 2026-05-05 |
| 2 | Agent always speaks first | ✅ DONE — both inbound + widget surfaces |
| 3 | Reduce agent response latency | 🟡 PARTIAL — telemetry shipped 2026-05-05 (per-turn user→agent timing on Conversation.metadataJson.latency); actual VAD / prompt-size tuning is data-gated until we collect baseline distributions |
| 4 | Conversations bulk actions / search / filter / sort / download | ✅ DONE |
| 5 | Channel availability gated by tier | ✅ DONE — `/channels` cards lock + render upgrade link when entitlements gate the channel (shipped 2026-05-05) |
| 6 | Tooltips throughout the app | 🟡 PARTIAL — priority surfaces covered (channels, agents, usage, dashboard, billing entitlements + business-dna section descriptions); per-field sweep across remaining pages is incremental editorial work |
| 7 | Full help section (tenant-facing) | ✅ DONE |
| 8 | Phone usage section | ✅ DONE |
| 9 | Finish Google integration | ✅ DONE |
| 10 | Calendar integration "coming soon" placeholders | ✅ DONE — Outlook, Calendly, Cal.com cards in `/integrations` |
| 11 | Logo upload | ✅ DONE |
| 12 | New conversation notifications | ✅ DONE |
| 13 | Admin help section | ✅ DONE — text complete; screenshots tracked under #14 |
| 14 | Automated help-center screenshot capture (Playwright) | 🔵 DEFERRED-BY-DESIGN — gated by upcoming tenant feature-testing sprint per the item's own dependency note. Re-open after that sprint stabilizes the UI. |
| 15 | Voice dispatch for tag-driven campaigns | 🔵 DEFERRED — pending v1.1 (carrier reputation, see #19) |
| 16 | Per-tenant SMS subaccount routing | 🔵 DEFERRED — pending Twilio A2P 10DLC approval |
| 17 | Twilio testing path completion | 🟡 IN-FLIGHT |
| 18 | WhatsApp dispatch | 🔵 DEFERRED — pending Meta Business verification |
| 19 | Outbound voice carrier reputation | 🔵 DEFERRED — pending A2P 10DLC + STIR/SHAKEN attestation |
| 20 | Self-service A2P 10DLC registration wizard (tenants AND admin) | 🟡 PARTIAL — data-capture form already shipped (schema + 3 API routes + tenant UI page at `/a2p`). Remaining: Twilio Trust Hub integration, multi-step wizard polish with gap-handling UX, admin dashboard mount, status webhook receiver, auto-link to phone numbers. ~5-7 days from current state |
| 21 | Durable transactional event/outbox (PgQue) | 🔵 DEFERRED — candidate solution captured, not built. Adopt only when reliable "DB write → downstream action" delivery is needed (Stripe/Twilio webhook → action, booking → follow-up) or the outbound dispatch loop bloats. See detailed entry below. |

**Open work — incremental, not blocking launch:**
- **#3 Agent latency tuning** — telemetry now captures real distributions; tune VAD / prompt-size only after baseline data exists across real production calls
- **#6 Tooltips per-field sweep** — editorial work across remaining pages, driven by user-confusion feedback rather than a single big push
- **#14 Screenshot capture** — gated by feature-testing sprint (intentional)
- **#15-19 Twilio / outbound voice** — all blocked on external approvals (A2P 10DLC, toll-free verification, Meta Business, carrier reputation)
- **#20 A2P self-service wizard (tenants AND admin)** — gated by post-soft-launch friction signal; no use building it until we know which fields actually trip tenants up. Same wizard reused on the admin dashboard for registering MyOrbisVoice's own master-account numbers.

There are no remaining TODO items the team can close without external signal.

---

### 1. Admin Full Tenant Access (Impersonation / Support Mode) — ✅ DONE

**What:** Platform admins must be able to enter any tenant's account from the admin dashboard to configure settings, troubleshoot issues, or act on behalf of the tenant during support.

**Requirements:**
- Admin dashboard tenant detail page gets an "Enter as tenant" / "Support mode" button
- Clicking it issues a scoped impersonation token tied to that tenantId, with a short TTL (e.g. 15 minutes)
- All actions taken during impersonation are audit-logged with `actingAdminId` + `impersonatedTenantId`
- A visible banner must appear in the app while in impersonation mode (e.g. "Support mode — acting as Tenant X")
- Exiting support mode revokes the impersonation token immediately
- Impersonation sessions must be logged: start, end, and every write action performed during the session
- Tenant users must never be able to impersonate other tenants

**Architecture notes:**
- Extend JWT payload with `impersonatedBy: adminUserId` and `impersonation: true` flag
- RBAC middleware must respect this flag for read/write routing
- Audit log model must accept `actingAdminId` as an optional field on sensitive writes

---

### 2. Agent Always Speaks First — ✅ DONE

**What:** When a call connects (inbound or widget), the AI agent must open the conversation immediately — the caller should never hear silence waiting for the human to speak first.

**Requirements:**
- On session start, inject a "greeting trigger" into the Gemini Live session before any user audio arrives
- The greeting content comes from the tenant's active Business DNA (identity.greeting or similar field) and the agent's prompt
- This must work for both Twilio inbound calls and widget sessions
- Configurable per channel: admin/tenant can toggle "agent speaks first" on each channel config

**Architecture notes:**
- Voice gateway `inbound.ts` and `widget.ts` session init must send an initial text turn to Gemini immediately after the session is established
- Do not wait for STT input — send a synthetic user turn (e.g. `[CALL_CONNECTED]`) to trigger the greeting
- The greeting prompt layer should be part of the Layer 3 channel overlay in the prompt stack

---

### 3. Reduce Agent Response Latency — 🟡 PARTIAL (telemetry shipped, tuning data-gated)

**What:** The gap between the caller finishing speaking and the agent beginning to respond is too long. Needs investigation and reduction.

**Requirements:**
- Profile the full latency chain: STT end-of-utterance detection → Gemini response start → TTS first audio byte → Twilio playback
- Identify whether the bottleneck is in VAD (voice activity detection), Gemini streaming, or audio chunking
- Target: first agent audio byte within 800ms of caller silence
- Solutions to evaluate:
  - Reduce VAD silence threshold in Twilio Media Streams
  - Enable Gemini streaming and begin playback on first audio chunk rather than waiting for completion
  - Pre-warm Gemini sessions before calls arrive (keep a pool of idle sessions)
  - Reduce audio chunk size for lower buffering delay

**Architecture notes:**
- All latency improvements must be in `apps/voice-gateway`
- Do not change prompt content to achieve latency wins — that is a separate concern
- Log latency metrics per session to `Conversation.metadataJson` for ongoing monitoring

---

### 4. Conversations Page — Bulk Actions, Download, Search, Filters, Sort — ✅ DONE

**What:** The conversations list needs production-grade data management capabilities.

**Requirements:**
- **Select boxes:** checkbox on each row, plus a "select all on page" checkbox in the header
- **Bulk delete:** delete selected conversations (soft-delete preferred; hard-delete only if explicitly configured)
- **Download:** download selected conversations as a ZIP containing:
  - A CSV or JSON metadata file (date, duration, channel, outcome, summary)
  - The matching audio file (MP3 from Bunny storage) for each conversation that has a recording
  - The transcript JSON for each conversation that has one
- **Search:** full-text search across contact name, phone number, and summary text
- **Filters:** filter by channel type (INBOUND / OUTBOUND / WIDGET), status (COMPLETED / MISSED / FAILED / OPEN), date range, recording presence
- **Sort:** sort by date (default: newest first), duration, status

**Architecture notes:**
- Download endpoint: `POST /api/conversations/export` — accepts array of conversation IDs, returns a signed URL to a pre-built ZIP in Bunny storage
- ZIP is built server-side (Node.js `archiver` or similar), uploaded to Bunny, and the signed URL is returned to the browser
- Search uses PostgreSQL full-text index on `summaryText` + `Contact.fullName` + `Contact.phoneE164`
- Filters and sort are query parameters on `GET /api/conversations`
- Bulk delete must be audit-logged

---

### 5. Channel Availability Controlled by Tier — Admin-Configured — ✅ DONE

**What:** Which channels a tenant can enable (widget, inbound, outbound) must be determined by the tier they are on. Tier feature flags are configured by platform admins, not hardcoded.

**Requirements:**
- Admin tier configuration card (in admin dashboard) gets a set of feature toggle switches:
  - Widget enabled
  - Inbound receptionist enabled
  - Outbound caller enabled
  - (Extensible for future channels)
- These switches are stored as plan entitlements (already exist as `widget_enabled`, `inbound_enabled`, `outbound_enabled`)
- The tenant's channel configuration page must read entitlements and disable/lock channels the tenant's tier does not include
- Locked channels show a "Not available on your plan — upgrade to unlock" message with a link to billing
- Admin can override entitlements per tenant individually (manual override already partially exists)

**Architecture notes:**
- Entitlement keys `widget_enabled`, `inbound_enabled`, `outbound_enabled` are already in the schema and seed
- Admin plan editor needs a UI to edit these boolean entitlements per plan
- Channel config page must call `GET /api/entitlements` and gate each channel card accordingly

---

### 6. Tooltips Throughout the App — 🟡 PARTIAL

**What:** Add contextual tooltips to form fields, buttons, configuration options, and status indicators across all tenant and admin pages.

**Requirements:**
- Tooltips should appear on hover (desktop) or tap (mobile) for any non-obvious field or control
- Priority areas: Business DNA section labels, agent configuration fields, channel config options, billing entitlement labels, admin storage tier controls
- Tooltip content should be concise (1–2 sentences max) and written in plain language
- Implement a reusable `<Tooltip>` component in `packages/ui` that accepts `content` and `children` props
- Use a lightweight library (e.g. Floating UI / `@floating-ui/react`) or a pure CSS approach — avoid heavy dependencies

**Architecture notes:**
- `Tooltip` component lives in `packages/ui/src/Tooltip.tsx`
- Tooltip content strings can be co-located with each page/component — no need for a separate i18n system at this stage
- Ensure tooltips do not obscure critical UI elements and are keyboard-accessible (show on focus as well as hover)

---

### 7. Full Help Section — ✅ DONE

**What:** A comprehensive in-app help system covering every feature and function in the product.

**Requirements:**
- Accessible from a persistent help icon/button in the top bar or sidebar footer
- Organised by section matching the sidebar navigation (Dashboard, Business DNA, Prompts, Agents, Channels, Integrations, Billing, etc.)
- Each article covers: what the feature does, how to configure it, common mistakes, and what happens if it is misconfigured
- Search within the help section
- Help content is stored as markdown files in the repo under `docs/help/` and rendered in-app
- Admins can update help content by editing markdown files — no CMS required at this stage
- Future: contextual help links from individual pages/fields that open the relevant help article directly

**Architecture notes:**
- Help articles live at `docs/help/<section>/<article>.md`
- In-app help page at `/help` renders the article tree and a search index built from the markdown at build time
- Use `next-mdx-remote` or similar for rendering markdown in Next.js
- Help is tenant-facing only; admin-specific help articles can be added under `docs/help/admin/`

---

### 8. Phone Usage Section — ✅ DONE

**What:** Tenants need visibility into their phone number usage (minutes used, calls made, SMS sent). Admins configure the limits as part of the tier settings.

**Requirements (tenant-facing):**
- Usage dashboard card or dedicated `/usage` page showing:
  - Minutes used this billing period vs. quota (`minutes_per_month` entitlement)
  - Number of inbound calls, outbound calls, SMS sent this period
  - Visual progress bar for minutes consumed
  - History chart (last 3–6 months)
- Quota warning when usage reaches 80% and 95% of limit

**Requirements (admin-facing):**
- Tier configuration card in admin gets a `minutes_per_month` field (already exists as an entitlement key)
- Admin can set per-tenant minute overrides from the tenant detail page
- Usage data is read from the `Conversation` table (count + duration) and `SmsLog` table

**Architecture notes:**
- New API endpoint: `GET /api/usage/summary` — returns current period usage aggregates for the authed tenant
- Usage data is computed from existing `Conversation` and future `SmsLog` records — no separate usage ledger needed initially
- Entitlement key `minutes_per_month` already exists; enforce it at the gateway layer when a new call session starts

---

### 9. Finish Google Integration — ✅ DONE

**What:** The Google OAuth flow is built but several downstream features are incomplete.

**Outstanding items:**
- [ ] Gmail send — agent must be able to send follow-up emails from the connected Google mailbox after a call
- [ ] Calendar read — fetch real availability from Google Calendar for appointment booking (freebusy already implemented; wire it to the booking flow end-to-end)
- [ ] Calendar write — create, update, and cancel Google Calendar events from appointment actions
- [ ] Token refresh reliability — verify auto-refresh works under load and on token expiry edge cases
- [ ] Reconnect flow — tenant can reconnect Google without losing existing calendar/email config
- [ ] Test the full OAuth callback → connected state → disconnect → reconnect cycle manually
- [ ] Surface the connected Google email address in the agent's prompt context so it can reference the mailbox

**Architecture notes:**
- `getAuthenticatedGoogleClient()` already handles token refresh — verify it handles concurrent requests safely
- Gmail send uses the Gmail API `users.messages.send` method on the authenticated client
- All Google actions must be audit-logged

---

### 10. Calendar Integrations — Coming Soon Placeholder — ✅ DONE

**What:** Future calendar integrations beyond Google (Outlook/Microsoft 365, Calendly, Cal.com) should be visible in the integrations page with a "Coming soon" state to set expectations.

**Requirements:**
- Integrations page shows cards for: Google Calendar (active), Outlook Calendar (coming soon), Calendly (coming soon), Cal.com (coming soon)
- Coming soon cards are visually distinct (muted, locked icon, "Coming soon" badge)
- Clicking a coming soon card shows a brief description of what the integration will do
- No backend work required for the placeholder cards

---

### 11. Logo Upload — Profile and Placeholders — ✅ DONE

**What:** Tenants should be able to upload their business logo, which then appears throughout the app wherever a brand placeholder currently exists.

**Requirements:**
- Logo upload field in workspace settings (`/settings`) or business profile
- Accepted formats: PNG, JPG, SVG — max 2MB
- Uploaded logo stored in Bunny storage under `tenants/{tenantId}/logo`
- Logo URL stored in `BusinessProfile.logoUrl` (add field to schema)
- Logo displays in:
  - The sidebar brand area (replacing or alongside the "MyOrbisVoice" wordmark for tenant users)
  - The profile/settings page header
  - Any tenant-facing email templates (future)
  - Widget session UI (future)
- Admin can see the uploaded logo on the tenant detail page

**Architecture notes:**
- Upload endpoint: `POST /api/business-profile/logo` — multipart/form-data, returns the stored URL
- Validate file type and size server-side before uploading to Bunny
- Logo URL must be publicly accessible (no auth required) since it appears in widget and email contexts

---

### 12. New Conversation Notifications — Push, Desktop, In-App — ✅ DONE

**What:** When a new conversation (call or chat) comes in, the tenant should be notified on their phone, desktop, and within the app in real time.

**Requirements:**
- **In-app:** Real-time badge/count on the Conversations nav item; a toast notification in the top bar when a new call arrives
- **Desktop (browser push):** Web Push notification via the Push API + Service Worker — shows caller ID, channel type, and time
- **Mobile push:** When mobile app is built, integrate with FCM (Firebase Cloud Messaging) or APNs for iOS/Android push
- Notifications are per-tenant — a tenant only receives notifications for their own conversations
- Tenants can configure notification preferences (all calls, missed only, none) in settings
- Notification must fire on `Conversation` creation (status = OPEN) and on `Conversation` status change to MISSED

**Architecture notes:**
- In-app real-time: use a Server-Sent Events (SSE) stream at `GET /api/events/stream` or a WebSocket channel for push to the browser
- Web Push: store `PushSubscription` objects per user in a new `PushSubscription` DB table; use `web-push` npm package to send
- FCM integration deferred until mobile app is built; design the notification dispatch service to be provider-agnostic from day one
- All notification sends must be non-blocking — failure to notify must never fail the call session itself

---

### 13. Admin / Support Help Section — comprehensive operator guide — ✅ DONE (text), 🟡 PARTIAL (screenshots — see #14)

**What:** A dedicated help center for **platform admins and support staff** (separate from the tenant-facing `/help` we already shipped). Covers every admin function with step-by-step processes, expected outcomes, troubleshooting paths, and **screenshots of each UI element** so support can confidently walk customers through fixes without having to navigate the system themselves first.

**Audience:** OrbisVoice platform admins (us) and any support staff we hire. Lives at `/admin/help` (admin route, not exposed to tenants).

**Required structure for every help article:**

Each article follows this template so support staff get consistent, actionable info:

1. **What this feature does** — 1-2 sentence summary of purpose
2. **Where to find it** — exact navigation path with screenshot of the entry point
3. **Step-by-step procedure** — numbered list, with a screenshot at every step that has a UI to click
4. **What success looks like** — screenshot of the expected end state
5. **Common issues** — bulleted list of things that go wrong, with screenshots of each error state and the fix
6. **Audit log signature** — what action name(s) appear in `AuditLog` after this operation completes (so support can verify in the audit table)

**Screenshot pattern (critical):**

Every help article must have **placeholder slots for screenshots** even before they're captured. Pattern:

```markdown
### Step 3 — Click the Suspend button
[SCREENSHOT: tenant-detail-suspend-button.png — top-right of the tenant detail page, red button labeled "Suspend"]

The button is in the top-right next to "Enter as tenant →"...
```

This way the article reads correctly even before screenshots are captured, and we have a precise list of every screenshot we need. Screenshots live in `apps/web/public/admin-help/<article-id>/<step>.png`. The renderer falls back to a labeled placeholder box if a screenshot file is missing.

**Articles to cover (initial scope — all features as of 2026-05-02):**

**Tenant management**
- View tenant list, search, filter by status (TRIAL / ACTIVE / SUSPENDED / PAST_DUE)
- Tenant detail page — read every field, what each means
- Suspend / restore a tenant — when to use, audit trail
- Rename a tenant
- Enter as tenant (impersonation / support mode) — how to enter, what changes, how to exit, audit policy
- **Grant a plan tier (Stripe-bypass) — internal testing only**
- Revoke admin grant
- Delete a tenant — destructive, when allowed
- View members of a tenant
- Storage tier assignment + manual quota overrides

**Plan management**
- View Plans list, accordion behavior
- Edit a plan's entitlements (the integer/boolean fields)
- Add Stripe price IDs to plans
- Set / change plan price displayed to customers
- Mark a plan inactive (no longer purchasable)

**Billing operations (Stripe)**
- Find a customer's Stripe customer ID + open in Stripe dashboard
- Read the Subscription audit trail — what each `billing.*` action means
- Manually sync entitlements after a Stripe-side change
- Switch between Stripe test mode / live mode (which keys to update where)
- Stripe webhook event types we listen for + what each does

**Twilio operations**
- Connect a tenant's Twilio account — Account SID / Auth Token / Phone Number
- Verify the Twilio webhook signature is enforced
- Diagnose why a tenant's outbound calls aren't connecting
- Diagnose why SMS isn't being delivered (10DLC approval check, Brand state, Campaign state)
- Read the Twilio compliance flags on the tenant detail page

**Voice gateway / call diagnostics**
- Find a specific Conversation by ID, phone number, or contact name
- Read transcripts and summaries
- Listen to recordings (where they live, how to retrieve them from Bunny)
- Diagnose a "call dropped" complaint
- Diagnose a "the agent didn't say X" complaint — pulling the prompt stack that was active

**Affiliate operations**
- Approve / reject an affiliate application
- View commission ledger
- Process a payout request manually
- Pause / disable an affiliate
- Read the affiliate audit trail

**Integrations**
- Reconnect a tenant's Google account
- Diagnose Google Calendar booking failures
- Reconnect a tenant's Twilio if their auth token rotated
- Reconnect Stripe (rare — usually handled via webhook)

**System settings (super-admin)**
- Update encrypted secrets in System Settings (Stripe / Twilio / Google / OpenAI / Bunny / Reoon / SMTP)
- Rotate AUTH_SECRET (process for handling re-encryption of stored secrets)
- View system-wide audit log
- View system-wide usage metrics

**Each one of the above gets its own article with the 6-section template.**

**Screenshot capture workflow:**

When we build this:
1. The renderer falls back to a "[ Screenshot: filename — description ]" placeholder box if the image file is missing
2. We can ship the help section in two waves: first wave = all text + all placeholder boxes (works immediately for support staff). Second wave = capture every screenshot using a real test environment, drop them into the right paths.
3. Screenshot capture script (optional): a Puppeteer script in `apps/e2e/scripts/capture-admin-help-screenshots.ts` that logs in as admin, navigates each documented page, and saves screenshots at the named paths. Maintains parity with the doc whenever the UI changes.

**Architecture notes:**

- New help content data structure: `apps/web/src/lib/adminHelpContent.ts` — same shape as `helpContent.ts` but with extended schema for screenshot slots
- New page: `apps/web/src/app/(admin)/admin/help/page.tsx` — admin-only route (`requirePlatformAdmin`)
- New `<ScreenshotSlot>` component: renders the image if file exists, otherwise a styled placeholder box with the filename and description so the gap is obvious
- Same URL hash deep-linking pattern as `/help` so "I'll show you exactly where to click" links from internal Slack / email work

**Why this matters:**

As the platform grows, we will not always be the only people doing support. Support staff, contractors, and (eventually) hired agents need to navigate every admin function without ramp-up time. Without this, every weird customer issue becomes a fire drill where someone has to learn the system on the fly. With it, support is a checklist exercise.

---

### 14. Automated Help Center Screenshot Capture (Playwright) — 🔵 DEFERRED-BY-DESIGN (gated by feature-testing sprint per below)

**What:** A repeatable, scripted system that logs into the live app via headless browser, navigates through every screenshot slot defined in `helpContent.ts` and `adminHelpContent.ts`, captures the real UI, and saves PNGs to the matching paths. Run it once → all 65 tenant + 15 admin screenshots auto-populate. Re-run anytime the UI changes → all screenshots refresh.

**Why automation, not AI image generation:** AI-generated images (DALL-E, Flux, Midjourney) invent UI that does not match production. For instructional screenshots that say "click the teal Publish button at the bottom-right," the user must see the EXACT button at the EXACT location — generated approximations actively confuse readers. Help center images must come from the real app, captured deterministically.

**Command interface:**

```bash
pnpm capture-screenshots                      # all (tenant + admin)
pnpm capture-screenshots --tenant             # tenant help only (~65)
pnpm capture-screenshots --admin              # admin help only (~15)
pnpm capture-screenshots --section dna        # single section by id
pnpm capture-screenshots --filename foo.png   # single file by name (debug)
pnpm capture-screenshots --diff               # capture + visual-diff vs prior commit (regression test)
```

**Architecture:**

- **Script location:** `apps/e2e/scripts/capture-screenshots.ts`
- **Dependency:** `playwright` + `@playwright/test` (already used by the e2e suite, so no new dependency tax)
- **Auth flow:** logs in once as `admin@myorbisvoice.com`, persists cookies. For tenant-side screenshots, uses the **admin grant-plan** flow to upgrade a fixed test tenant to whatever tier each screenshot needs.
- **Schema extension:** each `screenshot` entry in `helpContent.ts` / `adminHelpContent.ts` gets optional capture metadata:
  ```typescript
  screenshots?: Array<{
    filename: string
    caption: string
    capture?: {
      url: string                        // page to navigate to (relative or absolute)
      selector?: string                  // optional CSS selector to crop to (full page if omitted)
      setup?: Array<{ action: 'click' | 'type' | 'wait'; selector?: string; value?: string }>
      authAs?: 'admin' | 'tenant'        // default 'tenant'
      tier?: string                      // grant this plan to test tenant before capturing
      viewport?: { width: number; height: number }  // default 1280x800
      fullPage?: boolean                 // default false
    }
  }>
  ```
- **Seed data:** a dedicated "screenshots-demo" tenant with rich seed data (multiple Business DNA versions, prompts, agents enabled, channels configured, a few conversations, contacts, and a sample campaign). Lets us capture screenshots that depend on data existing — list views, detail pages, populated tables.
- **Output paths:** `apps/web/public/help-screenshots/<filename>.png` (tenant) and `apps/web/public/admin-help-screenshots/<filename>.png` (admin).
- **Failure handling:** if a selector doesn't match or a page returns an error, the script logs the failure and continues — does not block on a single broken screenshot. Final summary lists what failed and why so we can fix metadata or add seed data.

**Visual regression bonus:**

Same script doubles as a visual regression test. Add `--diff` flag → captures into a temp dir, pixel-diffs against the existing PNGs, posts a side-by-side report. Lets us catch unintended UI changes before they ship.

**Lint check (CI):**

Add a CI step that fails if `helpContent.ts` references a screenshot filename that:
1. Has no matching capture metadata, AND
2. Has no PNG file at the expected path

This prevents "ghost" screenshot references from accumulating without ever being captured.

**Effort estimate:**

| Phase | Time |
|---|---|
| Schema extension for capture metadata | ~30 min |
| Add capture metadata to existing 80 screenshot entries | ~2 hours |
| Build the Playwright script + auth + tenant-grant integration | ~1.5 hours |
| Create the screenshots-demo tenant seed (Prisma seed script extension) | ~1 hour |
| First end-to-end run + debugging (selectors, timing, modal states) | ~1.5 hours |
| **Total** | **~6 hours** |

After this, the cost per UI change is one command. The cost per new help article is 3 lines of capture metadata.

**Dependencies / prerequisites:**

- Build this **AFTER** the upcoming tenant feature testing sprint. Reason: the test sprint will surface UI bugs that need fixing first. Capturing screenshots against a buggy UI = wasted effort. Order is: test → fix bugs → capture screenshots once UI is stable.
- Requires the admin grant-plan feature (✅ already shipped — backlog #13's prerequisite is in place).

**What this does NOT solve:**

- Screenshots that depend on Stripe checkout pages (those are Stripe-hosted iframes — would need to capture them manually or use Stripe test mode in a separate flow).
- Twilio Console deep-link screenshots (Twilio's site is third-party — separate manual capture pass with the @myorbisvoice.com Twilio account).
- Any screenshot showing real customer data (we capture against the demo tenant only, so this is structurally avoided).

**Why this matters:**

A help center with stale or missing screenshots erodes user trust and increases support load. Manual screenshot maintenance scales linearly with article count and inversely with how often the UI changes — both metrics that get worse as the product matures. Automating the capture flips the cost curve: more articles + more UI changes both become essentially free in maintenance terms.

---

### 15. Voice dispatch for tag-driven campaigns — 🔵 DEFERRED v1.1

**What:** Wire the campaign scheduler's `dispatchVoice()` to actually place outbound calls when a `Campaign` enrollment with `channel=VOICE` is due. Currently this path is a stub that marks enrollments FAILED with the note "voice dispatch from tag-driven campaigns not yet wired."

**Why it isn't done yet:** `OutboundCallAttempt` belongs to `OutboundCampaign` (a separate, list-based campaign model), not to the tag-driven `Campaign` model. Reusing it requires either:
- Extending `OutboundCallAttempt` with a polymorphic source (campaignId from either model), or
- Building a parallel `CampaignVoiceCall` table for tag-driven voice dispatch, or
- Bridging the two models so a tag-driven enrollment creates a synthetic OutboundCampaign run

**Required behavior:**
- When the scheduler picks a PENDING enrollment with `channel=VOICE`, the dispatch must:
  1. Resolve the contact's `phoneE164` and the tenant's outbound caller-id (Twilio number assigned to the tenant subaccount)
  2. Place a Twilio outbound call via the tenant subaccount, with TwiML pointing at the voice gateway's outbound entry point
  3. Inject the campaign's `prompt` field as the agent's run-time prompt overlay (Layer 5 of the prompt stack — session context)
  4. Honour `maxRetries` and `retryIntervalHours` on no-answer / busy / failed states
  5. Record the call in `Conversation` with the enrollment id in `metadataJson` so the conversations page can show "campaign: Booking Confirmation"

**Architecture notes:**
- Voice gateway already supports outbound flows (see `apps/voice-gateway/src/outbound.ts`); the missing piece is the API endpoint that issues the call command to Twilio with the right callback URL pointing at the gateway
- Use the same prompt-resolution path as inbound (Business DNA + agent role overlay + per-call campaign prompt overlay)
- All voice events must produce a transcript + recording per the platform standard (`Conversation.transcriptJson`, `recordingRef`, `summaryText`)
- The current SMS-only and email-only campaigns must keep working with no regressions when this lands

**Why this matters:** Voice is the highest-conversion follow-up channel in this product. Email is good for confirmations; voice is good for callbacks, missed-call recovery, and re-engagement. The campaign system is structurally complete without it but operationally limited.

---

### 16. Move campaign SMS dispatch to per-tenant subaccount routing — 🔵 DEFERRED (pending Twilio A2P 10DLC)

**What:** The campaign scheduler's `dispatchSms()` currently calls `sendTestMessage()` from `sms.service.ts`, which uses the **master** Twilio account credentials directly. This works for testing while A2P 10DLC is pending, but production SMS must route through each tenant's own Twilio subaccount.

**Why it isn't done yet:** Tenant subaccount provisioning (`getSubaccountClient`) requires a complete onboarding step (subaccount created, phone number assigned, brand registration, A2P 10DLC campaign approval) that not every tenant has finished. Routing campaign SMS through `sendMessage()` (which uses subaccounts) would fail for tenants without subaccounts. Routing through master keeps things working for the validated test-tenant flow until subaccount onboarding is mandatory.

**Required behavior:**
- `dispatchSms()` calls `sendMessage()` with `tenantId`, `from=<tenantSubaccountPhone>`, `to=<contact.phoneE164>`, `body`
- `sendMessage()` does opt-out gating, MessageLog persistence, and the actual Twilio send through the subaccount client
- If a tenant has no subaccount or no assigned phone number, the enrollment should mark FAILED with a clear `exitReason="tenant has no SMS-capable phone number"`, not crash
- WhatsApp follows the same pattern when the WhatsApp dispatcher graduates from "coming soon"

**Pre-conditions before flipping:**
- Toll-free verification approved on the master account (verified TFN can serve as the temporary platform-wide outbound number for tenants whose A2P isn't done) OR per-tenant A2P approved
- Subaccount provisioning is part of mandatory onboarding (not optional)
- Opt-out flows are tested end-to-end on the per-tenant path

**Why this matters:** Compliance. Carrier-required A2P 10DLC registration is per-brand; the brand is the tenant's business, not OrbisVoice. Sending tenant traffic from the platform's master account would violate the registration model and risk all tenant traffic being blocked together. Subaccount routing isolates compliance state per-tenant.

---

### 17. Twilio testing path completion — 🟡 IN-FLIGHT

**Status:** The infrastructure is shipped; three real-delivery proofs are pending external dependencies.

**Three testing paths (from 2026-05-04 evening session):**

1. **Test Credentials + magic numbers** — code-path verified via direct service invocation. Pending: paste Test SID + Test Auth Token from `console.twilio.com → Account → API keys & tokens → Test Credentials` into `Admin → System Settings → Twilio Test Credentials`. Then run `Send Test SMS` with `mode=test` to see Twilio return a simulated success.

2. **Toll-free number verification** — verification submission package drafted at `docs/twilio-toll-free-verification.md`. Pending: provision a toll-free number on the ISV master account, fill in the placeholders (LightBox SEO LLC EIN, business address, contact phone), submit verification form. ETA: 2–5 business days for approval.

3. **International real-delivery** — pending a non-US phone number from the user. Once provided, run `Send Test SMS` with `mode=live` and the international `to=`; bypasses A2P entirely.

**Why this matters:** Each path proves a different thing. Test Credentials prove the code path. Toll-free verification proves real US delivery without waiting on A2P. International proves end-to-end live delivery today. All three together = full confidence the SMS pipeline is production-ready the moment carrier registration lands.

---

### 18. WhatsApp dispatch (currently disabled in form) — 🔵 DEFERRED (pending Meta verification)

**What:** The campaign form already has a WhatsApp toggle (disabled with "Coming soon" badge), the schema persists `enableWhatsapp` and `whatsappBody`, the scheduler routes `channel=WHATSAPP` to `dispatchSms(channel='WHATSAPP')` which prefixes `whatsapp:` to the to/from numbers — the only missing piece is provisioning Twilio's WhatsApp Business API.

**Required behavior:**
- Provision a WhatsApp sender number through Twilio Console (separate from voice/SMS, requires Meta Business verification)
- Drop the `comingSoon` flag on the WhatsApp `<ChannelToggle>` in the campaign form
- The dispatch path already works once a `whatsapp:+E.164` sender exists in the platform config

**Architecture notes:**
- Inbound MessageLog already routes WhatsApp via `resolveChannel()` — both directions handled
- Opt-out is per-channel (`Contact.optedOutWhatsapp` is separate from `optedOutSms`)
- WhatsApp's 24-hour customer-care window restricts unsolicited sends to approved templates only — the campaign system's free-form `whatsappBody` only works for replies inside that window. Outside it, must use a pre-approved Twilio Content Template.

**Why it matters:** WhatsApp is dominant outside the US for business messaging. International tenants will expect it.

---

### 19. Outbound voice carrier reputation — 🔵 DEFERRED v1.1

**Status:** Deferred 2026-05-04. Outbound voice dispatch from tag-driven campaigns is fully wired and structurally verified, but **calls are silently rejected by carrier signaling layer with `busy` in 0 seconds** before reaching the recipient device — even with the recipient number in the user's contacts. Confirmed across two different from-numbers (`+14043830220` Atlanta and `+19296403810` NYC), so it's not the specific number, it's an upstream filtering pattern.

**What's verified working:**
- Twilio accepts the outbound API request (real Call SID returned)
- Status webhook fires back to our handler
- Bridge correctly propagates outcome → CampaignEnrollment status
- Master vs subaccount Twilio client picked correctly based on `PhoneNumber.twilioSubaccountSid`
- Synchronous dispatch failures bubble up cleanly (no enrollments stuck in IN_PROGRESS)

**Suspected root causes (in priority order):**
1. **STIR/SHAKEN attestation low/missing** — fresh Twilio numbers without proper attestation get blocked by Verizon/AT&T/T-Mobile spam filters. This is the most common explanation for the exact 0-second `busy` pattern we observed.
2. **Master Twilio account voice trust score** — newly-set-up account with no completed registrations may have outbound calling restrictions until reputation builds.
3. **Carrier-side anti-spam** (Verizon Call Filter, AT&T Active Armor, T-Mobile Scam Shield) blocking at the network edge before the call reaches device or contacts.

**Likely fixes (require external wait or paid registration — needs explicit user direction):**
- A2P 10DLC approval (already pending Twilio approval) — improves overall account voice rep too
- CNAM registration on the from-number (~$1/mo) — sets the displayed caller name, helps carriers treat the call as legitimate
- Twilio Trust Hub: Customer Profile + Voice Brand registration — formal process, takes days
- Wait for organic reputation to build (low-volume legitimate traffic over weeks)

**Why deferring is the right call for v1:**
- Target verticals (dental, legal, home services, fitness, beauty) primarily use INBOUND voice (verified working end-to-end). Outbound voice campaigns are an advanced workflow most v1 customers won't reach immediately.
- Email campaigns are verified end-to-end TODAY (real Gmail dispatch via OAuth) — that's the immediate follow-up channel.
- SMS campaigns are wired and waiting on the same A2P approval.
- Day A2P clears, voice reputation almost certainly improves and these calls start ringing through with no further code changes.

**Resolved 2026-05-04:** the originally-unauthorized purchase of `+19296403810` (Twilio SID `PN8cdda6a103...`, $1.15/mo on master account) was decided KEEP by the user. Now an authorized platform resource. Marked outbound + voice + SMS enabled on test tenant `4259d0f4-b160-4b12-83d1-b7ed0f101c2c` in PhoneNumber table. The "no purchases without explicit yes" rule still holds going forward — see `feedback_no_unauthorized_purchases.md` in memory.

---

### 20. Self-service A2P 10DLC registration wizard (TENANTS + ADMIN) — 🟡 PARTIAL

**Already built (audited 2026-05-05):**

| Piece | Where | Status |
|---|---|---|
| `TenantA2PApplication` Prisma model — 29 fields covering legal identity, address, auth rep, use case, sample messages, Twilio SIDs, status enum (DRAFT / SUBMITTED / APPROVED / REJECTED) | [prisma/schema.prisma:670](prisma/schema.prisma#L670) | ✅ shipped |
| API: `GET /api/a2p` returns the tenant's current application | [routes/a2p.ts:44](apps/api/src/routes/a2p.ts#L44) | ✅ shipped |
| API: `PUT /api/a2p` upserts form data (zod-validated, EIN format check, sample-message length bounds) | [routes/a2p.ts:51](apps/api/src/routes/a2p.ts#L51) | ✅ shipped |
| API: `POST /api/a2p/submit` flips DRAFT → SUBMITTED + audit log | [routes/a2p.ts:113](apps/api/src/routes/a2p.ts#L113) | ✅ shipped — but only flips status; no Twilio API call yet |
| Tenant UI form at `/a2p` (single-page, all fields) — bilingual, status pill, rejection reason display | [a2p/page.tsx](apps/web/src/app/(dashboard)/a2p/page.tsx) | ✅ shipped |
| Onboarding checklist integration (#6 step "SMS Compliance" reads `TenantA2PApplication.status`) | [routes/onboarding.ts](apps/api/src/routes/onboarding.ts) | ✅ shipped |

**Functional today:** A tenant can fill the form, save it as DRAFT, edit it freely, and click Submit which flips status to SUBMITTED. Admin/ops can then take that data + post to Twilio Trust Hub manually via Console. Ships value as a "structured data capture" today even before the full automation lands.

**Remaining work to finish:**

| Piece | Estimate | Why it's left |
|---|---|---|
| Twilio Trust Hub integration on `/a2p/submit` (8 sequential API calls, retry logic, Customer Profile → Supporting Documents → End User → Trust Product → Evaluation → Brand → Campaign → Phone Number link) | 2-3 days | Requires Twilio ISV approval for Trust Hub access — confirm we have it |
| Multi-step wizard refactor with the 4 gap-handling patterns (gap scan, inline editor + back-fill, pause-and-resume, Brand-vs-Campaign phase split) | 1-2 days | Current UI is single-page; for production-friendliness on real tenants, the wizard pattern is what makes it bulletproof |
| Admin-side mount at `/admin/a2p` for platform-owned numbers (MyOrbisVoice LLC) | half-day | Reuses tenant wizard component with scope=`platform` |
| Twilio status webhook receiver — flip `status` from SUBMITTED → APPROVED / REJECTED automatically | 1 day | Requires the Trust Hub integration to be live first |
| Auto-link approved campaign to tenant's `IncomingPhoneNumbers` after status flips to APPROVED | half-day | Same logic for both scopes |
| File upload for supporting documents (EIN letter PDF, gov ID) | half-day | Forwards to Twilio's `SupportingDocuments` endpoint |
| **Total remaining** | **~5-7 working days** | — |

**⚠ Scope clarification — TENANTS + PLATFORM, NOT PARTNERS.** A2P 10DLC is the carrier-required registration for sending SMS in the US. It applies to two distinct accounts:

**⚠ Scope clarification — TENANTS + PLATFORM, NOT PARTNERS.** A2P 10DLC is the carrier-required registration for sending SMS in the US. It applies to two distinct accounts:

1. **Tenants** — the businesses using MyOrbisVoice as their AI receptionist who want to send SMS from their *tenant-subaccount* Twilio numbers. Wizard registers the tenant's brand + campaign on their own subaccount.
2. **Admin / platform owner** (MyOrbisVoice itself) — has master-account phone numbers used for the platform's own outbound SMS (test sends, support comms, ops notifications). Same wizard registers MyOrbisVoice LLC as the brand on the master account.

Partners (who refer customers and get paid via Stripe Connect) are a completely separate flow and never touch A2P.

**What:** Multi-step wizard that runs on EITHER the tenant dashboard OR the admin dashboard. Same UI component, same form fields, same 8 Twilio Trust Hub API calls underneath — only difference is which Twilio client (subaccount vs master) the calls route through and which DB scope the application row attaches to (current schema only has `tenantId`; admin-scope flow needs `tenantId` nullable to support platform-level applications).

**Where it lives:**
- **Tenant surface** — `/phone-numbers` page. "Register for SMS" CTA appears after the tenant has purchased their first subaccount number.
- **Admin surface** — new `/admin/a2p` page. Lists existing master-account A2P registrations (if any) and offers the same wizard to register MyOrbisVoice's own platform numbers.
- Admin can also trigger the tenant flow via impersonation if a specific tenant needs help.

**Why this matters:** Today, the tenant's path to send SMS is "go log into Twilio Console, navigate the maze, register A2P manually." That's a competitive disadvantage versus other CPaaS resellers, and at scale (50+ tenants) it becomes operationally impossible to support. Self-service registration is a meaningful product moat.

**Why this is NOT a launch blocker:** First 5-20 tenants can have A2P registered manually (either by us in our master Twilio account, or by them in their own subaccount). The wizard pays for itself only once we feel the manual-pain at higher volume. Build AFTER soft-launch surfaces real friction patterns.

**API surface (Twilio Trust Hub + A2P endpoints) — fully automatable:**

| Step | Twilio API | Our wizard step |
|---|---|---|
| Customer Profile | `POST /v1/CustomerProfiles` | "Business identity" — legal name, EIN, type, vertical, address |
| Supporting Documents | `POST /v1/SupportingDocuments` | File uploads — EIN letter, articles of incorporation |
| End User profile | `POST /v1/EndUsers` | Authorized rep contact info |
| Trust Product (A2P bundle) | `POST /v1/TrustProducts` | Bundles the above |
| Submit for evaluation | `POST /v1/TrustProducts/{Sid}/Evaluations` | Triggers Twilio pre-flight |
| Brand Registration | `POST /v1/a2p/BrandRegistrations` | Standard or Low-Volume Standard ($4 or $44) |
| Campaign Registration | `POST /v1/a2p/Brands/{Sid}/Campaigns` | Use case + sample messages + opt-in flow |
| Phone Number → Campaign link | Update IncomingPhoneNumber or Messaging Service | Auto-fired by us when Campaign status = `VERIFIED` |

Status transitions tracked via webhooks (`twilio-approved`, `in-review`, `twilio-rejected`, `verified`, `failed`).

**Realistic effort to build:**

| Piece | Estimate |
|---|---|
| `A2PRegistration` Prisma model with `tenantId String?` (null = platform-level) + state-machine fields | half-day |
| Multi-step wizard UI component (4-5 screens), bilingual EN+ES — shared between tenant and admin surfaces | 1-2 days |
| Backend Trust Hub integration (8 sequential POSTs with retry/error handling) — accepts `scope: 'tenant' \| 'platform'` to pick subaccount vs master client | 2-3 days |
| File upload + forwarding to SupportingDocuments | half-day |
| Twilio status webhook receiver + DB state updates (single handler covers both scopes) | 1 day |
| Auto-link approved campaign to IncomingPhoneNumbers (tenant's subaccount numbers OR master account numbers, same logic) | half-day |
| Tenant page mount (`/phone-numbers` CTA → wizard) | half-day |
| Admin page mount (`/admin/a2p` page + wizard) | half-day |
| Admin "view all A2P submissions across the platform" dashboard (tenant + platform rows) | 1 day |
| Test against Twilio sandbox + one real submission end-to-end (test both scopes) | 1-2 days |
| **Total** | **~8-11 working days** |

**Architecture notes:**
- **Scope-driven Twilio client:** the registration service accepts `{ scope: 'tenant' \| 'platform', tenantId?: string }`. When scope=`tenant`, it uses `getSubaccountClient(tenantId)`. When scope=`platform`, it uses the master `getStripe()`-equivalent — `getMasterTwilioClient()`. Same 8 API calls, different Twilio account context.
- **Schema:** `A2PRegistration { id, tenantId String?, scope, brandSid, campaignSid, status, ... }`. `tenantId IS NULL` = platform-level row. Index on `(tenantId, status)` covers tenant queries; full-table scan for platform rows is fine (there's only 1).
- **`BusinessProfile` reuse:** for tenant scope, pre-fills from `BusinessProfile` (the tenant's stored info). For platform scope, pre-fills from a new `PlatformProfile` entry in `SystemConfig` (legal name MyOrbisVoice LLC, EIN, Allentown PA address — the values from `docs/stripe-config.md`).
- **Carrier review queue** (1-4 weeks at AT&T/Verizon/T-Mobile) is external and unavoidable for both scopes. The wizard doesn't shorten it, only makes submission painless.
- **Fees** pass through differently per scope: tenant-scope fees billed to the tenant (or absorbed in plan tier — decision at build time); platform-scope fees billed to MyOrbisVoice's own Stripe customer for the master account.

**Limitations / what can still go wrong:**
- Wrong sample messages or vague message-flow descriptions → campaign rejected at TCR review. Wizard should validate format + provide examples per use case.
- Some supporting docs require human verification on our side (we can sanity-check before forwarding to Twilio).
- Tenants with no EIN (sole props using SSN) need a different flow path.

**Data resilience — handling missing data gracefully (core UX pattern):**

The wizard's value over Twilio Console is precisely that it handles incomplete data without failing. Four patterns it uses:

1. **Pre-flight gap scan.** First wizard screen runs `gapAnalysis()` against all 11 required A2P fields, checks each against the auto-fill source (tenant's BusinessProfile or platform's PlatformProfile), and shows a gap summary: "We have 6 of 11. Here's what we need from you." Sets expectations before the user invests time.

2. **Inline editors with back-fill option.** Each missing field has its own focused step. Editor includes a "Save this to my Business Profile so I don't have to enter it again" checkbox — back-fills the source of truth so future wizards (or other parts of the app) get it for free. Validates format inline (EIN format, URL format, email format).

3. **Pause-and-resume for uploads / external actions.** For fields that need a file (EIN confirmation letter PDF, gov ID scan) or an external acquisition (privacy policy URL the tenant doesn't have yet), the wizard saves draft state to `A2PRegistration.draftJson` with status `DRAFT_PAUSED`. User comes back later, resumes at the exact step they left. Covers the "I need to track this down — I'll be back tomorrow" case.

4. **Natural phase split (Brand vs Campaign).** Twilio's A2P API has two distinct registration phases — brand identity (legal name, EIN, address, vertical → Brand SID) and campaign details (sample messages, opt-in flow, use case → Campaign SID). The wizard surfaces these as Phase A and Phase B with a hard pause between. A tenant with solid business info but undrafted sample messages can complete Phase A today and Phase B next week.

For specifically the "this URL/email/page doesn't exist yet" case (e.g., privacy policy URL):
- Option A: paste an existing URL
- Option B: generate from a platform template ("we'll publish it at `/privacy` on your tenant subdomain")
- Option C: pause the wizard, come back when ready

The wizard never silently submits with stub data — every gap is either filled by the tenant, flagged as deferrable (and submission blocks until resolved), or auto-generated from a documented platform template.

**When to build:** AFTER the soft-launch period (first 5-20 customers). That window will surface which wizard fields trip people up most often, what use cases dominate, whether tenants want full self-service or prefer admin-assisted, and how often the pause-and-resume path actually gets used. Building now without that signal risks designing the wizard around assumptions instead of real friction.

---

### 21. Durable transactional event / outbox (PgQue) — 🔵 DEFERRED (candidate captured)

**What:** A durable, transactional event queue living inside the existing Postgres
— [PgQue](https://github.com/NikolayS/PgQue), a pure SQL/PL-pgSQL revival of
Skype's PgQ. Kafka-style shared log + independent per-consumer cursors. No C
extension, no `shared_preload_libraries`, no sidecar daemon — runs on the
`myorbisvoice-postgres` we already back up + replicate. Client libs for
TypeScript / Python / Go.

**Why it's on the radar (the gap it fills):** today the platform uses Redis
(non-durable queue support) + n8n (orchestration) + Postgres (system of record).
Nothing gives a *transactional* "DB write → guaranteed downstream action." PgQue
does, via an outbox pattern: enqueue the event in the SAME transaction as the
write, so the trigger can't be lost or double-fired on crash/retry.

**Concrete use cases here:**
1. **Transactional outbox** (strongest fit) — Stripe webhook → entitlement sync,
   Twilio status → CRM update, booking → confirmation email. Enqueue with the DB
   write; a consumer drains reliably with at-least-once + cursor tracking.
2. **Outbound dispatch without bloat** — `dispatchPendingCalls`
   (`apps/api/src/services/outbound.service.ts`) is the classic poll + UPDATE
   pattern PgQue replaces; snapshot-batching + TRUNCATE rotation avoids the dead-
   tuple / VACUUM decay that hits SKIP-LOCKED queues under sustained campaign load.
3. **Avoids ever adding Kafka/RabbitMQ** — reuses Postgres.

**Costs / caveats:**
- Architecture change, not a drop-in — competes with the working Redis + n8n
  path. Only worth it under observed reliability pain (lost/duplicate events,
  queue bloat), not speculatively.
- Needs a "tick" scheduler. `pg_cron` is an extension NOT installed in
  `myorbisvoice-postgres` (would need `shared_preload_libraries` + restart).
  Tick from **n8n or an app cron** instead — no extension required.
- Adds PL/pgSQL surface to operate + a new mental model for the team.

**When to build:** the day we want bulletproof Stripe/Twilio **webhook → action**
delivery, or the outbound queue starts bloating under load. Until then, the
Redis + n8n path is adequate. Captured here so it's the ready answer when that
need hits rather than a from-scratch evaluation under pressure.

---

### 22. Bilingual help center (Spanish `helpContent`) — ❌ TODO

**What:** The in-app help center (`apps/web/src/lib/helpContent.ts`,
`adminHelpContent.ts`, `partnerHelpContent.ts`) is **English-only**. The
`/help`, `/admin/help`, and `/partner-portal/help` pages import the English
content directly — no locale switch, no `es` variant. This violates the
bilingual rule in CLAUDE.md (help articles are listed user-facing content).

**Why it's a whole-system build, not a per-article fix:** every existing article
is English; adding one Spanish article in isolation doesn't help. Needs: (1) an
`es` content tree (or a `t()`-keyed restructure of the article bodies), (2) a
locale switch in the three help page components keyed off `User.preferredLocale`,
(3) a translation pass over ~40 articles. The screenshot specs are
language-neutral (the UI itself swaps via i18n once captured in each locale, or
stays English for code/labels that don't translate).

**Effort:** medium-large (translation volume + the locale-switch plumbing). Each
new article shipped English-only (e.g. the 2026-06-27 Payments section) widens
the gap, so the longer this waits the bigger the catch-up.

**When to build:** before any Spanish-speaking-tenant onboarding push, or bundle
it with the next dashboard i18n expansion.

---

### 23. Capture Payments help screenshots — ❌ TODO (content shipped 2026-06-27)

**What:** The Payments help section (`helpContent.ts` → `payments` section,
articles `payments-setup` + `payments-collect`) ships with screenshot **slots +
capture specs** but no PNGs yet — they render as labeled placeholder boxes.
Filenames: `payments-nav.png`, `payments-connect.png`, `payments-orby-config.png`,
`payments-request.png`, `payments-history.png` (all `authAs:'tenant'`, url
`/payments`).

**Blocker (why deferred):** `pnpm capture-screenshots --tenant` needs
`E2E_TENANT_LOGIN_EMAIL/PASSWORD` set AND that tenant must be **Pro+ (entitled)
with Stripe Connect actually connected** — otherwise `/payments` renders the
upgrade-lock card or the pre-connection state, not the Active UI the captions
describe (request form enabled, history populated, Orby card).

**To do:** point E2E creds at a Pro+ tenant that has completed Stripe onboarding
(ideally with ≥1 sample payment so the history list isn't empty), run
`pnpm capture-screenshots --tenant`, review the light-mode PNGs in
`apps/web/public/help-screenshots/`, redeploy web. Light mode is auto-enforced by
the script (screenshot rule).

**Effort:** small once a connected Pro test tenant exists.

---

### 24. Listing enrichment — neighborhood/property data layer — ❌ TODO (spec'd 2026-07-01)

**What:** Complement each MyOrbisAgents `Listing` with objective, third-party
data so listing pages/demos are richer and Orby can answer buyer questions
("what's the flood risk / commute / nearby hospitals / zoning?") with facts.
Feeds the promised **seller-valuation magnet** (§17c) and neighborhood pages.
Stored per-listing (cached), refreshed on a TTL, surfaced (a) on the listing UI
and (b) as Orby tools with hard Fair-Housing guardrails.

**⚠️ Fair Housing gate (non-negotiable):** **Crime stats** and **school
quality/ratings** are steering signals. NAR guidance: agents must not
characterize neighborhoods by safety or school quality. Orby must give
**objective facts + a link to the authoritative source, never conclusions**
("safe", "good schools", "great for families", "who lives here"). Sensitive
categories (crime, schools, demographics/race) change from "Orby answers" to
"Orby points to the official source." This is a product rule enforced in the
enrichment prompt + tool layer, not optional.

**Enrichment categories + Fair-Housing grade:**
- ✅ Answer freely (objective): flood zone (FEMA NFHL), POIs/hospitals/parks/
  grocery/transit (OSM Overpass), broadband (FCC), air/environmental (EPA),
  natural hazards (USGS), comps/AVM/property facts (RentCast), area economics/
  jobs/growth (BLS, Census permits), solar (NREL), zoning/future land use
  (per-city ArcGIS open-data).
- ⚠️ Facts + source link only, no editorializing: Census income/housing (NEVER
  race/ethnicity), Dept of Education school **names/enrollment** (no ratings).
- ❌ Do NOT let Orby quote as a listing attribute: crime (FBI Crime Data API) —
  coarse + steering risk; GreatSchools ratings — steering + paid.

**Free API stack (provider-abstracted `comps`/`enrichment` services):**
- **api.data.gov** — one API key fronting Census, FBI, Dept of Ed, NREL, etc.
- **RentCast** — comps/AVM/property (freemium; also powers valuation magnet).
- **FEMA NFHL**, **OSM Overpass**, **FCC Broadband Map**, **EPA AirNow/Envirofacts**,
  **USGS**, **BLS API**, **Census API**, **NREL**, **Nominatim** (geocode → lat/lng
  that everything hangs off), **Walk Score** (freemium walk/transit/bike),
  **Transitland/GTFS**.
- Source directory: https://github.com/public-apis/public-apis
- Cutoff caveat: verify current free-tier limits before wiring (assistant
  knowledge ~early 2026).

**Architecture:**
1. `listing-enrichment.service.ts` — provider-abstracted (one function per data
   category, swappable provider), keyed off the listing's geocoded lat/lng.
2. Cache on the `Listing` (JSON column `enrichmentJson` + `enrichedAt`) or a
   `ListingEnrichment` table; TTL refresh; never block the voice hot path.
3. Orby tools (`listing_flood_risk`, `listing_nearby`, `listing_market`, …) with
   the Fair-Housing guardrail baked into each tool's response formatter.
4. Provider keys in System Settings (write-only), per the secrets policy.

**Effort:** Large. Sequence: geocode + RentCast (valuation magnet) first → FEMA +
OSM POIs (high buyer value, zero FH risk) → economics/growth → sensitive
categories LAST behind the source-link guardrail. Gate the richer set to Solo
Power (tier differentiator).
