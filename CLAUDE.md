# CLAUDE.md

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

### Marketing
- host: Spaceship
- domain: `myorbisvoice.com`

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

Roles include:
- Platform Super Admin
- Platform Admin
- Tenant Owner
- Tenant Manager
- Tenant Staff
- Affiliate

Rules:
- Platform admins can manage tenants without seeing plaintext secrets.
- Tenant users can manage only their own workspace according to role.
- Affiliates must be isolated to affiliate functions.
- Tenant cross-access is forbidden.

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

### Orchestrator Agent
Coordinates all other agents. Reviews integration contracts between packages and apps. Resolves cross-boundary conflicts. Owns the build sequence and exit gate verification. Runs at the start and end of every phase.

### Agent 1 — Infrastructure
- Monorepo scaffold (pnpm workspaces, turborepo)
- Docker-compose and Caddyfile maintenance
- TypeScript base config
- CI config
- Environment variable schema

### Agent 2 — Database
- Prisma schema evolution
- Migrations (never destructive without review)
- Seed scripts (idempotent upserts)
- Index and constraint review

### Agent 3 — API
- Express server setup
- All REST endpoints per docs/18-api-contracts.md
- Webhook handlers (Stripe, Twilio)
- Input validation with Zod
- Error handling middleware

### Agent 4 — Auth
- JWT access tokens (15m TTL)
- Opaque refresh tokens (30d, stored as SHA-256 hash)
- RBAC middleware (requireRole, requirePlatformAdmin, requireTenantAccess)
- Session management

### Agent 5 — Frontend
- Next.js App Router
- Admin layout (platform roles)
- Tenant layout (tenant roles)
- Auth pages (login, signup)
- Component library (packages/ui)

### Agent 6 — Voice Gateway
- WebSocket session management
- Twilio call control
- Gemini Live bridge
- Prompt resolution
- Transcript persistence
- Phase 5+ only

### Agent 7 — Integrations
- Stripe checkout and webhook lifecycle
- Google OAuth flow
- Twilio webhook normalization
- Transactional email dispatch
- Phase 3+ only

### Agent 8 — Testing
- Unit tests for RBAC and service layer
- Integration tests against real DB (no mocks)
- Docker health check verification
- Manual exit gate checklists per phase

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

### When to take a backup

Take a named backup before every phase begins and before any destructive or high-risk operation:
- Before running `prisma migrate deploy` or `prisma db push`
- Before any seed script that modifies existing rows
- Before upgrading a major dependency (Prisma, Next.js, Stripe SDK, etc.)
- Before merging a large feature branch into main
- Before Phase N+1 begins (the exit gate must pass first)

### Database backup — local

PostgreSQL runs in the `umoja-postgres` Docker container (shared with other projects). Use docker exec:

```bash
# Dump the voiceautomation database to a timestamped file
docker exec umoja-postgres pg_dump -U voiceautomation -d voiceautomation -F c \
  > backups/db_$(date +%Y%m%d_%H%M%S).dump

# Restore from a dump
docker exec -i umoja-postgres pg_restore \
  -U voiceautomation -d voiceautomation --clean --if-exists \
  < backups/<filename>.dump
```

Store dumps in `backups/` at the repo root (gitignored — see `backups/.gitignore`). Keep at least the last 3 phase snapshots.

### Database backup — production (Contabo)

```bash
# On the Contabo server, run via Docker
docker exec voiceautomation-postgres pg_dump \
  -U voiceautomation -d voiceautomation -F c \
  > /var/backups/va/db_$(date +%Y%m%d_%H%M%S).dump
```

Automate this with a cron job inside the backup service container (see docker-compose). Retain 7 daily dumps minimum.

### Code snapshot before a phase

Before each phase, tag the working state in git:

```bash
git add -A
git commit -m "snapshot: pre-phase-N checkpoint"
git tag phase-N-start
```

This makes rollback trivial: `git checkout phase-N-start`.

### Recovery protocol — database

1. Stop the API and voice-gateway containers to prevent writes.
2. Run `pg_restore` (see above) against the target dump.
3. Verify schema version matches the codebase: `pnpm prisma migrate status`.
4. If migration state is ahead of the dump, run `pnpm prisma migrate resolve --rolled-back <migration_name>` for each rolled-back migration.
5. Restart services and run the E2E suite: `pnpm --filter @voiceautomation/e2e test`.

### Recovery protocol — bad migration

1. Identify the migration name from `pnpm prisma migrate status`.
2. If the migration is destructive and data is lost, restore from the pre-phase database dump first.
3. Mark the migration as rolled back: `pnpm prisma migrate resolve --rolled-back <migration_name>`.
4. Fix the migration file or create a corrective one.
5. Re-apply: `pnpm prisma migrate deploy`.

### Recovery protocol — dependency upgrade gone wrong

1. `git stash` or `git checkout` to restore `package.json` and lock file.
2. Run `pnpm install` to restore the previous dependency tree.
3. Verify the build passes: `pnpm --filter @voiceautomation/api build` and `pnpm --filter @voiceautomation/web build`.

### What to back up beyond the database

| Asset | Location | How |
|---|---|---|
| Database | PostgreSQL | pg_dump before each phase |
| Environment variables | `.env` files | Keep an encrypted copy off-repo (1Password, Bitwarden, etc.) |
| n8n workflows | n8n UI | Export all workflows as JSON before each phase; store in `/n8n/exports/` |
| Uploaded files / media | If applicable | rsync to secondary location |
| Redis data | Only queue state | Redis is ephemeral by design; queued jobs re-enqueue on restart |

### Automated backup service (production)

The production `docker-compose.yml` must include a backup service that:
- Runs `pg_dump` on a schedule (daily minimum, hourly during active development sprints)
- Rotates dumps older than 30 days
- Alerts (via email or webhook) if a backup fails

Add this to the Phase 9 hardening checklist.

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

### Phase 1 — Foundation

- [x] Monorepo root (package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json) — 2026-04-29
- [x] packages/types — shared TypeScript types and role constants — 2026-04-29
- [x] packages/config — env schema validation with Zod — 2026-04-29
- [x] packages/shared — crypto utilities, Result type, AppError — 2026-04-29
- [x] prisma/schema.prisma — RefreshToken model added, CampaignStatus enum added, OutboundCallAttempt back-relation fixed — 2026-04-29
- [x] prisma/seed.ts — 6 RoleDefinitions and 3 Plans seeded (idempotent upserts) — 2026-04-29
- [x] apps/api — Express server, auth endpoints, RBAC middleware, health endpoint — 2026-04-29
- [x] apps/web — Next.js scaffold, login/signup pages, dashboard shell — 2026-04-29
- [x] Prisma migration applied (20260429061353_voiceautomation_init) — 2026-04-29
- [x] Health endpoint confirmed green: GET /health → {status: "ok", checks: {database: "ok", redis: "ok"}} — 2026-04-29
- [x] Signup works end to end — tenant created, tokens issued — 2026-04-29
- [x] Login works end to end — token returned, /me returns user + memberships — 2026-04-29
- [x] Tenant isolation primitives exist (RBAC middleware: requireRole, requirePlatformAdmin, requireTenantContext, requireTenantMatch) — 2026-04-29

### Phase 2 — Tenant Configuration Core — 2026-04-29

**Backend services and routes:**
- [x] `GET/PATCH /api/tenants/current` — workspace settings
- [x] `GET/PATCH /api/business-profile` — brand, address, hours, notification email
- [x] `GET/POST/PATCH/:id/publish /api/business-dna` — versioned Business DNA (draft → publish → active)
- [x] `GET/POST/PATCH/:id/publish /api/prompts` — prompt versioning (DRAFT → PUBLISHED), all 5 scopes
- [x] `GET/PATCH /api/agents/:roleType` — 7 agent roles, auto-provisioned on first access
- [x] `GET/PATCH /api/channels/:channelType` — 3 channels, auto-provisioned on first access
- [x] `GET/PATCH/POST:suspend/POST:restore /api/admin/tenants` — admin tenant list + detail + actions

**Frontend pages:**
- [x] `/settings` — workspace + business profile editor
- [x] `/business-dna` — versioned DNA editor with section tabs, draft/publish flow
- [x] `/prompts` — prompt library, create/edit/publish
- [x] `/agents` — 7 agent role configuration panels
- [x] `/channels` — 3 channel cards with enable/config
- [x] `/admin/tenants` — searchable tenant list
- [x] `/admin/tenants/[tenantId]` — tenant detail, suspend/restore, member list, integration status

**Exit gate verified:**
- Workspace settings save (email, timezone) ✅
- Business DNA draft published → active ✅
- Prompt created, published ✅
- Widget channel enabled ✅
- Admin route blocked for tenant_owner (FORBIDDEN) ✅
- Type-check clean ✅

### Phase 3 — Billing and Entitlements — 2026-04-29

**Backend services and routes:**
- [x] `stripe` package installed (v22, API version 2026-04-22.dahlia)
- [x] `getOrCreateStripeCustomer` — creates Stripe customer on first checkout, stores in `StripeCustomerRef`
- [x] `GET /api/billing/plans` — public endpoint, returns all active plans with entitlements
- [x] `GET /api/billing/subscription` — current tenant subscription with plan + entitlements
- [x] `POST /api/billing/checkout-session` — creates Stripe checkout session for a plan
- [x] `POST /api/billing/portal-session` — opens Stripe customer portal
- [x] `GET /api/entitlements` — returns effective entitlements for the tenant
- [x] `POST /api/webhooks/stripe` — raw-body handler, verifies Stripe signature, handles 4 events
- [x] Webhook events handled: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
- [x] Entitlement sync (`syncEntitlementsFromPlan`) — upserts `TenantEntitlement` rows from plan on subscription activate
- [x] Signup flow seeds starter plan entitlements immediately (non-fatal if Stripe key absent)
- [x] Seed updated to pull `STRIPE_PRICE_*` from env vars on `pnpm db:seed`

**Frontend pages:**
- [x] `/billing` — current subscription status, entitlement breakdown, plan selection cards, Stripe portal button

**Architecture fixes:**
- [x] Stripe webhook route mounted before `express.json()` with `express.raw()` for signature integrity
- [x] `billingRouter` mounted before auth-gated routers so public `/billing/plans` is reachable unauthenticated
- [x] Prisma `Without<>` discriminant union conflicts resolved via explicit `Prisma.AgentProfileUpdateInput` build
- [x] JSON null fields use `Prisma.JsonNull` sentinel instead of bare `null`
- [x] `tsconfig.base.json` and `packages/config` both include `"types": ["node"]`
- [x] All route files annotated `const router: IRouter = Router()` to fix TS2742

**Exit gate verified:**
- `GET /api/billing/plans` returns 3 plans with 7 entitlements each (no auth required) ✅
- Signup auto-seeds starter entitlements; `GET /api/entitlements` returns `{max_channels:1, widget_enabled:true, ...}` ✅
- `POST /api/billing/checkout-session` returns BAD_REQUEST when plan has no Stripe price ID ✅
- `POST /api/billing/portal-session` returns BAD_REQUEST when no Stripe customer exists ✅
- Stripe webhook endpoint reached (INTERNAL_ERROR expected without configured webhook secret in dev) ✅
- Type-check clean (API + web) ✅

### Pre-Phase 2 gap closures — 2026-04-29

- [x] `WidgetSession` model added — short-lived token, prompt/DNA snapshot, status lifecycle, migrated
- [x] n8n now uses `DB_POSTGRESDB_SCHEMA=n8n` — fully isolated from app `public` schema in docker-compose and env
- [x] Rate limiting applied at three tiers: auth (30 req/15min), general API (300 req/min), webhooks (60 req/min)
- [x] Refresh token cleanup job — runs at startup + every 6 hours, prunes expired/revoked tokens older than 7 days

### E2E Test Suite — 2026-04-29

- [x] `apps/e2e` package created with Puppeteer + tsx
- [x] 4 suites: `api` (12 tests), `auth` (6 tests), `billing` (5 tests), `config` (8 tests)
- [x] All 31 tests passing: `pnpm --filter @voiceautomation/e2e test`
- [x] Fixed bugs found by tests:
  - `/dashboard/page.tsx` was self-redirecting → fixed to redirect to `/settings`
  - Dashboard layout had no auth guard → added `AuthGuard` client component
  - Test localStorage key was `accessToken`, should be `va_access_token`
- [x] To run: `pnpm --filter @voiceautomation/e2e test` (all suites) or `test:api / test:auth / test:billing / test:config`

### Phase 4 — Google OAuth + Calendar Booking — 2026-04-29

**Backend services and routes:**
- [x] `googleapis` package installed in `apps/api`
- [x] `apps/api/src/lib/audit.ts` — reusable `writeAuditLog()` helper (non-fatal, Prisma.InputJsonValue typed)
- [x] `apps/api/src/services/google.service.ts` — full OAuth flow:
  - `startGoogleOAuth` — stores state token in DB, returns Google consent URL
  - `handleGoogleCallback` — exchanges code, fetches userinfo + calendar list, encrypts tokens (AES-256-GCM using AUTH_SECRET), stores in `SecretRef` + `GoogleConnectionDetail`
  - `getGoogleConnection` — returns status + email + calendar count
  - `disconnectGoogle` — revokes token, clears detail and secret refs, audit logged
  - `getAuthenticatedGoogleClient` — decrypts stored credentials, auto-refreshes if near expiry, returns ready `OAuth2Client`
- [x] `apps/api/src/services/appointment.service.ts`:
  - `searchAvailability` — queries Google Calendar freebusy, returns open 30-min slots
  - `createAppointment` — conflict-checks, creates Google Calendar event, stores Appointment record
  - `rescheduleAppointment` — patches Google event + DB record
  - `cancelAppointment` — deletes Google event + marks DB record CANCELED
  - `listAppointments` — paginated list with status/date filters
- [x] `apps/api/src/routes/integrations.ts` — `GET /api/integrations`, `POST /api/integrations/google/start`, `GET /api/integrations/google/callback` (browser redirect), `POST /api/integrations/google/reconnect`, `DELETE /api/integrations/google`
- [x] `apps/api/src/routes/appointments.ts` — `POST /api/appointments/availability/search`, `POST /api/appointments`, `PATCH /api/appointments/:id/reschedule`, `PATCH /api/appointments/:id/cancel`, `GET /api/appointments`
- [x] Routes mounted in `apps/api/src/routes/index.ts`
- [x] `apiFetchRaw` helper added to `useApi.ts` — returns raw `Response` for mutation calls

**Frontend pages:**
- [x] `/integrations` — Google connection panel: status badge, connect/reconnect/disconnect buttons, OAuth redirect handling, calendar count, last verified timestamp
- [x] `/appointments` — Appointment list with status badges, timezone display, cancel action
- [x] Sidebar updated with "Operations" section containing Integrations + Appointments links

**Architecture notes:**
- OAuth tokens encrypted at rest with AES-256-GCM (key derived from AUTH_SECRET)
- Token values never returned in API responses
- State token stored in `IntegrationConnection.metadataJson.oauthState` for callback verification
- All connection events audit-logged: `integration.google.oauth_started`, `integration.google.connected`, `integration.google.oauth_failed`, `integration.google.disconnected`
- Google client auto-refreshes tokens within 5 minutes of expiry

**Exit gate (manual verification required):**
- [ ] `GET /api/integrations` returns `{ google: { status: "NOT_CONNECTED", ... } }` for new tenant
- [ ] `POST /api/integrations/google/start` returns redirect URL (requires GOOGLE_CLIENT_ID/SECRET in .env)
- [ ] OAuth callback redirects to `/integrations?google=success&email=...` on success
- [ ] `/integrations` page shows CONNECTED status with email and calendar count
- [ ] Disconnect clears connection and shows NOT_CONNECTED
- [ ] `POST /api/appointments/availability/search` returns slots when Google connected
- [ ] `POST /api/appointments` creates appointment in Google Calendar + DB

### Phase 1 notes
- Existing ports 5432 and 6379 are occupied by other projects (umoja-postgres, umoja-redis). Phase 1 reuses these services. The voiceautomation DB was created on umoja-postgres with its own user/role.
- Docker compose is set up for full-stack mode but dev workflow runs API/web natively via pnpm dev.
- To run the API: `pnpm --filter @voiceautomation/api dev` (from repo root)
- To run the web: `pnpm --filter @voiceautomation/web dev` (from repo root)
- AUTH_SECRET is in .env (generated, not committed)

## Credentials

### Google OAuth (myorbisvoice project)
- **Project ID:** myorbisvoice
- **Client ID:** 548023119687-734aljh9786uh1k85kv0506coob25rje.apps.googleusercontent.com
- **Client Secret:** GOCSPX-[REDACTED]
- **Auth URI:** https://accounts.google.com/o/oauth2/auth
- **Token URI:** https://oauth2.googleapis.com/token
- **Correct Redirect URI (use this):** https://api.myorbisvoice.com/api/integrations/google/callback

> ⚠️ The downloaded JSON has `redirect_uris: ["https://app.myorbisvoice.com/"]` — this is wrong.
> The authorised redirect URI in Google Cloud Console must be set to:
> `https://api.myorbisvoice.com/api/integrations/google/callback`

### Brand Color Palette (Marketing Site)
Teal swatch — 6 shades light to deep:
- `#3dbcbc` — Teal 1 (lightest)
- `#2aabab` — Teal 2
- `#1a9898` — Teal 3 (primary accent)
- `#158484` — Teal 4
- `#0f7070` — Teal 5
- `#0a5c5c` — Teal 6 (darkest)
