# System architecture

VoiceAutomation is a three-layer platform:

## Layer 1 — Customer application

The customer application lives at `app.myorbisvoice.com`.

It provides:

- signup and login
- subscription management
- tenant profile management
- Business DNA configuration
- master prompt editor
- channel configuration
- feature toggle visibility by plan
- Twilio and Google connection status
- reporting and logs
- affiliate dashboard
- admin impersonation support

## Layer 2 — Core backend and voice services

This layer runs on Contabo in Docker.

It provides:

- backend API
- auth and RBAC
- tenant management
- usage metering
- secret storage references
- Google OAuth handling
- Stripe webhook handling
- Twilio webhook handling
- real-time voice gateway
- task dispatch to n8n

## Layer 3 — Workflow orchestration

This layer runs through n8n.

It provides:

- tenant provisioning workflows
- billing lifecycle workflows
- appointment workflows
- SMS and email reminder workflows
- lead capture workflows
- outbound campaign orchestration
- affiliate event workflows
- maintenance and recovery workflows

## Primary system components

### Marketing site
- host: Spaceship
- domain: `myorbisvoice.com`
- purpose: public website, landing pages, affiliate marketing pages, docs pages if desired

### SaaS app
- host: Contabo
- domain: `app.myorbisvoice.com`
- purpose: customer and admin application

### n8n engine
- host: Contabo
- domain: `n8n.myorbisvoice.com`
- purpose: internal workflow engine only

### Voice gateway
- host: Contabo
- internal service
- purpose: real-time audio session management, Twilio call handling, Gemini Live session coordination

### Database
- PostgreSQL
- purpose: primary relational system of record

### Cache and queue
- Redis
- purpose: queue support, session caching, lightweight state, rate limiting

## Design rules

1. Customers never access raw n8n.
2. Admins manage tenants through the app, not through direct database edits.
3. Real-time voice does not run inside n8n.
4. All tenant configuration is owned by the SaaS app.
5. All secrets are encrypted and write-only in the UI.
6. Transactional app email is separated from standard company mailboxes.
