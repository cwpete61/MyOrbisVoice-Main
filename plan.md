# plan.md

## Project
VoiceAutomation SaaS is a multi-tenant voice automation platform with three primary channels:

1. Website widget
2. Inbound receptionist
3. Outbound caller

## Core architecture
- `myorbisvoice.com` = marketing site on Spaceship
- `app.myorbisvoice.com` = customer/admin SaaS app on Contabo
- `n8n.myorbisvoice.com` = internal n8n engine on Contabo
- PostgreSQL = source of truth
- Redis = queue support, cache, session state
- Twilio = inbound, outbound, forwarding, SMS
- Google OAuth = Gmail and Calendar connectivity
- Gemini Live = live voice sessions
- OpenAI `gpt-4o-mini` = reasoning, orchestration, role behavior

## Non-negotiable boundaries
1. The app owns configuration.
2. The voice gateway owns live sessions.
3. n8n owns orchestration.
4. Customers never access raw n8n.
5. Transactional email stays separate from human mailbox email.
6. Gmail uses OAuth as the standard model.
7. Secrets are write-only in the UI.
8. Admins can control accounts without seeing plaintext secrets.

## Immediate coding targets
1. Prisma schema and migration baseline
2. Auth and RBAC foundation
3. Tenant shell and workspace settings APIs
4. Business DNA and prompt versioning
5. Google OAuth connection flow
6. Stripe subscription normalization and entitlements
7. Admin impersonation and audit logging
8. Docker and local dev scaffold

## Repo structure
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
/prisma
  schema.prisma
/infrastructure
  /proxy
  /docker
  /scripts
/n8n
  /workflow-specs
/docs
CLAUDE.md
plan.md
docker-compose.yml
.env.example
```

## Phase plan

### Phase 1 — Foundation
Build:
- monorepo scaffold
- PostgreSQL and Redis services
- reverse proxy
- auth shell
- RBAC primitives
- Prisma client bootstrap

Exit gate:
- stack boots locally
- health endpoints respond
- auth shell works
- tenant isolation primitives exist

### Phase 2 — Tenant configuration core
Build:
- workspace settings
- profile manager
- Business DNA editor
- prompt editor
- agent configuration
- channel configuration

Exit gate:
- tenant can create and save core configuration
- admin can inspect and edit tenant configuration
- prompt and Business DNA versioning works

### Phase 3 — Billing and entitlements
Build:
- Stripe checkout
- subscription lifecycle handlers
- plan model
- entitlement engine
- quota views

Exit gate:
- plan purchase updates effective entitlements
- quota reads reflect tenant state

### Phase 4 — Google integration and booking
Build:
- Google OAuth
- Gmail and Calendar connection state
- appointment availability logic
- booking create/reschedule/cancel
- confirmation email trigger

Exit gate:
- mailbox connects
- calendar connects
- appointment flow works end to end

### Phase 5 — Widget MVP
Build:
- widget bootstrap
- session creation
- Gemini Live bridge
- role and prompt resolution
- transcript and summary persistence

Exit gate:
- widget can handle a live test conversation
- session summary and transcript save correctly

### Phase 6 — Inbound receptionist
Build:
- Twilio inbound webhook
- call routing and after-hours logic
- booking and escalation flow
- forwarding and voicemail logic

Exit gate:
- inbound number can answer, route, and book

### Phase 7 — Outbound caller
Build:
- campaign model
- audience selection/import
- Twilio outbound flow
- retry and follow-up rules
- outcome logging

Exit gate:
- outbound calls can run and store outcomes

### Phase 8 — Affiliate portal
Build:
- affiliate signup and profile
- referral codes and links
- click attribution
- conversion ledger
- commission status and payouts

Exit gate:
- affiliate activity is visible end to end

### Phase 9 — Hardening
Build:
- audit review UI
- admin impersonation workflow
- secret rotation UX
- monitoring and alerting
- backup and restore plan
- replay/recovery flows

Exit gate:
- platform is operationally supportable
- critical security controls are in place

## Manual verification at every phase
- auth
- tenant isolation
- admin permissions
- write-only secrets
- Stripe state transitions
- Google connection health
- widget runtime
- inbound call runtime
- outbound call runtime
- audit records
