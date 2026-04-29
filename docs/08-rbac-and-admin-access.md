# RBAC and admin access

## Roles

### Platform Super Admin
Can:
- access all tenants
- impersonate any tenant user
- edit all tenant settings
- edit prompts
- reconnect integrations
- toggle entitlements
- suspend tenants
- inspect logs and transcripts
- manage affiliates
- manage billing overrides
- run maintenance actions

### Platform Admin
Can:
- manage tenants
- edit configurations
- review logs
- assist onboarding
- trigger reconnects
- not necessarily manage top-level billing policies unless granted

### Tenant Owner
Can:
- manage their workspace
- manage users in their workspace
- update business profile
- update Business DNA
- edit prompts
- configure channels
- view reports
- manage billing details allowed by plan

### Tenant Manager
Can:
- edit approved operational settings
- review logs
- manage appointments and channel settings
- limited billing view depending on configuration

### Tenant Staff
Can:
- view operational dashboards
- review call outcomes
- limited settings access

### Affiliate
Can:
- view referral dashboard
- view clicks, conversions, commissions, payout history
- manage referral links and payout details

## Admin secret access rules

Admins must have full operational control without direct exposure to plaintext secrets.

Admins may:
- replace secrets
- revoke secrets
- trigger reconnect flows
- inspect secret status

Admins may not:
- reveal plaintext Gmail passwords
- reveal plaintext OAuth refresh tokens
- reveal plaintext Twilio auth tokens
- reveal plaintext Stripe secret keys

## Impersonation rules

Admin impersonation must:
- be logged
- show active impersonation banner
- write audit records
- support exit back to admin identity
