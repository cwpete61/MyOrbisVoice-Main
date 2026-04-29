# CLAUDE.md

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

### Automation engine
- host: Contabo
- domain: `n8n.myorbisvoice.com`
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
