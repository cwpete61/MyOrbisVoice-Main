# MyOrbisVoice — Complete Product Description

**Status:** AUTO-TRACKED for integrity. Add features here in the same commit that ships them. Drift-check fires at the end of every Claude session that touched user-visible files. Companion to [product-overview.md](product-overview.md) — that doc is the FEATURE LIST; this doc adds brand identity + pricing + positioning so non-engineers can read top-to-bottom and accurately describe what we sell.

---

## 1. Identity

- **Product name:** MyOrbisVoice
- **Parent brand:** MyOrbisResults (umbrella; sibling products = MyOrbisLocal, MyOrbisWeb)
- **Agent name:** Orby (the default voice agent on every channel)
- **Legal entity:** MyOrbisVoice (sole proprietorship, Crawford Peterson Sr.)
- **Address:** 716 Washington St, Suite 2, Allentown, PA 18102 · EIN on file
- **Surface:** marketing site at `myorbisvoice.com` · SaaS app at `app.myorbisvoice.com` · API at `api.myorbisvoice.com`

---

## 2. Brand Colors — Full Palette

### Primary teal (hue 193, oklch)

| Token | OKLCH | Hex (approx) | Where it's used |
|---|---|---|---|
| `--brand-50` | `oklch(96% 0.04 193)` | `#E0F8F8` | Faint backgrounds, success-card surfaces |
| `--brand-100` | `oklch(90% 0.07 193)` | `#B8EFEF` | Hover wash on dark surfaces |
| `--brand-200` | `oklch(82% 0.10 193)` | `#88E2E2` | Soft highlights |
| `--brand-300` | `oklch(72% 0.12 193)` | **`#3FE3E3`** | **Accent / link / highlight teal** |
| `--brand-400` | `oklch(62% 0.12 193)` | `#1FC4C4` | Mid-tone borders, focus rings |
| `--brand-500` | `oklch(55% 0.11 193)` | **`#15A8A8`** | **Primary teal — CTA buttons, logo mark, brand anchor** |
| `--brand-600` | `oklch(46% 0.10 193)` | `#0E8C8C` | Active button states, pressed |
| `--brand-700` | `oklch(37% 0.08 193)` | `#0A6F6F` | Muted brand text on light bg |
| `--brand-800` | `oklch(28% 0.07 193)` | `#085353` | Deep accents |
| `--brand-900` | `oklch(20% 0.05 193)` | `#053A3A` | Dark brand surfaces, success-text |

### Neutral scale (hue 193, low chroma — slightly teal-tinted gray)

| Token | OKLCH | Hex (approx) | Use |
|---|---|---|---|
| `--n0` | `oklch(100% 0.003 193)` | `#FBFFFF` | Pure white (light-mode bg) |
| `--n50` | `oklch(97% 0.005 193)` | `#F4FAFA` | Light-mode surface raised |
| `--n100` | `oklch(93% 0.007 193)` | `#E6EEEE` | Light dividers |
| `--n200` | `oklch(87% 0.008 193)` | `#D2DEDE` | Disabled state |
| `--n300` | `oklch(78% 0.009 193)` | `#B5C5C5` | Placeholder text |
| `--n400` | `oklch(64% 0.009 193)` | `#8B9C9C` | Secondary text (light) / tertiary (dark) |
| `--n500` | `oklch(52% 0.009 193)` | `#6A7B7B` | Mid-tone |
| `--n600` | `oklch(40% 0.008 193)` | `#4D5C5C` | Secondary (dark) / strong (light) |
| `--n700` | `oklch(30% 0.008 193)` | `#374444` | Strong (light bg) |
| `--n750` | `oklch(24% 0.010 193)` | `#293535` | Border subtle (dark) |
| `--n800` | `oklch(19% 0.011 193)` | `#1F2A2A` | Surface raised (dark) |
| `--n850` | `oklch(15% 0.012 193)` | `#172222` | Surface card (dark) |
| `--n900` | `oklch(12% 0.012 193)` | `#0F1B1B` | Surface base (dark) |
| `--n950` | `oklch(9% 0.010 193)` | **`#06141A`** | **Deepest dark bg (gradient start)** |

### Hero gradient (dark surfaces)
`linear-gradient(180deg, #06141A 0%, #031318 100%)`

### Semantic tokens

| Token | OKLCH | Use |
|---|---|---|
| `--success-bg` | `oklch(96% 0.04 193)` | Success card background |
| `--success-text` | `oklch(35% 0.11 193)` | Success text |
| `--success-border` | `oklch(55% 0.11 193 / 0.25)` | Success card border |
| `--focus-ring` | `oklch(55% 0.11 193)` | Keyboard focus ring (= brand-500) |

### Single-source brand pair (use these on any new surface)

- **Primary:** `#15A8A8` (brand-500)
- **Accent / highlight:** `#3FE3E3` (brand-300)
- **Dark canvas:** `#06141A → #031318` gradient
- **Light canvas:** `#FBFFFF` with `#E6EEEE` dividers

---

## 3. Typography

- **Display / headings:** Sora (Google Fonts, weights 400–800)
- **Body / UI:** Inter (Google Fonts, weights 400–700)
- **Mono:** system mono stack (`ui-monospace, SFMono-Regular, Menlo, monospace`)
- Brand wordmark: Sora 700, slightly tighter letter-spacing

---

## 4. Voice & Tone

- Direct. Builder-to-builder. No corporate filler.
- Lead with the customer outcome, not the feature.
- Bilingual EN/ES native — Latin-American Spanish, informal *tú* form.
- Persuasion framework: AIDA · PAS · BAB · 5 Stages of Awareness · Cialdini's 7 · Caples' 35 headline formulas · Sugarman's 30 triggers.
- 4-tier Aggression Spectrum per tenant + partner (Conservative → Bold → Direct → Aggressive). Same product, intensity dial.
- Forbidden words in AI-generated content: robust, leverage, streamline, em-dashes inside AI body copy (Caleb's perplexity-pass rule).
- Brand name "MyOrbisVoice" stays English in both languages (universal reference).
- Master persuasion reference: `docs/marketing-style-guide.md`.

---

## 5. Elevator Pitch (canonical)

> **An AI agent system that runs the customer-facing operations of a small service business — voice receptionist, outbound caller, website widget, calendar booking, follow-up campaigns, CRM, and customer history — with a structured knowledge layer per tenant, integrated billing/calendar/email, and a partner program for distribution.**

The "AI receptionist" framing is the wedge. What customers actually buy is one platform that compresses 4–6 separate tools: receptionist + scheduling assistant + SMS marketing tool + email follow-up tool + basic CRM + missed-call recovery.

---

## 6. Target Audience

- Small-to-mid US service businesses where missed calls = lost revenue
- Verticals: dental · legal · home services (roofing, HVAC, plumbing, landscaping) · fitness · beauty · auto · medical
- Markets with significant Spanish-speaking customer base (20–50% of inbound in many US cities)
- Owners working in the business who can't afford a full-time receptionist or a 4–6 tool stack

---

## 7. Product Surface — Everything That's Shipped

### 7.1 Multi-channel customer communication

Three live voice channels + three live messaging channels, all on one AI brain:

- **Inbound voice** — phone calls answered by Orby
- **Outbound voice** — Orby calls *for* the business (confirmations, follow-ups, missed-call recovery, lead nurture, campaigns)
- **Website widget** — visitor clicks a mic on the business's own site; same voice conversation, no phone call. One-click WordPress plugin downloadable from the dashboard
- **Public booking page** — `/book/<slug>` on the app domain. 30-day date strip · time-slot grid honoring working hours · contact form · confirmation screen. Bilingual EN/ES toggle. Used as the type-not-talk fallback on every partner landing page
- **SMS** — outbound text via Twilio (platform-test credentials today; per-tenant SMS flips on when A2P 10DLC clears)
- **Email** — fully live via Gmail OAuth per tenant (real mailbox dispatch, not a shared inbox)
- **WhatsApp** — wired, awaiting Meta approval

### 7.2 Seven-agent system

Seven distinct AI agent roles per tenant — each with its own prompt, allowed actions, handoff rules:

| Role | Purpose |
|---|---|
| Orchestrator | Routes the caller to the right specialist mid-conversation |
| Appointment | Booking specialist; knows the calendar rules + tools |
| Sales | Qualification + close; pulls pricing + service catalog from Business DNA |
| Customer Service | Issue resolution + escalation triggers |
| Marketing | Lead nurture + campaign dispatch |
| Assistant | General-purpose; handles unrouted intent |
| Secretary | Call routing + message taking + after-hours behavior |

Single Gemini Live runtime; the seven "roles" are seven prompt overlays composed at session start. The Orchestrator routes mid-conversation; handoff is invisible to the caller. As of 2026-05-25: Specialist Routing meta + `enter_specialist`/`exit_specialist` tools + direct transfer + mid-flow tolerance + action-ownership rule all live.

### 7.3 Business DNA

Tenants fill versioned, structured fields (not free-text). Injected into every conversation:

- Identity · services · pricing · operating rules
- Lead qualification rules
- Customer service rules (escalation, refund policy)
- Appointment rules (lead time, override permissions)
- Compliance + legal disclaimers
- Language preferences + prohibited phrasing

Versioned like code: draft → published → active. Rehearsed before going live to callers. Each tenant gets a digital twin of their operating policies that the agent enforces consistently across every channel.

### 7.4 Live integrations

The agent doesn't *describe* what it would do — it does it:

- **Google Calendar** — real free/busy API; books, reschedules, cancels real events on the connected calendar
- **Gmail** — sends real follow-up emails from the tenant's own OAuth-connected mailbox
- **Stripe** — full subscription lifecycle (Free · Basic · Pro · LTD · Premier · Enterprise) · comp codes · Connect Express for partner payouts
- **Twilio** — phone-number purchase · inbound/outbound voice · SMS · recording webhooks · A2P 10DLC
- **Gemini Live** (native audio) — real-time bi-directional voice; seven curated voices: Zephyr · Despina · Aoede · Charon · Fenrir (default) · Puck · Sulafat
- **OpenAI gpt-4o-mini** — call summaries · agent reasoning · campaign assistance · email enrichment
- **Bunny CDN** — call recordings stored, transcripts indexed, both retrievable per tenant

Every call ends with a structured outcome (BOOKED · CALLBACK_REQUESTED · INFO_REQUEST · MISSED_CALL · QUALIFIED_LEAD), AI-written summary, full speaker-labeled transcript, and a recording. Tenants listen and verify.

**Booking engine** — same configuration drives the agent, the public booking page, and any future calendar integration. No parallel knobs:

- Working hours (7-day grid, editable per tenant + per partner)
- Slot length (default 30 min, configurable)
- Minimum notice (prevents same-minute bookings during a live call)
- Maximum advance (default 60 days)
- Buffers before/after (padding around busy blocks)
- Booking timezone (IANA)

**Cross-session contact memory** — known callers (inbound caller-ID match, outbound contactId, widget `lookup_contact`) get a Caller Context layer auto-injected: prior conversation summaries, recent appointments, CRM facts (customer-since, spouse, kids, pets, anniversaries, hobbies). Char-budgeted. Agent references history naturally, never volunteers sensitive facts.

**Automatic appointment reminders** — every new booking schedules reminders (defaults 24h + 1h before, email + SMS). Background runner polls every 60s, dispatches via Gmail + Twilio with retry. Cancelling/rescheduling auto-cancels/re-arms the matching reminders.

**Coming soon (placeholder cards live):** Outlook Calendar · Calendly · Cal.com.

### 7.5 CRM that grows from conversations

Every call creates or updates a contact. Tracks:

- **Standard:** name · email · phone (E.164) · address · source
- **Communication history:** voice (with recording, transcript, summary, latency telemetry, outcome) · SMS (with delivery + opt-out) · email
- **Per-channel opt-outs** — "stop texting me" auto-excludes from SMS campaigns but stays reachable by phone
- **Personal / relationship fields** (collected during outbound only — inbound never asks): birthday · anniversary · spouse · kids · pets · hobbies · preferred contact time · customer-since · important dates · personal notes
- **Verification:** email status via Reoon (valid / risky / invalid) · phone status
- **Segmentation:** tag-based; tags fire automation

### 7.6 Tag-driven multi-channel campaign engine

Set a tag → platform picks matching campaign → fans out per enabled channel (voice · SMS · email · WhatsApp) independently → honors retry policy → substitutes contact + business + appointment tokens → logs every dispatch.

**Auto-tagging from call outcomes:**

| Outcome | Auto-tag → campaign |
|---|---|
| `BOOKED` | `booked` → Booking Confirmation |
| `CALLBACK_REQUESTED` | `callback-requested` → Callback Follow-Up |
| `INFO_REQUEST` | `info-requested` |
| `MISSED_CALL` | `missed-call` → Missed-Call Follow-Up |
| `QUALIFIED_LEAD` | `qualified-lead` |

**Auto-enrollment:** every appointment auto-enrolls into `appointment-scheduled` (24h-before reminder).

**Default seeded campaigns:** Booking Confirmation · Day-Before Reminder · Callback Follow-Up · Missed-Call Follow-Up. Tenants build on top.

### 7.7 Knowledge base

Tenants upload PDF · DOCX · XLSX · CSV · TXT · MD. Platform extracts text, bounds for model context budget, injects into every conversation's system prompt.

Roofer uploads warranty policy → agent answers warranty questions accurately. Dental office uploads insurance acceptance list → agent answers in-network questions without a human stepping in.

Spreadsheet safety: 5 MB max, 100k cells across all sheets.

### 7.8 Layered prompt architecture

Five layers compose the system prompt for every conversation:

1. **Platform baseline** — universal rules (be honest · don't fabricate · accept refusal-of-info · action ownership · no internal jargon to callers)
2. **Tenant master prompt** — what makes this business this business
3. **Channel overlay** — widget vs inbound vs outbound (each can have different opening lines, tool sets, escalation rules)
4. **Role overlay** — seven specialist behaviors + Specialist Routing meta (when 2+ roles loaded) + HANDOFF/transfer rules
5. **Session context** — runtime facts (time of day, caller phone if known, which campaign this is from, available tools)

Tenants can edit master + channel + role prompts. Each is versioned (draft → published).

### 7.9 Partner program with real-money payouts

Partners (user-facing language: "Partners," not "Affiliates") get:

- **Lead engine** — built-in prospecting tool. Industry + location search ("Dentist, Allentown PA") → Google Maps via Serper.dev → enriched with website contact email + socials, completeness-scored → partner promotes leads into CRM. Scraped leads cold-email only (born opted-out of voice + SMS)
- **Their own per-partner Orby** — created at approval; reused for every channel they own (widget + every phone number); answers as that partner (their name, business, calendar); fully isolated from other partners
- **Stripe Connect Express onboarding** — verified live in production; payouts route to bank/debit card automatically
- Custom referral links + custom slugs (split-track campaigns: `/r/sarahs-podcast`, `/r/fall-promo`)
- Commission ledger: PENDING (30-day holdback) → APPROVED → PAID, with HOLD + REVERSED states for refunds/disputes
- **Auto-payout on 1st + 15th** of every month (business-day adjusted)
- **30% recurring commission** on every paid referral
- W-9 collection at signup, 1099-NEC at year-end

**Partner portal surfaces:**
- Dashboard + onboarding checklist
- Referral links (primary + custom slugs)
- All Referrals table (every signup — paid OR free)
- Commissions page + payment explainer
- Payouts page
- Marketing Kit (videos · brand colors · downloadable assets)
- Media Center / Social Content Engine (admin Generate → caption + image + render → DB row → partner sees it)
- Notification bell (referral signups · commission status · payouts)
- Partner ID badge (top-right, click-to-copy)
- GBP Audit tool (`/partner-portal/gmb-evaluation`) — partner door-opener; bilingual interactive screen + branded PDF + shareable customer report at `/report/<token>`
- **Coming soon:** Custom Landing Page Builder · Market Vault

### 7.10 Bilingual end-to-end (English + Spanish)

Every dashboard string · every marketing page · every email template · every help article exists in both and ships together. Latin American Spanish, informal *tú* form. `/es/` mirrors on the marketing site. User locale preference saves at the user level.

Enforcement: coverage scanner (`pnpm i18n:check`) blocks commits when English-only strings appear in TSX or when keys diverge. Auto-fill via `pnpm i18n:fill` against OpenAI, reviewed.

### 7.11 Admin, audit, and impersonation tools

Platform staff can:

- Search every tenant, see detail, suspend/restore, grant plans
- **Impersonate any tenant** (banner shown entire time, every action audit-logged with support user ID + impersonation session ID)
- Edit plan entitlements per-tenant (custom quotas without changing plan)
- Issue comp codes (one-time discount codes for special promos / partnerships / refund situations)
- Track A2P submissions, Twilio call logs platform-wide
- **Central call log** (`/admin/call-log`) — every conversation across every partner and tenant. AI pass scores each finished call for attention; rows color-coded green/yellow/red
- Rotate secrets, manage integrations — without revealing plaintext keys to lesser admins
- Configure platform-wide social URLs (YouTube · LinkedIn · TikTok · Instagram · Pinterest · X) — flows to marketing footer + partner portal Follow-us section

**RBAC tiers:**
- Platform Super Admin — full access including secret editing
- Platform Admin — tenant management, no secret edits
- Platform Support — read + impersonate, no destructive writes
- Tenant Owner · Tenant Manager · Tenant Staff · Affiliate (Partner)

### 7.12 Tenant onboarding + help

- Step-by-step onboarding checklist (auto-detection + manual mark-done)
- Onboarding emails (setup nudge · feature spotlight · week-2 check-in) — idempotent
- In-app help center, bilingual, searchable, contextual deep links
- Admin-side help center with step-by-step support procedures

### 7.13 Notification system

- In-app bell with unread badge, dropdown, mark-read per-item or all-at-once
- Tenant notifications: storage warnings · Twilio errors · Google token expiring · campaign complete · opt-out received · contact created · admin broadcasts
- Partner notifications: new referral signup · paid referral · commission status changes · payout events
- Web Push (browser-side) for desktop alerts
- Mobile push planned

### 7.14 Phone number management + A2P 10DLC

- Twilio number purchase via the platform
- Inbound · outbound · SMS toggles per number
- Forwarding (after-hours transfer · intent-based transfer to specific staff)
- Auto-tied to campaign dispatch
- A2P 10DLC data-capture form for US SMS senders (full Twilio Trust Hub flow built; pending Twilio approval)

### 7.15 Media Center + Social Content Engine (shipped 2026-05-23)

- Admin Media Center QC dashboard (`/admin/media-center`) — 3 tabs (All media · QC queue · Activity feed) · 5 health metrics · filterable
- **AI Generate end-to-end** — 13 curated angles + free prompt → gpt-4o-mini copy + per-platform captions {x, ig, linkedin, tiktok} → gpt-image-1 background (with NO_TEXT guardrail) → Remotion render → Bunny → DB row
- **10 Remotion compositions:** Social-Static · Social-Imagery · Stat-Card · Hook-Card · Quote-Card · Comparison-Card · Value-Pillars · Social-Reel (12s) · Hook-Reel (15s) · Partner-LongForm (16:9 intro/outro)
- Per-platform Copy-caption buttons on partner cards + share-intent links (X · LinkedIn)
- Audit log every Generate · rate limit 5/min per admin · one-shot retry on 5xx
- Dedicated `myorbisvoice-render` container (Chromium + Remotion + bundler)

### 7.16 Coming soon (placeholders live in product)

| Surface | Item |
|---|---|
| Tenant `/apps` | Mobile + Desktop apps (PWA shipped at `myorbisresults.com/preview/`) |
| Tenant `/integrations` | Outlook · Calendly · Cal.com |
| Partner nav | Custom Landing Page Builder · Market Vault |
| Partner marketing kit | 5 industry demo videos · ROI calculator · "How to sell" walkthrough |

---

## 8. Architecture (one-paragraph summary)

Multi-tenant SaaS on Contabo Docker (`147.93.183.4`). PostgreSQL = system of record. Redis = cache/queue. n8n = internal orchestration (never customer-facing). Voice gateway = real-time Gemini Live runtime. Single Gemini Live model per call holds seven prompt overlays. Render container = Chromium + Remotion + bundler. Bunny CDN = recordings + transcripts + marketing assets. Stripe Connect = partner payouts. Twilio = phone + SMS + A2P. Google OAuth = per-tenant Gmail + Calendar. All secrets encrypted (AES-256-GCM via AUTH_SECRET sha256), write-only in the UI. Every privileged write audit-logged immutably. Shared Caddy reverse proxy.

---

## 9. Pricing

- **Free** — entry tier (referrals visible to partners; no commission earned yet)
- **Basic** · **Pro** · **LTD** · **Premier** · **Enterprise** — paid tiers
- **Trifecta bundle** (Voice + Local + Web) — **$997/mo** (when MyOrbisLocal + MyOrbisWeb ship)
- À-la-carte standalone: Voice **$497** · Local **$997** · Web **$497** (sum $1,491)
- Standalone MyOrbisLocal first-location: **$1,297 OR $997** — user has said both; pending CONFIRM before Phase F billing wiring

---

## 10. What We Are NOT

- Not n8n. n8n runs orchestration internally; customer never sees it.
- Not a generic chatbot. Every conversation has a real-time voice path through Gemini Live and a structured outcome.
- Not an enterprise CRM. No pipeline visualization, no complex deal stages, no sales-team management.
- Not a marketing automation platform like HubSpot/ActiveCampaign. We have tag-driven multi-channel campaigns, not behavior-tree automation with lead scoring + A/B testing.
- Not a help-desk product like Intercom/Zendesk. The agent answers questions but we don't have ticketing, queues, or human-handoff inboxes (yet).

---

## 11. The Differentiator (one line)

**Orby isn't one bot — it's seven specialist agents wearing one voice. Trained on YOUR business via structured Business DNA. Bilingual end-to-end. Books on your Google Calendar live. Nurtures every lead across voice, SMS, email, WhatsApp with one tag. Backed by a real-money partner program with Stripe Connect payouts.** Nothing else in the local-business AI receptionist space ships all of that as one platform.

---

## 12. Recent Shipped (last 30 days highlights)

- 2026-05-25 — **Homepage redesign (Theme Orby 2026)** · dark-canvas + brand teal · 13 sections (Hero · Problem · 7-Agent · Channels · DNA · Integrations · CRM · Replace · Knowledge · Changelog · FAQ · Final CTA + Family) · reusable `theme-orby-2026.css` (1037 lines) + `theme-orby-2026.js` (149 lines) · existing nav + footer preserved · NEW Family-of-Products strip (4 sibling brands: MyOrbisResults · MyOrbisVoice · MyOrbisLocal · MyOrbisWeb) common across all 4 properties · Spanish mirror shipped same commit · OrbyDemo wired to live widget
- 2026-05-25 — Orby agent architecture: Specialist Routing meta · Single-specialist Handoff (soft-pin tools) · Direct transfer · Mid-flow tolerance · Action-ownership rule
- 2026-05-23 — Media Center + Social Content Engine end-to-end (Phase A + B + B.6 polish)
- 2026-05-17 — Lead engine (Phase 1) · Partner-branded appointment communications
- 2026-05-16 — Per-partner Orby · Central call log · AI conversation monitor
- 2026-05-13 — Public booking page · Tenant + Partner booking preferences · Automatic appointment reminders · Cross-session contact memory · Widget hardening · Booking-engine bug fixes
- 2026-05-12 — MyOrbisVoice Preview PWA at `myorbisresults.com/preview/`
- 2026-05-09 — xlsx CVE patches · CRM relationship fields · Social-media platform config · Refuse-info handling · Free-tier referrals always visible · Partner notification bell · Partner ID badge · WordPress plugin

---

## 13. Reference Documents

- `docs/product-overview.md` — canonical living source for every feature shipped (changelog-anchored)
- `docs/marketing-style-guide.md` — voice + persuasion framework + 4-tier Aggression Spectrum
- `docs/launch-blockers.md` — open pre-launch items
- `docs/feature-backlog.md` — 20 confirmed product requirements with status
- `docs/agent-assignments.md` — internal architecture (8 named sub-agents)
- `docs/recovery-procedures.md` — DR + restore procedures
- `docs/build-log.md` — historical record of every phase
- `docs/orby-agent-architecture-improvements.md` — agent architecture backlog (4 items shipped 2026-05-25; 2 parked)
- `CLAUDE.md` — project rules + bilingual rule + screenshot rule + deploy protocol

---

## 14. Integrity / Update Rule

This doc is AUTO-TRACKED. When you ship a user-visible feature, addition, or removal:

1. Update the matching section above in the SAME commit that ships the change.
2. Add a one-line entry to section 12 (Recent Shipped) with the date.
3. If you removed a feature, delete its bullet — don't strikethrough.
4. If you ship something that doesn't fit an existing section, add a new section.

A drift-check script (`infrastructure/scripts/check-product-description-drift.sh`) runs at session end + on `git commit`. It compares: (a) git log since this doc's last touch vs (b) commits to `apps/web/src`, `apps/api/src/routes`, `apps/voice-gateway/src`, `prisma/schema.prisma`, `packages/`. If 3+ feature-touching commits land without a matching update here, the script prints a loud warning.

Last full audit: **2026-05-25** (homepage redesign + Family strip).
