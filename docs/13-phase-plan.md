# Phase plan

## Phase 1 — Foundation
Build:
- repo structure
- local Docker stack
- reverse proxy
- PostgreSQL
- Redis
- app skeleton
- auth skeleton
- RBAC skeleton

Exit criteria:
- local services run cleanly
- signup and login work
- admin and tenant roles exist

## Phase 2 — Tenant configuration core
Build:
- workspace settings
- Business DNA editor
- master prompt editor
- agent configuration UI
- channel configuration UI

Exit criteria:
- tenant can complete a workspace profile
- admin can view and edit tenant configuration

## Phase 3 — Billing and entitlements
Build:
- Stripe integration
- plans
- entitlements engine
- quota display
- plan upgrade and downgrade flows

Exit criteria:
- plans control visible and effective features

## Phase 4 — Google integration and booking
Build:
- Google OAuth flow
- mailbox connection status
- calendar connection status
- appointment booking logic
- confirmation email flow

Exit criteria:
- tenant can connect mailbox and calendar
- test appointment can be created and confirmed

## Phase 5 — Widget voice MVP
Build:
- website widget
- voice gateway session flow
- Gemini Live integration
- role prompt injection
- conversation logging

Exit criteria:
- live widget session works with Business DNA and prompt stack

## Phase 6 — Inbound receptionist
Build:
- Twilio inbound webhook flow
- inbound call agent behavior
- transfer logic
- voicemail / after-hours logic

Exit criteria:
- inbound number can answer, book, escalate, or route

## Phase 7 — Outbound caller
Build:
- campaign builder
- contact import
- outbound call jobs
- retry rules
- result logging

Exit criteria:
- outbound campaigns can run with tracked outcomes

## Phase 8 — Affiliate portal
Build:
- affiliate signup
- referral links
- conversion tracking
- commission ledger
- payout tracking

Exit criteria:
- affiliate activity is tracked end to end

## Phase 9 — Hardening and operations
Build:
- audit logs
- secret rotation support
- monitoring
- backup and restore
- recovery workflows
- admin impersonation audit

Exit criteria:
- platform is operationally supportable
