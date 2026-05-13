# What MyOrbisVoice Offers — Living Product Overview

**Purpose:** Canonical, in-depth description of what MyOrbisVoice actually delivers, so that:

- Marketing copy, video scripts, partner-pitch decks, sales talking points, and onboarding emails all source their facts from one place.
- New features get added here the moment they ship, so the description stays current.
- Anyone (us, support staff, partners, contractors) can read this top-to-bottom and accurately describe what the platform does.

**This is a living document.** Every time we add, change, or ship a user-visible capability, append the new capability to the right section AND log it in the changelog at the bottom (with date + commit ref where useful). The doc is the source of truth — if something exists in the product but not in here, the next marketing pass will miss it.

---

## Core positioning (the elevator pitch)

> **An AI agent system that runs the customer-facing operations of a small service business — voice receptionist, outbound caller, website widget, calendar booking, follow-up campaigns, CRM, and customer history — with a structured knowledge layer per tenant, integrated billing/calendar/email, and a partner program for distribution.**

The "AI receptionist" framing gets us in the door. What customers actually buy is a single platform that replaces (or compresses): a receptionist, a scheduling assistant, an SMS marketing tool, an email follow-up tool, a basic CRM, and a missed-call recovery service. That's typically 4-6 separate tools they were paying for, fighting with, or just not using.

Target verticals: dental, legal, home services, fitness, beauty — small-to-mid service businesses where missed calls = lost revenue and where a Spanish-speaking customer base is meaningful.

---

## 1. Multi-channel customer communication, not just inbound calls

Three live voice channels and three live messaging channels, all driven by the same AI brain:

- **Inbound voice** — phone calls answered by the AI receptionist (the front-door product most prospects know us for).
- **Outbound voice** — the agent makes calls *for* the business: appointment confirmations, callback follow-ups, missed-call recovery, lead nurture, campaign dispatch.
- **Website widget** — visitors click a mic button on the business's own site and have the same voice conversation, with no phone call required. Also installable as a one-click WordPress plugin (downloadable from the dashboard).
- **Public booking page** — `/book/<slug>` on the app domain. A type-not-talk surface for prospects who don't want a voice conversation: 30-day date picker, time-slot grid honoring the tenant or partner's working hours, contact form, and a confirmation screen. Bilingual (en/es toggle in the header). Used both directly and as the secondary CTA on partner landing pages.
- **SMS, email, WhatsApp** — outbound text, email, and WhatsApp messages dispatched through the same agent system using the same Business DNA. Email is fully live (real Gmail dispatch via OAuth). SMS uses platform-test credentials today; per-tenant SMS routing flips on once Twilio A2P 10DLC clears. Voice and WhatsApp are wired and parked behind external approvals.

Add the partner portal on top and the platform speaks to four audiences at once: prospects, customers, the tenant's own staff, and partner affiliates.

---

## 2. A multi-agent system, not a chatbot

Seven distinct AI agent roles inside every tenant — each with its own prompt, allowed actions, and handoff rules:

| Role | Purpose |
|---|---|
| **Orchestrator** | Routes a live caller to the right specialist mid-conversation. |
| **Appointment** | Booking specialist — knows the calendar rules and tools. |
| **Sales** | Qualification + close. Pulls pricing + service catalog from Business DNA. |
| **Customer Service** | Issue resolution, escalation triggers. |
| **Marketing** | Lead nurture, campaign dispatch. |
| **Assistant** | General-purpose, handles unrouted intent. |
| **Secretary** | Call routing, message taking, after-hours behavior. |

The Orchestrator routes mid-conversation. A caller asking "can I book?" gets the Appointment agent; "what does this cost?" pulls in Sales. The handoff is invisible to the caller but every role plays by its own rulebook.

This is structurally different from "one prompt that tries to do everything." It's why the agent doesn't lose the thread when a conversation jumps from booking → pricing → support in 90 seconds.

**Refuse-info handling (platform default):** if a caller declines to share name/email/phone, the agent acknowledges politely and continues helping. It does NOT insist or repeat the request. Booking-type actions still require a callback method, but everything else is answered without gating.

---

## 3. Business DNA — a structured representation of the business itself

Tenants don't write a free-text "personality" blob. They fill in versioned, structured fields that the platform then injects into every conversation:

- Identity, services, pricing, operating rules
- Lead qualification rules ("only book leads who explicitly mention budget over $X")
- Customer service rules (escalation triggers, refund policy)
- Appointment rules (booking lead time, who can override)
- Compliance + legal disclaimers
- Language preferences and prohibited phrasing

It's versioned the way code is — draft, published, active — so a tenant can rehearse a change before it goes live to callers. **This means each tenant has a digital twin of their business operating policies that the agent enforces consistently across every channel.**

---

## 4. Live integrations — calendar, email, billing, recordings

The agent doesn't *describe* what it would do — it actually does it:

- **Google Calendar** — fetches real availability via free/busy API; books, reschedules, cancels real events on the connected calendar.
- **Gmail** — sends real follow-up emails from the tenant's own connected mailbox, OAuth-authenticated, no shared inbox.
- **Stripe** — full subscription lifecycle (Free, Basic, Pro, LTD, Premier, Enterprise), comp codes, one-time + recurring billing, Connect Express for partner payouts.
- **Twilio** — real phone numbers (purchased through the platform), inbound/outbound voice, SMS, recording webhooks, A2P 10DLC.
- **Gemini Live (native audio)** — real-time bi-directional voice. Curated voice selection per tenant: Zephyr, Despina, Aoede, Charon, Fenrir (default), Puck, Sulafat.
- **OpenAI** — call summaries, agent reasoning, campaign assistance, email enrichment.
- **Bunny CDN** — call recordings stored, transcripts indexed, both retrievable per tenant.

Every call ends with a structured outcome (`BOOKED`, `CALLBACK_REQUESTED`, `INFO_REQUEST`, `MISSED_CALL`, `QUALIFIED_LEAD`), an AI-written summary, a full speaker-labeled transcript, and a recording. Tenants don't just read what the AI did — they listen and verify.

**Booking engine — tenant-side and partner-side both fully configurable.** The agent doesn't pick times out of thin air. It honors:

- **Working hours** — a 7-day grid editable per tenant (`/settings`) and per partner (`/partner-portal/profile`). Days you're closed are never offered.
- **Slot length** — default 30 minutes, configurable per side.
- **Minimum notice** — slots starting sooner than this from "now" are hidden. Prevents same-minute bookings during a live call.
- **Maximum advance** — slots beyond this many days out are hidden. Default 60 days.
- **Buffers before/after** — padding inserted around every busy block so back-to-back appointments have breathing room.
- **Booking timezone** — IANA zone the agent reads slots aloud in.

The same configuration drives the agent (`search_availability` + `book_appointment`), the public booking page, and any future integration that asks "what times are open?" — no parallel knobs to keep in sync.

**Cross-session contact memory.** When a known caller reaches the agent (inbound phone with caller-ID match, outbound call with `OutboundCallAttempt.contactId`, or widget after the agent identifies them via `lookup_contact`), a Caller Context layer is auto-injected into the system prompt: prior conversation summaries, recent appointments, and CRM facts (customer-since, spouse, kids, pets, anniversaries, hobbies, preferred contact time, personal notes). Char-budgeted so the prompt stays compact. The agent is explicitly instructed to reference history naturally ("Welcome back — I see we got you in for X last time") but never to bring up sensitive facts unless the caller raises them first.

**Automatic appointment reminders.** Every new booking schedules reminders out of the box — defaults are 24h + 1h before, email + SMS, both configurable per tenant in `/settings`. The reminder-runner job polls every 60 s, dispatches due rows via Gmail (with platform-SMTP fallback) or Twilio SMS, retries up to 3 times on failure. Cancelling or rescheduling an appointment auto-cancels or re-arms the matching reminders — no stale "your appointment is tomorrow!" text after a customer already cancelled.

**Coming soon (placeholder cards already in the integrations page):** Outlook Calendar, Calendly, Cal.com.

---

## 5. CRM that actually grows from the conversations

Every call creates or updates a contact record. The platform tracks:

**Standard fields:** name, email, phone (E.164), address, source.

**Communication history:**
- Voice calls (with recording, transcript, summary, latency telemetry, outcome code)
- SMS (sent + delivery status + opt-out detection)
- Emails (delivered via the connected Gmail mailbox)
- Per-channel opt-out events (a contact who said "stop texting me" is automatically excluded from SMS campaigns but still reachable by phone)

**Personal / relationship details (collected during outbound campaigns only — inbound never asks):**
- Birthday, anniversary
- Spouse / partner name
- Kids info, pets info
- Hobbies / interests
- Preferred contact time
- Customer since
- Important recurring dates
- Personal notes (internal only)

**Verification:**
- Email status via Reoon (valid / risky / invalid)
- Phone status

**Segmentation:** tag-based. Tags fire automation (see Campaign Engine below).

---

## 6. Tag-driven multi-channel campaign engine

This is the piece most prospects don't realize they're getting. Set a tag on a contact (or have an outcome auto-tag them), and the platform:

1. Picks the matching campaign.
2. Fans out one enrollment per enabled channel — voice, SMS, email, WhatsApp — independently. Failure of one channel doesn't block the others.
3. Honors a retry policy if a channel fails (`maxRetries` + `retryIntervalHours`).
4. Substitutes contact + business + appointment tokens into each template (`{firstName}`, `{appointmentDate}`, `{businessName}`, etc.).
5. Logs every dispatch in MessageLog, audits failures, marks enrollments COMPLETED on success.

**Auto-tagging from call outcomes:** the agent's structured outcome → campaign trigger map is built in:

| Outcome | Auto-tag fired |
|---|---|
| `BOOKED` | `booked` → Booking Confirmation campaign |
| `CALLBACK_REQUESTED` | `callback-requested` → Callback Follow-Up campaign |
| `INFO_REQUEST` | `info-requested` |
| `MISSED_CALL` | `missed-call` → Missed-Call Follow-Up campaign |
| `QUALIFIED_LEAD` | `qualified-lead` |

**Auto-enrollment from appointments:** every appointment created via the platform auto-enrolls the contact into the `appointment-scheduled` campaign with a 24-hour-before reminder time.

**Default campaigns seeded for every tenant:**
- Booking Confirmation
- Day-Before Reminder (auto-enrolled by appointment creation, 24h before)
- Callback Follow-Up
- Missed-Call Follow-Up

Tenants build their own campaigns on top of these.

---

## 7. Knowledge base — the agent reads the tenant's documents

Tenants upload PDFs, Word docs (.docx), Excel sheets (.xlsx), CSVs, plain text, markdown. The platform extracts the text, bounds it for the model's context budget, and injects it into the agent's system prompt for every conversation.

A roofing company uploads its warranty policy → the agent answers warranty questions accurately. A dental office uploads its insurance acceptance list → the agent tells callers whether their plan is in-network without a human ever stepping in.

Bounded mitigations for spreadsheet inputs (5 MB max, 100k cells across all sheets) keep the parser safe under load and against crafted adversarial files.

---

## 8. Layered prompt architecture

Five distinct layers compose the system prompt for every conversation. This is what makes the agent's behavior controllable instead of an opaque blob:

1. **Platform baseline** — universal rules (be honest, don't fabricate, gracefully accept refusal-of-info).
2. **Tenant master prompt** — what makes this business this business.
3. **Channel overlay** — widget vs inbound vs outbound (each can have different opening lines, tool sets, escalation rules).
4. **Role overlay** — Orchestrator vs Appointment vs Sales vs ... behaviors.
5. **Session context** — runtime facts (time of day, caller phone if known, which campaign this outbound call is from, available tools for this session).

Tenants can edit their master prompt + channel overlays + role overlays. Each is versioned (draft → published).

---

## 9. Partner program with real-money payouts

Partners (affiliates) get:

- **Stripe Connect Express onboarding** — partners create their payout account through Stripe in test or live mode, payouts route to their bank/debit card automatically (verified end-to-end live in production).
- Custom referral links + custom slugs (split-track campaigns: e.g. `/r/sarahs-podcast`, `/r/fall-promo`).
- Commission ledger with full lifecycle: PENDING (in 30-day holdback) → APPROVED (cleared holdback, scheduled for payout) → PAID, with HOLD and REVERSED states for refunds/disputes.
- Auto-payout on the 1st and 15th of every month (business-day adjusted).
- W-9 collection at signup, 1099-NEC at year-end.

**Partner portal surfaces:**
- Dashboard with stats + onboarding checklist
- Referral links (primary + custom slugs)
- **All Referrals table** — every signup that came through their link, paid OR free. Free-tier signups don't earn a commission yet but the referral is still counted.
- Commissions page with status pills + payment explainer
- Payouts page
- **Marketing kit** — videos (product explainer 16:9 + 9:16, recruiting video, social cuts), brand colors, downloadable assets
- **Notification bell** — synthesized feed of every referral signup, paid referral, commission status change, payout event
- **Partner ID badge** — top-right, click-to-copy referral code (mirrors the Tenant ID badge in the main dashboard)
- **Coming soon:** Custom Landing Page Builder, Market Vault

Free-tier referrals show up in the partner's account too — they don't earn a commission yet but the partner sees the referral and can follow up if they upgrade later.

---

## 10. Bilingual end-to-end (English + Spanish)

Not "we'll translate later." Every dashboard string, every marketing page, every email template, every help article exists in both languages and ships together. The marketing site at myorbisvoice.com has /es/ mirrors (`myorbisvoice.com/es/<page>`). User locale preference saves at the user level. The Spanish surface uses Latin American conventions, informal *tú* form.

This is a structural feature for the U.S. service-business market — dental, legal, home services, beauty, fitness — where Spanish-speaking customers are 20-50% of the inbound flow in many cities.

Enforcement: a coverage scanner (`pnpm i18n:check`) blocks commits when English-only strings appear in TSX or when keys diverge between dictionaries. Translations are auto-fillable (`pnpm i18n:fill` against OpenAI) and reviewed.

---

## 11. Admin, audit, and impersonation tools

Platform staff can:

- Search every tenant, see their detail, suspend/restore, grant plans.
- **Enter any tenant's account in support-mode (impersonation)** with a banner shown the entire time and every action audit-logged with the support user's ID + the impersonation session ID.
- Edit plan entitlements per-tenant (a paid customer with a special arrangement can have a custom quota without changing their plan).
- Issue comp codes (one-time discount codes that bypass Stripe's standard checkout for special promos / partnerships / refund situations).
- Track A2P submissions, Twilio call logs across the platform.
- Rotate secrets, manage integrations, all without revealing plaintext keys to lesser admins.
- Configure platform-wide social media URLs (YouTube, LinkedIn, TikTok, Instagram, Pinterest, X) — these flow to the marketing site footer + the partner portal "Follow us" section automatically via a public API endpoint.

**RBAC tiers:**
- Platform Super Admin — full access including secret editing
- Platform Admin — tenant management, no secret edits
- Platform Support — read + impersonate, no destructive writes

Tenant side: Tenant Owner, Tenant Manager, Tenant Staff, Affiliate (Partner).

---

## 12. Tenant onboarding + help

- Step-by-step onboarding checklist with auto-detection of progress + manual mark-done.
- Onboarding emails: setup nudge, feature spotlight, week-2 check-in (idempotent — once sent, never re-sent).
- Comprehensive in-app help center with bilingual articles, search, contextual deep links.
- Admin-side help center with step-by-step support procedures (text complete; screenshot capture pipeline deferred until UI feature-testing sprint stabilizes the visual layer).

---

## 13. Notification system

- **In-app bell** with unread badge, dropdown, mark-read per-item or all-at-once.
- **Tenant notifications:** storage warnings, Twilio errors, Google token expiring, campaign complete, opt-out received, contact created, admin broadcasts.
- **Partner notifications:** new referral signup, paid referral, commission status changes (pending → approved → paid → reversed), payout events.
- **Web Push** subscription support (browser-side) for desktop alerts.
- Mobile push planned once native mobile app ships.

---

## 14. Phone number management + A2P 10DLC compliance

- Twilio number purchase via the platform.
- Inbound, outbound, SMS toggles per number.
- Forwarding configuration (transfer to a human after-hours, transfer to a specific staff member by intent).
- Auto-tied to campaign dispatch.
- A2P 10DLC data-capture form for tenants who need to send SMS in the U.S. (data captured today; full Twilio Trust Hub integration + multi-step wizard is a known follow-up, deferred until soft-launch surfaces real friction patterns).

---

## 15. Coming soon (announced placeholders)

These appear in the product as "Coming Soon" cards / nav items, with descriptions, so customers can see the roadmap:

| Surface | Item |
|---|---|
| Tenant: `/apps` | Mobile + Desktop apps |
| Tenant: `/integrations` | Outlook Calendar, Calendly, Cal.com |
| Partner: nav | Custom Landing Page Builder, Market Vault |
| Partner: marketing kit | 5 industry demo videos (dental / legal / home services / fitness / beauty), ROI calculator video, "How to sell" walkthrough |

---

## What we are NOT

(Worth stating explicitly so positioning stays honest.)

- We are not n8n. n8n runs orchestration internally, but the customer never sees it. Tenants configure the agent through structured UI, not by editing workflows.
- We are not a generic chatbot. Every conversation has a real-time voice path through Gemini Live and a structured outcome at the end.
- We are not a CRM replacement for enterprise customers — we don't have pipeline visualization, complex deal stages, or sales-team management. We're a CRM-grade customer history layer for small service businesses.
- We are not a marketing automation platform like ActiveCampaign or HubSpot. We have a tag-driven multi-channel campaign engine, not behavior-tree automation, lead scoring, A/B testing, etc.
- We are not a help-desk product like Intercom or Zendesk. The agent answers questions but we don't have ticketing, queues, or human-handoff inboxes (yet).

---

## Changelog

Every change here corresponds to a commit. When you ship something user-visible, append a one-line entry with the date.

### 2026-05-13

- **Public booking page** — `/book/<slug>` on the app domain. Bilingual (en/es). 30-day date strip, time-slot grid honoring partner's working hours / slot length / min notice / max advance / buffers, contact form, confirmation. Linked from every partner landing page's "Pick a time instead" CTA (replaces the old mailto bridge). (Phase E.4)
- **Tenant booking preferences UI** — new "Booking preferences" card in `/dashboard/settings` mirrors the partner-side E.3 fields. 7-day hours grid + 5 numeric prefs + IANA timezone selector. The agent honors these on every non-partner-routed booking. (Phase E.5)
- **Partner booking preferences UI** — same surface in `/partner-portal/profile`. Each partner sets their own working hours / slot rules; partner-routed bookings honor them. (Phase E.3)
- **Automatic appointment reminders** — new `AppointmentReminder` model + `reminder-runner` background job. Defaults 24h + 1h before, both email + SMS. Configurable per tenant in `/settings`. Reminders fire out of the box for every new booking — no campaign setup required. Cancelling or rescheduling an appointment auto-cancels / re-arms the matching reminders. (Phase E.6)
- **Cross-session contact memory** — when a known caller reaches the agent (caller-ID match for inbound, contactId on enrollment for outbound, or `lookup_contact` mid-call for widget), a Caller Context layer is auto-injected into the system prompt with prior conversation summaries, recent appointments, and CRM facts. Char-budgeted so prompts stay tight. (Phase E.7)
- **Partner dashboard "Your public booking page" card** — top of `/partner-portal/dashboard` shows the partner's `/book/<slug>` URL with Copy + Open buttons. Greyed-out CTA-to-Profile when the page isn't activated yet.
- **Widget hardening** — single-instance guard prevents a second click during the dial intro from spawning a parallel session; closing the panel (X) now hard-stops Orby's in-flight audio by closing the playback AudioContext, not just clearing the queue.
- **Booking-engine bug fixes** — `timeOfDayInTz` midnight normalization (prod Node was rendering `00:00` as `"24:00"`, causing overnight slots to leak through the working-hours filter); `searchAvailability` `opts` parameter lets the public booking page request the full-day grid instead of the agent's curated 5+3 slot cap.
- **Image rules enforced** — logo upload (`/settings`) and partner avatar upload (`/partner-portal/profile`) now reject SVG and GIF respectively. Per project image rules: PNG/JPEG/WebP only, no base64 inlining anywhere.

### 2026-05-09

- **xlsx CVE patches** — SheetJS 0.18.5 → 0.20.3 from cdn.sheetjs.com. Closes 2 high CVEs. (Commit `85a0e87`)
- **CRM relationship fields** — added 10 new fields to Contact (birthday, anniversary, spouse, kids/pets info, hobbies, preferred contact time, customer-since, important dates, personal notes). Editable on the contact detail page. Inbound agent never asks. (Commit `4195fc3`)
- **Social media platform config** — admin tab in System Settings (YouTube, LinkedIn, TikTok, Instagram, Pinterest, X). Flows to marketing site footer + partner portal "Follow us" section. (Commit `4195fc3`)
- **Refuse-info handling on inbound** — agent gracefully accepts refusals to share personal info, keeps helping. (Commit `4195fc3`)
- **Free-tier referrals always visible** — partner sees every signup, not just commission-earning ones. New "All Referrals" table. (Commit `4195fc3`)
- **Partner sidebar fixed-height** — anchored to viewport, no internal scroll. (Commit `393f42c`)
- **Partner notification bell** — synthesized feed from conversion + commission rows. (Commit `393f42c`)
- **Partner ID badge** — top-right, mirrors Tenant ID badge. (Commit `393f42c`)
- **WordPress plugin** — real PHP plugin with settings page + footer injection. Downloadable from `/widget-test`. (Commit `393f42c`)
- **Mobile + Desktop apps tab** — coming-soon placeholder at `/apps` with two cards + nav item. (Commit `393f42c`)
- **Marketing-kit video card thumbnails** — fixed cards showing teal gradient instead of first-frame previews. (Commits `026ddb0`, `193a57c`)

### Earlier (recent highlights from prior sessions)

- **Theme system** — universal `prefers-color-scheme` support + theme toggle on every surface (login, signup, partner login/signup, dashboard, partner portal). Inline pre-hydration script prevents dark→light flash.
- **Google Sign-In (Thing A)** — distinct from Gmail/Calendar integration (Thing B). Anonymous OAuth for sign-in, separate from authenticated tenant Gmail connection.
- **Video library Phase 1** — partner Marketing Kit got a 5-tab video library (All / Pitch Product / Recruit Partners / How to Sell / Social Cuts) with 12 cards, 6 live videos + 6 coming-soon placeholders. Live videos: Product Explainer 16:9 + 9:16, Become a Partner, 3 stat-anchored social cuts.
- **Stripe Connect Express partner onboarding** — verified live with a real partner.
- **Twilio test credentials infrastructure** — admin "Send Test SMS" panel.
- **Multi-channel campaign automation** — voice/SMS/email/WhatsApp fan-out per enrollment, retry policy, template substitution.
- **Voice recording + transcript pipeline** — Twilio recording webhook → Bunny CDN, OpenAI summary generation, structured outcome codes.
- **Layered prompt architecture** — 5 layers (platform → tenant → channel → role → session).
- **Knowledge base ingestion** — PDF, DOCX, XLSX, CSV, TXT, MD with input-bound safety caps.
- **Affiliate / partner program** — full lifecycle from application through payout, W-9 collection, 30-day holdback, auto-scheduled payouts.

---

## How to use this doc

- **Writing marketing copy?** Lift directly from the section that matches your audience. Sections 1, 4, 6 → tenant prospects. Section 9 → partner pitch. Sections 2, 3, 8 → technical buyers / "how does this actually work" deep-dive.
- **Writing a video script?** Each section is one video's worth of content. Section 6 (campaign engine) is its own video. Section 9 (partner program) is the recruiting video we already have.
- **Onboarding a new partner / staff member?** This doc top-to-bottom is the orientation.
- **Need to know if X is shipped?** Search this doc. If it's not in the changelog or a section, it's not shipped (or the doc is out of date — flag it).
- **Shipping a new feature?** Add it to the right section AND log it in the changelog. Same commit if possible. The doc is part of the change set.
