# VoiceAutomation SaaS

VoiceAutomation SaaS is a multi-tenant voice automation platform for businesses with three primary channels:

1. Website widget
2. Inbound receptionist
3. Outbound caller

The system uses:

- a customer-facing SaaS app at `app.myorbisvoice.com`
- an internal n8n engine at `n8n.myorbisvoice.com`
- a marketing site at `myorbisvoice.com`
- production hosting on Contabo for the app stack
- marketing hosting on Spaceship
- PostgreSQL as the system of record
- Redis for cache and queue support
- Docker-based local and production environments
- Stripe for subscriptions and billing
- Twilio for telephony and SMS
- Google OAuth for Gmail and Google Calendar connectivity
- Gemini Live for real-time voice
- OpenAI `gpt-4o-mini` for role-driven agent reasoning and tool routing

## Goal of this doc set

This pack defines:

- infrastructure topology
- communications architecture
- DNS and subdomain routing
- mailbox and transactional email separation
- RBAC and admin authority
- customer onboarding and Business DNA capture
- secrets and OAuth rules
- workflow inventory for n8n
- implementation phases

## Core principle

n8n is the orchestration engine, not the customer interface and not the real-time voice runtime.

The customer interacts with the SaaS UI. The SaaS UI writes configuration to the app backend. The backend coordinates with n8n, Twilio, Google, Stripe, and the real-time voice gateway.
