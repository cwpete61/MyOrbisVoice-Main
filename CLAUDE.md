# CLAUDE.md

## Autonomous operation rule — MANDATORY

Bypass-permissions mode is on for this project. The agent has standing authorization to run tools without per-call prompts. **In exchange, the agent must self-verify every step before moving on.** This is not optional — it replaces the human "approve each tool" gate.

After every meaningful action, before continuing to the next step, do all of the following:

1. **Read back what you just changed.** If you wrote/edited a file, re-read the changed section. If you ran a command, read the actual output, not just the exit code.
2. **Verify the code is correct.** Type-check, build, or lint where it applies. Confirm the change matches the intent — no truncated edits, no accidental duplicate blocks, no stale placeholders.
3. **Check for errors.** Read logs, HTTP status codes, build output. Do not assume "no error message" means "success" — confirm the success signal explicitly.
4. **Only then continue** to the next step.

**Before any commit / push / deploy:** in addition to the above, run the project's build + type-check, scan the diff yourself for stray debug code, and confirm the change set is exactly the intended scope. If any check fails, stop and fix the underlying issue — do not bypass with `--no-verify` or rerun in a sleep loop.

If a check is structurally impossible (e.g. a UI behavior that requires a browser), say so explicitly in the response rather than implying it was verified.

This rule supersedes the default "ask before risky actions" prompt — autonomous operation is granted, but verification is the trade.

## Bilingual content rule — MANDATORY

The product is **bilingual English + Spanish**. Every time you generate, add, or edit user-facing content, ship both languages in the same change. Don't write English-only and "we'll translate later" — that's how the Spanish surface rots into a sub-product. The two versions ship together or neither ships.

**What "user-facing content" means**:

- Marketing site pages, sections, copy, headlines, button labels
- Dashboard UI strings (nav labels, page titles, form labels, empty states, error messages, toast notifications, modal text, button labels, table headers)
- Charts, infographics, mockup screenshots, illustrations — if they contain text, render or commit both an English and a Spanish version (e.g. `chart-en.svg` + `chart-es.svg`, or text-as-HTML over a language-neutral SVG so one swap covers both)
- Email templates and SMS bodies
- Help articles, tooltips, onboarding flows
- Schema.org structured data (`description`, `name` of human-readable items)
- `<title>`, meta descriptions, Open Graph + Twitter card tags
- Audit log labels and admin-facing strings if a Spanish-speaking admin will see them

**What stays English in both languages** (universal references — translating creates drift):

- Brand: "MyOrbisVoice"
- Provider names: Gemini, Google Calendar, Gmail, Stripe, Twilio, WhatsApp, Bunny, OpenAI
- Voice names: Zephyr, Despina, Aoede, Charon, Fenrir, Puck, Sulafat
- Plan names: Free, Basic, Pro, LTD, Premier, Enterprise
- System codes / enum values: `BOOKED`, `CALLBACK_REQUESTED`, `MISSED_CALL`, `PENDING`, `APPROVED`, `HOLD`, `PAID`, `REVERSED`, `subscription_renewed`, `appointment-scheduled`, etc.
- Template tokens: `{firstName}`, `{businessName}`, `{appointmentDate}`, etc.
- URLs, paths, technical infrastructure terms (WebSocket, OAuth, CDN, JWT, API, SDK)
- US tax form names: W-9, W-8BEN, 1099-NEC

**Spanish style conventions** (established in the marketing site translation pass):

- **Latin American Spanish** (broader audience than Spain Spanish)
- **Informal "tú" form**, NOT "usted" — matches the SaaS-marketing voice
- Reference file for tone: `site/es/index.html` — match its phrasing for repeated concepts
- Currency stays in USD ($)

**Where the two languages live**:

- **Marketing site**: English at the apex (`myorbisvoice.com/<page>.html`), Spanish under `/es/` (`myorbisvoice.com/es/<page>.html`). Each page has a top-right toggle. Add `<link rel="alternate" hreflang="en">` + `<link rel="alternate" hreflang="es">` on both. Spanish pages set `<html lang="es">`. Asset paths in `/es/` files are `../assets/...`.
- **Dashboard** (when i18n is wired): user-level locale on `User.preferredLocale`, a profile-page toggle, JSON dictionaries `en.json` + `es.json`, `t('key')` helper. Adding a new string means adding it to **both** dictionaries — never English-only.
- **Legal pages** (Spanish versions of terms / privacy / cookies): include the disclaimer "La versión en inglés es la versión oficial y prevalece en caso de conflicto" at the top.

**Verification before declaring "done"**:

- New marketing page → both `site/<page>.html` and `site/es/<page>.html` exist, link to each other via the toggle, and round-trip cleanly.
- New dashboard string → both `en.json` and `es.json` have the key.
- Charts / graphics with text → both language versions exist OR the design uses HTML-text overlays that swap with the i18n system.

If you're tempted to ship English-only "for now" — stop and translate first. The rule exists because the alternative is a Spanish surface that drifts, embarrasses Spanish-speaking customers, and accumulates work that's harder to do later than it would have been at write-time.

### Enforcement — coverage scanner + auto-fill (use these, don't trust discipline)

The bilingual rule above is mandatory **and** mechanically enforced by tooling so it can't be silently skipped. Use these every time you touch user-facing code:

- **`pnpm i18n:check`** — scans every `.tsx` file for hardcoded English JSX text / `placeholder` / `aria-label` / `title` attributes that aren't wrapped in `t()`, AND reports keys present in `en.json` but missing from `es.json` (and vice versa). Exits non-zero if anything is missing. Required to pass before declaring any feature done.
- **`pnpm i18n:check:quiet`** — same scan, summary only.
- **`pnpm i18n:check:keys`** — dictionary-parity check only (faster).
- **`pnpm i18n:fill`** — backfills missing `es.json` keys via OpenAI using the project's translation conventions. Reads `OPENAI_API_KEY` from env (get the key from `Admin → System Settings → OpenAI`). Run after editing `en.json`.
- **`pnpm i18n:fill:dry`** — preview what would translate, no writes.

**Required workflow when editing English copy or adding a new feature**:

1. Edit `en.json` and/or wrap new strings in `t('key')`.
2. Run `pnpm i18n:check`.
3. If parity is missing: `OPENAI_API_KEY=sk-... pnpm i18n:fill` to backfill the Spanish, OR hand-translate.
4. Review the auto-filled translations (machine-translation quality varies on idioms).
5. Re-run `pnpm i18n:check`. Must exit 0 before commit.

**Anti-patterns that fail the scanner**:
- Hardcoded JSX text: `<button>Save</button>` → must be `<button>{t('actions.save')}</button>`.
- `placeholder="Enter your name"` → must be `placeholder={t('common.namePlaceholder')}`.
- New keys added to `en.json` without matching keys in `es.json`.
- Forgot to wrap strings in shared components — components also count.

**Scanner allow-list** (universal references that legitimately stay English in both languages, scanner treats them as clean): `MyOrbisVoice`, `OrbisVoice`, `Stripe` / `Twilio` / `Google` / `Gmail` / `Gemini` / `WhatsApp` / `Bunny` / `OpenAI`, voice names (`Zephyr`, `Despina`, etc.), plan names (`Free`, `Basic`, `Pro`, `LTD`, `Premier`, `Enterprise`), tax form names (`W-9`, `W-8BEN`, `1099-NEC`), and all-caps system enum codes. The allow-list lives in `scripts/i18n-coverage.ts` if you need to extend it.

When in doubt: run `pnpm i18n:check`. The scanner is the source of truth — if it's clean, the i18n state is clean.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

## Project

VoiceAutomation SaaS is a multi-tenant voice automation platform for businesses.

The platform has three primary channels:

1. Website widget
2. Inbound receptionist
3. Outbound caller

The product runs with:

- marketing site at `myorbisvoice.com` hosted on Spaceship
- SaaS app at `app.myorbisvoice.com` hosted on Contabo
- internal n8n engine at `n8n.myorbisvoice.com` hosted on Contabo
- PostgreSQL as the system of record
- Redis for cache, queue support, and session state
- Docker for local development and production deployment
- Stripe for billing and subscription lifecycle
- Twilio for inbound voice, outbound voice, forwarding, and SMS
- Google OAuth for Gmail and Google Calendar connectivity
- Gemini Live for real-time voice sessions
- OpenAI `gpt-4o-mini` for agent reasoning, orchestration, and prompt-driven role behavior

## Mission

Build a production-grade SaaS platform where customers configure voice agents through a complete UX/UI, while n8n runs orchestration behind the scenes.

Do not treat n8n as the customer-facing product.  
Do not treat n8n as the real-time voice runtime.  
Do not place tenant configuration ownership inside n8n.

## Primary architecture rule

The application owns configuration.  
The voice gateway owns live voice sessions.  
n8n owns orchestration.

That rule must hold across all implementation decisions.

## Hosting and domains

### ⚠️ Isolation boundary — non-myorbisvoice containers are OFF-LIMITS

The Contabo server (`147.93.183.4`) hosts multiple unrelated app stacks. **Only touch myorbisvoice resources.** Specifically:

- ✅ Allowed: any container named `myorbisvoice-*`, paths under `/opt/myorbisvoice/`
- ❌ Off-limits: `bps_zf-*` containers (BPS Zero Fees), paths under `/opt/bps_zf/` (except the shared Caddyfile — see fragility note below), `/opt/zf_bps/`, `/opt/zerofees/`, `applightboxseocom-*`, `zerofees-*`, `yt_transcriber-*`, anything else not prefixed `myorbisvoice-`.
- Never restart, exec into, copy files into, or modify environment of containers outside the myorbisvoice stack.

**Known fragility — shared Caddyfile.** The public-facing Caddy (`bps_zf-caddy-1`, ports 80/443) currently mounts `/opt/bps_zf/caddy/Caddyfile`, and that file holds host directives for **both** stacks (bpszerofees AND myorbisvoice). If the myorbisvoice deploy ever overwrites this file again (as happened on 2026-04-29), bpszerofees breaks. Long-term fix: move myorbisvoice's host blocks to its own Caddyfile and run a separate myorbisvoice-caddy on a different port behind a frontmost Caddy. Short-term: any change to that file must keep both stacks' host blocks. Pre-change backup convention: `/opt/bps_zf/caddy/Caddyfile.before-<reason>.<date>` before edits.

### Marketing
- host: Spaceship
- domain: `myorbisvoice.com`
- live document root: `/home/palucuidzi/myorbisvoice.com/`
- FTP host: `server43.shared.spaceship.host` (FTPS explicit on port 21, AUTH TLS required)
- **Active FTP user:** `deploy@myorbisvoice.com` — chroot remapped to the actual web root (`/home/palucuidzi/myorbisvoice.com/` directly), so uploads publish straight to live.
- Password: stored in `~/.netrc` (mode 600), **never** in this file or git
- Deploy command: `./infrastructure/scripts/deploy-marketing.sh`
- Verified end-to-end 2026-05-02: full 11-file marketing site deploys publish to `https://myorbisvoice.com/*` immediately. Twilio website-check passes 7/7.

**How the remapping was fixed (2026-05-02):** Spaceship's cPanel by default chroots each FTP user to a subfolder named after the user (e.g. `deploy@myorbisvoice.com` → `/myorbisvoice.com/deploy/`). The user remapped this in cPanel so the chroot points directly at `/myorbisvoice.com/` — no `/deploy/` subfolder. If this FTP account ever gets recreated, repeat the remapping or contact Spaceship support to confirm the chroot path.

**Other FTP files in `docs/`** (kept for reference, NOT actively used):
  - `MyOrbisVoice@myorbisvoice.com.coreftp` — older per-domain account, chrooted to wrong path
  - `MyOrbisVoice@377ee9cb-...spacecharged.site.coreftp` — staging/preview account
  - `palucuidzi.coreftp` / `palucuidzi@myorbisvoice.com.coreftp` — master/admin accounts

### Application
- host: Contabo
- domain: `app.myorbisvoice.com`
- server IP: `147.93.183.4`
- user: `root`
- password: `Orbis@8214@@!!` (fallback: `Orbis@8214`)
- Docker network: `myorbisvoice_net` (isolated — do NOT share with other app stacks)

### Automation engine
- host: Contabo
- domain: `n8n.myorbisvoice.com`
- same server as application
- internal use only
- **Double-locked:** Caddy basic_auth (user: `admin`, password: `Orbis@8214@@!!`) + n8n's own basic auth (same credentials via `N8N_BASIC_AUTH_USER/PASSWORD` in `.env.prod`)
- Caddy hash (bcrypt, generated 2026-05-01): `$2a$14$YDTB.X3eWzhjyqm6YB8.geZtskuBB0EmWpjk2EaNFWLZWH2VSZbXy`

### Transactional email
- use a separate sending subdomain such as `notify.myorbisvoice.com`
- keep transactional mail separate from human-operated mailboxes

## Core product modules

### Customer application
Must include:
- signup
- login
- plan selection
- workspace settings
- profile manager
- Business DNA configuration
- client master prompt editor
- channel configuration
- agent configuration
- Google connection flow
- Twilio configuration
- billing and usage views
- affiliate portal
- reporting

### Admin application surface
Must include:
- tenant search
- tenant detail view
- tenant configuration editing
- entitlement override
- impersonation
- reconnect integration actions
- workflow and audit inspection
- maintenance controls

### Voice gateway
Must include:
- real-time widget sessions
- call control coordination
- Twilio event handling
- Gemini Live session management
- tool-call routing to backend
- transcript and session finalization hooks

### Orchestration layer
Must use n8n for:
- tenant provisioning
- billing lifecycle workflows
- entitlement sync
- appointment flows
- reminders
- email and SMS follow-up
- outbound campaign preparation
- affiliate tracking workflows
- recovery and replay workflows

## Non-negotiable rules

1. Customers never access raw n8n.
2. n8n is internal only.
3. Real-time audio must not run inside n8n.
4. PostgreSQL is the source of truth for application configuration.
5. Prompt versions must be stored in the app database.
6. Business DNA must be stored in the app database.
7. All secrets must be write-only in the UI.
8. Gmail integration must use OAuth as the standard model.
9. Do not store customer Gmail passwords as the normal operating credential model.
10. Admins may control integrations without revealing plaintext secrets.
11. All impersonation actions must be logged.
12. Transactional email must be isolated from human mailbox email.
13. Every feature must be gated by entitlements and quotas.
14. Tenant access must be isolated.
15. Every phase must end with manual verification.

## Stack guidance

### Frontend
Prefer:
- Next.js
- TypeScript
- componentized UI
- clear admin and tenant layouts

### Backend
Prefer:
- Node.js
- TypeScript
- modular service architecture
- REST APIs for app operations
- background jobs only where needed

### Database
Use:
- PostgreSQL
- Prisma

### Cache and queue support
Use:
- Redis

### Voice and communications
Use:
- Twilio for phone and SMS
- Google APIs for calendar and Gmail
- Gemini Live for real-time voice
- OpenAI `gpt-4o-mini` for role-driven reasoning and orchestration tasks

### Orchestration
Use:
- n8n in queue mode
- separate main and worker services

### Infrastructure
Use:
- Docker for all environments
- reverse proxy at the edge
- internal-only service exposure for database and n8n internals

## Product channels

### 1. Website widget
The website widget is a real-time browser voice agent.

Requirements:
- tenant-specific config
- prompt stack resolution
- Business DNA injection
- short-lived session token handling
- session state tracking
- tool-call support
- booking support
- escalation support
- summary and transcript persistence

### 2. Inbound receptionist
The inbound receptionist handles live phone calls.

Requirements:
- inbound webhook handling
- tenant phone number resolution
- prompt stack resolution
- booking and alternate-slot logic
- after-hours behavior
- forwarding and transfer behavior
- transcript and summary logging

### 3. Outbound caller
The outbound caller handles campaign and follow-up calls.

Requirements:
- campaign scheduling
- contact and lead selection
- retry policy
- live result logging
- optional SMS or email follow-up

## Agent system

Supported agent roles:
- Orchestrator
- Appointment
- Sales
- Customer Service
- Marketing
- Assistant
- Secretary

Each role must support:
- enabled state
- prompt binding
- model binding
- allowed action set
- handoff rules
- per-tenant configuration

## Prompt architecture

Use a layered prompt system.

### Layer 1
Platform system prompt

### Layer 2
Tenant master prompt

### Layer 3
Channel overlay
- widget
- inbound
- outbound

### Layer 4
Role overlay
- role-specific behavior

### Layer 5
Session context
- runtime facts
- user context
- campaign or booking context
- tools available in this session

Do not collapse the entire system into one unstructured prompt blob.

## Business DNA

Business DNA is the tenant-specific knowledge and behavior layer.

It must capture:
- business identity
- service catalog
- pricing notes
- operating rules
- lead qualification rules
- customer service rules
- appointment rules
- escalation conditions
- language preferences
- prohibited language
- compliance rules

Store Business DNA as structured application data with version support.

## Customer onboarding

The onboarding flow must capture:
- account information
- workspace profile
- public contact details
- dedicated Google mailbox for agent operations
- Google OAuth connection
- Business DNA
- master prompts
- agent selection
- channel activation
- Twilio settings if enabled
- booking rules
- go-live test data

The agent mailbox must not be assumed to match the registration email.

## Integrations

### Google
Use OAuth for Gmail and Calendar.
Store token metadata and encrypted token references.
Do not reveal token values in the UI.

### Twilio
Support:
- inbound calling
- outbound calling
- SMS
- forwarding
- status callbacks

### Stripe
Support:
- plan purchase
- subscription lifecycle
- billing state normalization
- entitlement sync
- portal session access

### Transactional email
Keep it separate from human-operated mailbox infrastructure.
Do not send app notifications from normal staff inboxes.

## RBAC

Three platform roles, ranked from most → least privileged. Each guard
admits the named role AND every role above it.

**Platform Super Admin (`platform_super_admin`)** — full access. Only
role that can edit credentials in System Settings, view the per-
integration account-email associations, and manage other platform
staff (`/admin/team` page).

**Platform Admin (`platform_admin`)** — tenant management, plans,
comp codes, A2P submissions, phone numbers, storage tiers, audit
logs. CANNOT edit secrets/credentials, view account-email
associations, or grant/revoke platform-staff roles.

**Platform Support (`platform_support`)** — read-only access plus
impersonation (audit-logged). Designed for help-desk staff who need
to view tenant detail, listen to recordings, view A2P submissions,
read audit logs, and impersonate to assist locked-out tenants.
CANNOT edit anything that costs money or changes tenant state
(suspend/grant plan/generate comp code/purchase phone numbers/
approve A2P/etc).

**Tenant-side roles (unchanged):**
- Tenant Owner, Tenant Manager, Tenant Staff, Affiliate (Partner)

Rules:
- Platform Admins manage tenants without seeing plaintext secrets.
- Platform Support can view + impersonate but never write privileged
  changes; everything they do during impersonation is audit-logged
  with their support user ID + the impersonation session ID.
- Only Super Admin can grant/revoke platform-staff roles; the
  /admin/team page is gated to that role server-side.
- Tenant users manage only their own workspace per their role.
- Affiliates are isolated to affiliate (partner) functions.
- Tenant cross-access is forbidden.

Server-side enforcement lives in `apps/api/src/middleware/rbac.ts`
(`requirePlatformSupport` / `requirePlatformAdmin` /
`requirePlatformSuperAdmin`). UI mirrors the matrix via
`getPlatformRoleTier()` in `apps/web/src/lib/auth.ts`. Both layers
must agree; any drift means the API will reject what the UI shows.

## Secrets policy

All secrets are write-only in the UI.

Admins may:
- rotate secrets
- replace secrets
- reconnect integrations
- inspect connection status

Admins may not:
- reveal plaintext Gmail passwords
- reveal OAuth refresh tokens
- reveal Twilio auth secrets
- reveal Stripe signing secrets or private keys in the UI

Prefer:
- encrypted secret storage
- secret references in relational tables
- last-validated timestamps
- rotation state metadata

## Data ownership rules

The app database owns:
- tenants
- users and memberships
- plans and effective entitlements
- Business DNA
- prompt versions
- channels
- agents
- contacts
- conversations
- appointments
- integrations metadata
- affiliate records
- audit logs

n8n may read and act on this data.  
n8n does not become the source of truth for it.

## Workflow rules for n8n

Every workflow input must include:
- tenantId
- traceId
- workflowCode
- trigger metadata

Every workflow result must include:
- executionRef
- status
- normalized result or normalized error

Keep workflows modular.  
Avoid giant all-in-one workflows.  
Make workflows idempotent where duplicates are possible.

## Logging and audit

Must log:
- impersonation start and end
- prompt publication
- Business DNA publication
- integration reconnects
- entitlement overrides
- tenant suspensions and restores
- secret rotations
- critical workflow failures

Audit logs must be immutable at the application level.

## Repository expectations

Structure the repository so the boundaries are obvious.

Suggested top-level layout:

```text
/apps
  /web
  /api
  /voice-gateway
/packages
  /ui
  /config
  /types
  /prompt-engine
  /shared
/infrastructure
  /docker
  /caddy
  /scripts
/docs
  CLAUDE.md
  system docs
/n8n
  workflow specs
  import templates
/prisma
  schema.prisma
```

Adjust names only if the boundary remains clear.

## Coding standards

1. Use TypeScript everywhere practical.
2. Keep files small and purpose-specific.
3. Avoid hidden coupling between the app and n8n.
4. Use explicit types for API contracts.
5. Validate external inputs.
6. Normalize provider payloads before business logic consumes them.
7. Keep provider SDK usage behind service abstractions.
8. Avoid storing unstructured configuration when a typed model is reasonable.
9. Use migrations intentionally.
10. Add audit hooks to sensitive writes.

## Security rules

1. Never expose long-lived provider secrets to the browser.
2. Use short-lived session tokens for widget sessions.
3. Validate webhook signatures.
4. Protect admin routes aggressively.
5. Hash user passwords.
6. Encrypt secret material.
7. Log impersonation and integration changes.
8. Restrict service-to-service communication by network boundary.
9. Do not expose n8n publicly beyond protected admin access.

## Build order

Implement in this order unless a dependency forces a minor change.

### Phase 1
Foundation
- repo structure
- Docker stack
- reverse proxy
- PostgreSQL
- Redis
- auth skeleton
- RBAC skeleton

### Phase 2
Tenant configuration core
- workspace settings
- Business DNA editor
- prompt editor
- agent config
- channel config

### Phase 3
Billing and entitlements
- Stripe integration
- plans
- entitlement engine
- quota handling

### Phase 4
Google integration and booking
- Google OAuth
- mailbox and calendar status
- appointment creation
- email confirmation

### Phase 5
Widget MVP
- widget session flow
- voice gateway
- Gemini Live
- summaries and transcripts

### Phase 6
Inbound receptionist
- inbound Twilio flow
- transfer logic
- after-hours logic

### Phase 7
Outbound caller
- campaign model
- job preparation
- outbound result handling

### Phase 8
Affiliate portal
- affiliate account flows
- referral tracking
- commission ledger

### Phase 9
Hardening
- audit review tools
- monitoring
- backups
- recovery workflows
- operational polish

## Testing expectations

At the end of each phase, verify manually.

Minimum checks:
- auth works
- tenant isolation works
- plan gating works
- secret fields remain write-only
- Google connect flow works
- booking flow works
- widget session works
- inbound call flow works
- outbound call flow works
- audit logs record critical actions

## Deploy Protocol — MANDATORY

Every code change follows this exact sequence. No exceptions.

### Step 1 — Before writing any code
- State what you are about to change and why
- Identify which containers will be affected (api / web / gateway)
- If schema changes: flag that Prisma client must be pushed

### Step 2 — Build
```bash
pnpm --filter @voiceautomation/api build          # if API changed
pnpm --filter @voiceautomation/voice-gateway build # if gateway changed
pnpm --filter @voiceautomation/web build           # if web changed
```
Build must be clean (zero TypeScript errors) before proceeding.

### Step 3 — Deploy using the script
```bash
./infrastructure/scripts/deploy.sh [api|web|gateway|all] "reason"
```

The script handles everything atomically:
- Pre-deploy DB snapshot (local + prod)
- Prisma client regeneration and push to BOTH api and gateway containers
- rsync to server
- `docker cp` into containers (NOT just rsync — containers have their own filesystem)
- **Wipe stale static chunks for web** before injecting (prevents cached chunk crashes)
- Restart containers
- Health check
- Post-deploy DB snapshot

### Step 4 — Verify in browser
After every deploy:
1. Hard-refresh the browser (`Ctrl+Shift+R`) to clear cached chunks
2. Confirm the changed feature works
3. Confirm no regressions on adjacent pages

### Step 5 — Snapshot if stable
If the feature is confirmed working:
```bash
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > backups/db_$(date +%Y%m%d_%H%M%S)_<label>.dump
```

---

## Known Deploy Pitfalls — Never Repeat These

| Pitfall | What Happens | Fix |
|---|---|---|
| rsync without docker cp | Container runs old code | Always docker cp after rsync |
| Web deploy without wiping static | Browser loads stale chunk hashes → crash | Script wipes `/app/apps/web/.next/static` first |
| Schema change without prisma generate | `prisma.newModel` is undefined → 500 | Script always runs prisma generate + push |
| Prisma pushed to api only | Gateway crashes on new models | Script pushes to BOTH containers |
| Shell `$` in psql command | bcrypt hash corrupted silently | Always write SQL to a file, use `docker cp` + `psql -f` |
| `apiFetch` strips `meta` | Paginated data silently empty | API must embed everything inside `{ data: { items, total } }` |
| Partial `.next/` sync (web) | Prod runtime manifest stale; missing chunks return 404; `clientModules undefined` 500s | **Wipe FULL `/app/apps/web/.next/` before injection, not just `static/`. Inject via tar-pipe (`tar -cz \| ssh \| docker exec tar -xz`), NOT `docker cp .next/. container:.next/`** — the dot-glob silently drops files. Two prod incidents on 2026-05-09 traced here. Hardened in deploy.sh `step_web()` plus a post-sync sanity check on `BUILD_ID` + `_not-found/page.js` + `static/<BUILD_ID>/_buildManifest.js`. |
| `redirect()` inside server component + async layout | 500 with `Cannot read properties of undefined (reading 'clientModules')` | Do redirects at the routing layer in `next.config.mjs` `redirects()`, not inside an `app/page.tsx` that returns `redirect(...)`. Next.js 14 RSC bug — see fix(web) commit b81d7c4. |

---

## Consistency Checks — Run After Any Code Change

Before reporting a task complete, verify:
- [ ] TypeScript build clean (zero errors)
- [ ] `docker logs myorbisvoice-api --tail=5` shows "listening on" with no errors
- [ ] `docker logs myorbisvoice-gateway --tail=5` shows "listening on port 5000" with no errors
- [ ] `docker logs myorbisvoice-web --tail=5` shows "Ready in"
- [ ] `curl https://api.myorbisvoice.com/health` returns 200
- [ ] Changed feature tested manually in browser after hard-refresh

---

## Implementation behavior

When making architecture or coding decisions:
- preserve the app as the system of record
- preserve the voice gateway as the live runtime
- preserve n8n as the orchestration layer
- preserve admin power without exposing plaintext secrets
- preserve separation between transactional email and human mailbox infrastructure

If a proposed shortcut breaks one of those boundaries, reject the shortcut.

## Immediate coding targets

Start with:
1. Prisma schema draft
2. auth and RBAC foundation
3. tenant shell and business profile APIs
4. Business DNA and prompt versioning
5. Google OAuth flow
6. Stripe subscription normalization
7. admin impersonation and audit foundation

Do not start with aesthetic UI polish.  
Do not start with deep workflow automation before the data model and auth model are stable.  
Do not let raw provider payloads shape the internal domain model.

---

## Agent Assignments

See [docs/agent-assignments.md](docs/agent-assignments.md) — internal architectural reference describing how work is divided across the codebase (8 named sub-agents). Used during phase planning to clarify ownership of new code.

---

## Redundancy Measures

1. Every write goes through the service layer — no direct Prisma calls in route handlers
2. Database migrations are idempotent and reviewed before apply
3. Seed scripts use `upsert` — safe to rerun
4. Refresh tokens are rotated on every use (revoke old, issue new)
5. All external provider calls are behind service abstractions — swap without touching business logic
6. n8n workflows must be idempotent (traceId deduplication)
7. Docker restart policies are `unless-stopped` on all services
8. Secrets are write-only — no plaintext reveal path in the UI or API responses
9. Audit logs are append-only at the application level (no DELETE route)
10. Every phase has a manual verification gate before Phase N+1 begins

---

## Backup and Recovery Protocols

See [docs/recovery-procedures.md](docs/recovery-procedures.md) — incident-time reference: when to back up, local + prod backup commands, verified PG16-tested restore procedure, recovery from bad migration / dependency upgrade / bad deploy / corrupt config / corrupt DB, canonical paths, what to back up beyond the database.

---

## Testing Strategy

### Unit tests
- RBAC middleware (role resolution, tenant scoping)
- Auth service (token issue, refresh, revoke)
- Prompt engine (layer resolution, Business DNA injection)
- Service-layer business logic

### Integration tests
- Auth flow end to end (signup → login → refresh → logout)
- Tenant isolation (user A cannot access tenant B)
- Entitlement gating (feature blocked without correct plan)
- Webhook signature validation (Stripe, Twilio)

### Manual exit gate per phase
See phase plan — each phase has a specific exit gate checklist.  
No phase is considered complete until manual verification passes.

### Local-first rule
Build and verify locally before any live provider credentials are connected.  
Phases 1–2: No external API calls required.  
Phase 3+: Use Stripe test mode, Twilio test credentials, Google OAuth dev app.  
Phase 5+: Only connect Gemini Live once the local session flow is verified.

---

## Build Log

See [docs/build-log.md](docs/build-log.md) — historical record of every phase's deliverables and dated milestones (Phase 1 through Phase 9, campaign automation, partner program close-out, ongoing post-launch work). Append a new entry when shipping a meaningful chunk of work.

## Credentials

See [docs/credentials-reference.md](docs/credentials-reference.md) — where credentials live, format expectations, which Admin UI card to enter each into. Real values are stored encrypted in the DB (`Admin → System Settings`) or in `.env.prod` on the server, never in the repo.

## Future Features Backlog

See [docs/feature-backlog.md](docs/feature-backlog.md) — 20 confirmed product requirements with status (✅ DONE / 🟡 PARTIAL / ❌ TODO / 🔵 DEFERRED), design notes, effort estimates. Read before starting work on any item.

## Product Overview

See [docs/product-overview.md](docs/product-overview.md) — canonical living description of what MyOrbisVoice offers (15 in-depth sections + changelog). Upstream source for marketing copy, video scripts, partner pitches, and onboarding content. **Update in the same commit as any user-visible feature change** — see memory rule `feedback_product_overview_doc.md`.

## Launch Blockers

See [docs/launch-blockers.md](docs/launch-blockers.md) — open pre-launch items (real bugs + recommended-pre-launch + external-wait queues + closed). Re-reviewed weekly.

## Other extracted reference docs

- [docs/stripe-config.md](docs/stripe-config.md) — Stripe account reconstruction guide (account ID, webhook destinations, plan price mapping).
- [docs/twilio-toll-free-verification.md](docs/twilio-toll-free-verification.md) — drafted toll-free verification submission package.
