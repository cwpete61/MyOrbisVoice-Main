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
- FTP host: `server43.shared.spaceship.host` (FTPS explicit on port 21, AUTH TLS required)
- FTP users available (both tested 2026-05-02):
  - `MyOrbisVoice@myorbisvoice.com` — current `~/.netrc` user
  - `MyOrbisVoice@377ee9cb-5afb-4a2e-aed8-ca3464387273-internalonly.spacecharged.site` — staging
- Password: stored in `~/.netrc` (mode 600), **never** in this file or git
- Deploy command: `./infrastructure/scripts/deploy-marketing.sh`

> ⚠️ **Open question (2026-05-02):** Files uploaded via either FTP account land in the chrooted FTP home directory but **do not** appear at `https://myorbisvoice.com`. The live site's `last-modified` header didn't change after deploy, and a probe file was 404 at every common doc-root path. Need to confirm in the Spaceship dashboard:
> 1. Is there a **primary cPanel FTP user** (not the per-domain virtual users) with access to the actual document root?
> 2. Does the Spaceship UI have a **"Publish to Live"** step that copies from these FTP accounts to the served site?
> 3. Is `myorbisvoice.com` actually served from this Spaceship account, or from somewhere else (DNS misroute)?
>
> The deploy script and credentials work — they just point at storage that isn't web-served. Update `~/.netrc` host/user once the right target is identified.

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

## Planned Feature: Voice Recording + Transcript Storage

**Status:** Designed, not yet built. Do not skip this when building Phase 5/6/7.

### Purpose
Every call — inbound, outbound, and widget — must produce two persistent artifacts:
1. A **voice recording** (audio file) stored and retrievable per call
2. A **text transcript** with speaker labels and timestamps

These artifacts are foundational for:
- The web app conversation history view
- The future desktop app and mobile app (playback, search, review)
- Campaign outcome analysis
- Agent quality review
- Compliance and audit trails

### Recording Storage
- Twilio provides call recordings natively via its Recording API
- Gemini Live sessions produce audio that must be captured at the gateway layer
- Recordings must be stored in a tenant-isolated location (object storage or Twilio-hosted)
- Store the recording URL/ref in the `Conversation` record, never the raw audio in PostgreSQL
- Access must be gated — tenants can only retrieve their own recordings

### Transcript Storage
- Transcripts are generated from the audio after the call ends
- For Twilio calls: use Twilio's transcription service or pipe audio to OpenAI Whisper
- For Gemini Live sessions: capture turn-by-turn text at the gateway in real time
- Store full transcript as structured JSON (speaker, text, timestamp per turn) in object storage
- Store a plain-text summary in the `Conversation.summaryText` field for quick display
- Store the transcript reference (URL or key) in `Conversation.transcriptRef`

### Data model touch points
- `Conversation.transcriptRef` — already exists, use for transcript file reference
- `Conversation.summaryText` — already exists, use for AI-generated summary
- `Conversation.outcomeCode` — already exists, use for structured call outcome
- Add `Conversation.recordingRef` — URL or storage key for the audio file
- Add `Conversation.recordingDurationSecs` — integer, call length in seconds
- Add `Conversation.transcriptJson` — JSONB, structured turn-by-turn transcript

### Desktop + Mobile app considerations
- Recordings and transcripts must be accessible via the REST API with proper auth
- Playback must stream, not download — use signed URLs with short TTL
- Transcript search must be possible — index transcript text or use full-text search
- Mobile app will need a lightweight transcript view and audio player component
- All of this depends on recordings and transcripts being stored consistently from day one

### Build order
1. Add `recordingRef`, `recordingDurationSecs`, `transcriptJson` to `Conversation` schema (do during Phase 5)
2. Wire Twilio recording webhook to store `recordingRef` on call end (Phase 6)
3. Wire Gemini Live transcript capture at gateway layer (Phase 5)
4. Build conversation detail view in web app showing transcript + playback link (Phase 5/6)
5. Expose `GET /api/conversations/:id/recording` and `GET /api/conversations/:id/transcript` endpoints
6. Mobile/desktop app consumes these same endpoints — no separate API needed

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

### Verified backup restore procedure (TESTED 2026-05-02)

**IMPORTANT:** Production runs PostgreSQL 16. The local `umoja-postgres` runs PG 15, which **cannot** read PG 16 custom-format dumps. Restore tests must use a PG 16 instance.

This procedure has been run end-to-end and confirmed working — row counts of every critical table matched exactly between prod and the restored copy.

```bash
# 1. Take a fresh prod dump
DUMP=backups/restore-test/prod_$(date +%Y%m%d_%H%M%S).dump
mkdir -p backups/restore-test
ssh root@147.93.183.4 'docker exec myorbisvoice-postgres pg_dump -U voiceautomation -d voiceautomation -F c' > "$DUMP"

# 2. Spin up a temporary PG 16 container on a non-conflicting port
docker run -d --name pg16-restore-test \
  -e POSTGRES_USER=voiceautomation \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=voiceautomation_restore_test \
  -p 5433:5432 \
  postgres:16-alpine

# 3. Wait for it to be ready
for i in {1..15}; do
  docker exec pg16-restore-test pg_isready -U voiceautomation 2>&1 | grep -q "accepting" && break
  sleep 1
done

# 4. Restore
docker cp "$DUMP" pg16-restore-test:/tmp/restore.dump
docker exec pg16-restore-test pg_restore -U voiceautomation -d voiceautomation_restore_test --no-owner --no-acl /tmp/restore.dump

# 5. Verify row counts match prod
for t in Tenant TenantMember User Plan RoleDefinition Conversation Contact Appointment SystemConfig BusinessProfile; do
  PROD=$(ssh root@147.93.183.4 "docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation -t -c 'SELECT COUNT(*) FROM \"$t\"'" | tr -d ' \r\n')
  RESTORED=$(docker exec pg16-restore-test psql -U voiceautomation -d voiceautomation_restore_test -t -c "SELECT COUNT(*) FROM \"$t\"" | tr -d ' \r\n')
  [ "$PROD" = "$RESTORED" ] && echo "✅ $t: $PROD" || echo "❌ $t: prod=$PROD restored=$RESTORED"
done

# 6. Cleanup
docker rm -f pg16-restore-test
```

**Run this monthly** (or before any major schema change) to confirm backups remain restorable.

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

### Rollback procedure — bad deploy broke production

**Symptoms:** site returns 500/502, login flow broken, blank pages, console errors after a deploy. You need to revert to last-known-good state in <5 minutes.

**Pre-flight (always do this first):**
```bash
# Capture the broken state for later debugging — DO NOT skip
ssh root@147.93.183.4 'docker logs myorbisvoice-api --tail=200' > /tmp/broken_api_$(date +%s).log
ssh root@147.93.183.4 'docker logs myorbisvoice-web --tail=200' > /tmp/broken_web_$(date +%s).log
```

**Step 1 — Identify the last known good commit:**
```bash
git log --oneline -10                                # see recent deploys
git tag -l                                            # see tagged checkpoints
# Permanent rollback anchors (always present):
#   pre-stabilization-20260502  — clean state, post-stabilization sweep
#   disaster-backup-20260501    — pre-hardening snapshot
```

**Step 2 — Roll the working tree back to that commit:**
```bash
LAST_GOOD=pre-stabilization-20260502        # or any commit hash from step 1
git checkout "$LAST_GOOD"
```

**Step 3 — Rebuild and redeploy ONLY the affected services:**
```bash
# Identify which apps changed since the rollback target
git diff --name-only HEAD master | awk -F/ '{print $2}' | sort -u
# Rebuild + deploy only those (saves 5+ minutes vs deploying everything)
pnpm --filter @voiceautomation/api build
./infrastructure/scripts/deploy.sh api "rollback to $LAST_GOOD"
# (repeat for web/gateway as needed)
```

**Step 4 — Verify the rollback worked:**
```bash
curl -s https://api.myorbisvoice.com/health | grep -q '"status":"ok"' && echo OK
curl -s -o /dev/null -w "%{http_code}\n" https://app.myorbisvoice.com/login        # expect 200
ssh root@147.93.183.4 'docker logs myorbisvoice-api --tail=20'    # expect "listening on" with no errors
```

**Step 5 — Return to master and fix forward:**
```bash
git checkout master
# Open a new branch to fix the bug. Do NOT redeploy from master until tests pass.
```

**⚠️ Note on Docker image rollback:** Images are tagged `:latest` only — there is no built-image version history. The procedure above rebuilds from source rather than retagging an old image. If you need image-level rollback (faster, no rebuild), it must be added to `deploy.sh` as a future improvement (tag the previous `:latest` as `:rollback` before overwriting).

### Rollback procedure — config files wiped or corrupted

**Symptoms:** containers won't start, env vars missing, compose syntax error after editing.

**Step 1 — Restore from the most recent DR snapshot:**
```bash
# Find the most recent DR snapshot
LATEST_DR=$(ls -td backups/dr-* | head -1)
echo "Restoring from $LATEST_DR"

# Compose file
ssh root@147.93.183.4 'cp /opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml{,.broken.bak}'
scp "$LATEST_DR/compose.prod.docker.yml" \
    root@147.93.183.4:/opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml

# Env file
ssh root@147.93.183.4 'cp /opt/myorbisvoice/infrastructure/docker/.env.prod{,.broken.bak}'
scp "$LATEST_DR/env.prod.docker" \
    root@147.93.183.4:/opt/myorbisvoice/infrastructure/docker/.env.prod
ssh root@147.93.183.4 'chmod 600 /opt/myorbisvoice/infrastructure/docker/.env.prod'
```

**Step 2 — Bring services back up:**
```bash
ssh root@147.93.183.4 'cd /opt/myorbisvoice/infrastructure/docker && \
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d'
```

**Step 3 — Verify:**
```bash
curl -s https://api.myorbisvoice.com/health
ssh root@147.93.183.4 'docker ps --filter name=myorbisvoice --format "{{.Names}} {{.Status}}"'
```

### Rollback procedure — database corrupted or wrong data deployed

Use the verified restore procedure documented above. **Always test the restore in the PG16 sandbox container first**, then if confirmed working, restore to prod:

**Step 1 — Stop write traffic:**
```bash
ssh root@147.93.183.4 'docker stop myorbisvoice-api myorbisvoice-gateway'
```

**Step 2 — Pick a dump (most recent good one):**
```bash
ssh root@147.93.183.4 'docker exec myorbisvoice-db-backup ls -lt /backups/ | head -10'
# Note the filename you want: e.g. db_20260502_084359.dump
```

**Step 3 — Restore in place:**
```bash
DUMP=db_20260502_084359.dump  # ← change to the one you picked
ssh root@147.93.183.4 "docker exec myorbisvoice-db-backup cat /backups/$DUMP" | \
  ssh root@147.93.183.4 'docker exec -i myorbisvoice-postgres pg_restore \
    -U voiceautomation -d voiceautomation --clean --if-exists --no-owner --no-acl'
```

**Step 4 — Verify schema state:**
```bash
ssh root@147.93.183.4 'docker exec myorbisvoice-postgres psql -U voiceautomation -d voiceautomation \
  -c "SELECT count(*) FROM \"Tenant\"; SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"Conversation\";"'
```

**Step 5 — Resume traffic:**
```bash
ssh root@147.93.183.4 'docker start myorbisvoice-api myorbisvoice-gateway'
sleep 6 && curl -s https://api.myorbisvoice.com/health
```

### Quick reference — canonical paths

These are the only files in production that should be edited. Everything else is generated or deprecated:

| Asset | Path |
|---|---|
| Compose file | `/opt/myorbisvoice/infrastructure/docker/docker-compose.prod.yml` |
| Env file | `/opt/myorbisvoice/infrastructure/docker/.env.prod` |
| Caddy reverse proxy | `/opt/myorbisvoice/infrastructure/caddy/Caddyfile` |
| Daily DB backups | volume `myorbisvoice_db_backups` (mounted at `/backups/` inside `myorbisvoice-db-backup`) |
| Local DR snapshots | `backups/dr-YYYYMMDD_HHMMSS/` (gitignored) |
| Last-known-good git tags | `pre-stabilization-20260502`, `disaster-backup-20260501` |

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

### Phase 5 & 6 — Voice Gateway + Inbound Receptionist — 2026-04-30 / 2026-05-01

**Voice gateway (inbound calls):**
- [x] Gemini Live session management via `apps/voice-gateway/src/services/gemini.service.ts`
- [x] Inbound Twilio Media Stream handler at `apps/voice-gateway/src/inbound.ts`
- [x] Transcript delta accumulation with per-speaker buffers — flushed on turn complete or speaker switch
- [x] `cleanTranscript()` in `summary.service.ts` — GPT-4o-mini post-processes raw ASR output to fix mid-word spacing artifacts before storing
- [x] `generateSummary()` — 2-3 sentence call summary stored in `Conversation.summaryText`
- [x] `persistConversation()` — updates existing Conversation (matched by `externalCallId`) for inbound; creates new for widget
- [x] `onClose` fix — removed `closed = true` from `close()` so the WebSocket close event fires `finalize()`
- [x] Voice name selector — `voiceName` stored in `ChannelConfig.configJson`, passed to Gemini `speech_config.voice_config.prebuilt_voice_config`
- [x] Gateway reads OpenAI key from DB via `lib/config.ts` (AES-256-GCM decrypt) — not raw env var

**Curated agent voices (7 options presented to tenants in channel config):**
| Voice | Gender | Style |
|---|---|---|
| Zephyr | Female | Bright & clear |
| Despina | Female | Smooth & polished |
| Aoede | Female | Warm & breezy |
| Charon | Male | Deep & authoritative |
| Fenrir | Male | Warm & approachable (default) |
| Puck | Male | Upbeat & conversational |
| Sulafat | Neutral | Warm & even |

**Twilio recording pipeline:**
- [x] `startCallRecording()` — triggers Twilio REST API to start recording on call connect
- [x] Twilio sends webhook to `POST /api/webhooks/twilio/recording` when recording is ready
- [x] `handleRecordingReady()` — decrypts Twilio auth token from `TwilioConnectionDetail`, fetches MP3, uploads to Bunny storage zone
- [x] `Conversation.recordingStatus` lifecycle: `null → processing → stored` (or `failed` / `twilio_hosted`)
- [x] `GET /api/conversations/:id/recording` — proxies audio blob from Bunny storage via API (bypasses CDN auth requirement)
- [x] Conversations page — audio player, transcript (word-for-word, speaker-labeled), and summary

**Key bug fixes logged here to avoid repeating:**
- Frankfurt (DE) Bunny region uses `storage.bunnycdn.com` — NOT `de.storage.bunnycdn.com`
- Twilio Media Stream `<Connect><Stream>` cannot coexist with `<Record>` — recording must use REST API separately
- `persistConversation` must `updateMany` by `externalCallId` for inbound calls, not create a new record
- `scryptSync` dot separator (`.`) for Twilio tokens; colon separator (`:`) for systemConfig AES secrets — do not mix

### Phase 9 — Hardening — 2026-05-01

- [x] `TWILIO_ENFORCE_SIG=true` set in `/opt/myorbisvoice/.env.prod` — spoofed Twilio webhooks now hard-rejected with 403
- [x] Audit logging added: `auth.signup`, `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`
- [x] Audit logging added: `billing.checkout_completed`, `billing.invoice_paid`, `billing.subscription_updated`, `billing.subscription_canceled`
- [x] `db-backup` Docker service added to `docker-compose.prod.yml` — runs `pg_dump` every 24h, retains 30 days, volume `myorbisvoice_db_backups`
- [x] n8n double-locked: Caddy `basic_auth` layer added to `Caddyfile` + n8n's own auth (both required)
- [x] Disaster backup taken: `backups/disaster-20260501/` — local DB, prod DB, env.prod, n8n exports, manifest
- [x] Git tag: `disaster-backup-20260501` — aligns with snapshot `db_20260501_044937_hardening-complete.dump`
- [x] Stale files removed: `client_secret_*.json`, `plan.md`, `WORKING_STATE.md`, `docker-compose.yml` (root), `infrustructure/` (typo duplicate)

**⚠️ PENDING — Do this next session:**
- [ ] Re-download the Google OAuth client secret JSON from Google Cloud Console and store it securely off-repo (1Password / Bitwarden). The file `client_secret_548023119687-734aljh9786uh1k85kv0506coob25rje.apps.googleusercontent.com.json` was deleted from the repo root as a security cleanup. The credentials are still live and stored in the DB — but the raw JSON file should be kept in a secure offline location in case the Google OAuth connection ever needs to be re-established from scratch. Get it from: Google Cloud Console → project `myorbisvoice` → APIs & Services → Credentials → OAuth 2.0 Client IDs → Download JSON.

**Known Deploy Pitfalls (additions):**
| Pitfall | What Happens | Fix |
|---|---|---|
| Bunny DE region wrong hostname | `ENOTFOUND de.storage.bunnycdn.com` | Frankfurt uses `storage.bunnycdn.com` (same as NY) |
| CDN URL without linked pull zone | Audio player shows 0:00/0:00 | Proxy audio via API storage endpoint instead |
| `closed=true` in `close()` before ws.close() | `onClose` never fires, summaries never generated | Remove `closed=true` from `close()` — let the ws event set it |
| Caddy bcrypt hash with `$` in .env.prod | Docker Compose expands `$2a` as variable | Hardcode hash directly in Caddyfile, don't use env var |

### Phase 1 notes
- Existing ports 5432 and 6379 are occupied by other projects (umoja-postgres, umoja-redis). Phase 1 reuses these services. The voiceautomation DB was created on umoja-postgres with its own user/role.
- Docker compose is set up for full-stack mode but dev workflow runs API/web natively via pnpm dev.
- To run the API: `pnpm --filter @voiceautomation/api dev` (from repo root)
- To run the web: `pnpm --filter @voiceautomation/web dev` (from repo root)
- AUTH_SECRET is in .env (generated, not committed)

## Credentials

> ⚠️ All keys below are production credentials. Never commit to a public repo. Store encrypted backups off-repo (1Password, Bitwarden, etc.).

---

### Hosting — Contabo Production Server
- **IP:** `147.93.183.4`
- **User:** `root`
- **Password:** `Orbis@8214@@!!` (fallback: `Orbis@8214`)
- **Docker network:** `myorbisvoice_net`
- **App domain:** `app.myorbisvoice.com`
- **API domain:** `api.myorbisvoice.com`
- **n8n domain:** `n8n.myorbisvoice.com` (internal only)

---

### Database — PostgreSQL (shared umoja-postgres container)
- **Host:** `localhost:5432` (container: `umoja-postgres`)
- **Database:** `voiceautomation`
- **User:** `voiceautomation`
- **Password:** `voiceautomation`
- **Connection string:** `postgresql://voiceautomation:voiceautomation@localhost:5432/voiceautomation`

---

### Auth
- **AUTH_SECRET:** *(stored in .env.prod on server — do not put here)*
- **N8N_ENCRYPTION_KEY:** *(stored in .env.prod on server — do not put here)*

---

### OpenAI
- **API Key:** *(enter via Admin → System Settings → OpenAI card — never store here)*
- **Default model:** `gpt-4o-mini`
- **Used for:** call summaries, agent reasoning, campaign assistance, email enrichment
- **Enter via:** Admin → System Settings → OpenAI card (stored encrypted in DB)

---

### Google OAuth (myorbisvoice project)
- **Project ID:** `myorbisvoice`
- **Client ID:** `548023119687-734aljh9786uh1k85kv0506coob25rje.apps.googleusercontent.com`
- **Client Secret:** *(enter via Admin → System Settings → Google OAuth card — never store here)*
- **Auth URI:** `https://accounts.google.com/o/oauth2/auth`
- **Token URI:** `https://oauth2.googleapis.com/token`
- **Correct Redirect URI:** `https://api.myorbisvoice.com/api/integrations/google/callback`
- **Enter via:** Admin → System Settings → Google OAuth card

> ⚠️ The downloaded JSON has `redirect_uris: ["https://app.myorbisvoice.com/"]` — this is wrong.
> The authorised redirect URI in Google Cloud Console must be set to:
> `https://api.myorbisvoice.com/api/integrations/google/callback`

---

### Reoon Email Verifier
- **API Key:** *(enter via Admin → System Settings → Reoon card — never store here)*
- **Mode:** `power`
- **Enter via:** Admin → System Settings → Reoon card

---

### Bunny.net Storage & Streaming
- **API Key (short):** *(enter via Admin → System Settings → Bunny.net card — never store here)*
- **API Key (long/full):** *(enter via Admin → System Settings → Bunny.net card — never store here)*
- **Storage Zone:** `orbisvoice`
- **Storage Password:** *(stored encrypted in DB — retrieve from Admin → System Settings → Bunny.net card)*
- **CDN Hostname:** `OrbisVoice.b-cdn.net`
- **Storage Region:** `de` (Frankfurt — uses `storage.bunnycdn.com`, NOT `de.storage.bunnycdn.com`)
- **Enter via:** Admin → System Settings → Bunny.net card
- **⚠️ CDN pull zone must be linked to the `orbisvoice` storage zone in Bunny dashboard for CDN URLs to serve. Audio is proxied via the API storage endpoint to bypass this requirement.**

---

### Twilio
- **Account SID:** *(enter from Twilio console → Account → General Settings)*
- **Auth Token:** *(enter from Twilio console → Account → General Settings)*
- **Platform phone number:** *(enter after purchasing a number in Twilio)*
- **Inbound webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/voice`
- **Recording webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/recording`
- **SMS webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/sms`
- **Status callback URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/status`
- **Enter via:** Admin → System Settings → Twilio card

---

### Stripe
- **Secret Key:** *(enter from Stripe dashboard → Developers → API Keys)*
- **Publishable Key:** *(enter from Stripe dashboard → Developers → API Keys)*
- **Webhook Secret:** *(enter from Stripe dashboard → Developers → Webhooks → signing secret)*
- **Webhook endpoint to register:** `https://api.myorbisvoice.com/api/webhooks/stripe`
- **Enter via:** Admin → System Settings → Stripe card

### Stripe Products & Pricing

| Plan | Code | Price | Interval | DB key |
|---|---|---|---|---|
| LTD (Lifetime Deal) | `ltd` | $497 one-time | ONE_TIME | `STRIPE_PRICE_LTD` |
| Basic | `basic_monthly` | $197/month | MONTHLY | `STRIPE_PRICE_BASIC` |
| Pro | `pro_monthly` | $497/month | MONTHLY | `STRIPE_PRICE_PRO` |
| Premier | `premier_monthly` | $997/month | MONTHLY | `STRIPE_PRICE_PREMIER` |
| Enterprise | `enterprise_monthly` | $1,997/month | MONTHLY | `STRIPE_PRICE_ENTERPRISE` |

**LTD notes:** One-time payment, 100 units max. Create as a one-time price in Stripe (not recurring).
**Price IDs:** Once created in Stripe, update each plan's `stripePriceId` in the DB via seed or direct SQL.

---

### Gemini Live (Google AI)
- **API Key:** *(enter from Google AI Studio — aistudio.google.com → Get API Key)*
- **Model:** `gemini-2.5-flash-native-audio-latest` (or override via `GEMINI_LIVE_MODEL` env var)
- **Used for:** real-time voice sessions (inbound calls, widget)
- **Set via:** `.env` file — `GEMINI_API_KEY=` (not yet in admin UI)

---

### Brand Color Palette (Marketing Site)
Teal swatch — 6 shades light to deep:
- `#3dbcbc` — Teal 1 (lightest)
- `#2aabab` — Teal 2
- `#1a9898` — Teal 3 (primary accent)
- `#158484` — Teal 4
- `#0f7070` — Teal 5
- `#0a5c5c` — Teal 6 (darkest)

---

## Future Features Backlog

Items below are confirmed product requirements. Implement them in order of dependency and phase fit. Do not skip or reorder without reviewing the impact on tenant isolation, entitlement gating, and audit requirements.

---

### 1. Admin Full Tenant Access (Impersonation / Support Mode)

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

### 2. Agent Always Speaks First

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

### 3. Reduce Agent Response Latency

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

### 4. Conversations Page — Bulk Actions, Download, Search, Filters, Sort

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

### 5. Channel Availability Controlled by Tier — Admin-Configured

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

### 6. Tooltips Throughout the App

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

### 7. Full Help Section

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

### 8. Phone Usage Section

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

### 9. Finish Google Integration

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

### 10. Calendar Integrations — Coming Soon Placeholder

**What:** Future calendar integrations beyond Google (Outlook/Microsoft 365, Calendly, Cal.com) should be visible in the integrations page with a "Coming soon" state to set expectations.

**Requirements:**
- Integrations page shows cards for: Google Calendar (active), Outlook Calendar (coming soon), Calendly (coming soon), Cal.com (coming soon)
- Coming soon cards are visually distinct (muted, locked icon, "Coming soon" badge)
- Clicking a coming soon card shows a brief description of what the integration will do
- No backend work required for the placeholder cards

---

### 11. Logo Upload — Profile and Placeholders

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

### 12. New Conversation Notifications — Push, Desktop, In-App

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
