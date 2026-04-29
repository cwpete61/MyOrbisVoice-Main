# RBAC matrix

## Objective

This document defines who can view, create, edit, publish, reconnect, approve, suspend, or delete records across the platform.

## Roles covered
- Platform Super Admin
- Platform Admin
- Tenant Owner
- Tenant Manager
- Tenant Staff
- Affiliate

## Permission legend
- VIEW
- CREATE
- EDIT
- DELETE
- PUBLISH
- RECONNECT
- APPROVE
- SUSPEND
- IMPERSONATE
- NONE

## Identity and account area

### User self profile
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant Owner: VIEW, EDIT
- Tenant Manager: VIEW, EDIT
- Tenant Staff: VIEW, EDIT
- Affiliate: VIEW, EDIT

### Tenant users within tenant
- Platform Super Admin: VIEW, CREATE, EDIT, DELETE, SUSPEND
- Platform Admin: VIEW, CREATE, EDIT, DELETE, SUSPEND
- Tenant Owner: VIEW, CREATE, EDIT, DELETE, SUSPEND
- Tenant Manager: VIEW, CREATE, EDIT, limited DELETE subject to policy
- Tenant Staff: VIEW
- Affiliate: NONE

## Workspace configuration

### Business profile
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant Owner: VIEW, EDIT
- Tenant Manager: VIEW, EDIT
- Tenant Staff: VIEW
- Affiliate: NONE

### Business DNA
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant Owner: VIEW, EDIT
- Tenant Manager: VIEW, EDIT
- Tenant Staff: VIEW
- Affiliate: NONE

### Master prompts and role prompts
- Platform Super Admin: VIEW, CREATE, EDIT, PUBLISH
- Platform Admin: VIEW, CREATE, EDIT, PUBLISH
- Tenant Owner: VIEW, CREATE, EDIT, PUBLISH
- Tenant Manager: VIEW, CREATE, EDIT
- Tenant Staff: VIEW
- Affiliate: NONE

### Channel configuration
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant Owner: VIEW, EDIT
- Tenant Manager: VIEW, EDIT
- Tenant Staff: VIEW
- Affiliate: NONE

## Integrations

### Google connection status
- Platform Super Admin: VIEW, RECONNECT
- Platform Admin: VIEW, RECONNECT
- Tenant Owner: VIEW, RECONNECT
- Tenant Manager: VIEW, RECONNECT if granted
- Tenant Staff: VIEW
- Affiliate: NONE

### Google connection secret values
- all roles: NONE for reveal
- authorized roles may rotate or replace only

### Twilio connection status
- Platform Super Admin: VIEW, RECONNECT, EDIT
- Platform Admin: VIEW, RECONNECT, EDIT
- Tenant Owner: VIEW, RECONNECT, EDIT
- Tenant Manager: VIEW, RECONNECT if granted
- Tenant Staff: VIEW
- Affiliate: NONE

### Stripe billing portal and plan state
- Platform Super Admin: VIEW, EDIT, APPROVE override
- Platform Admin: VIEW, EDIT limited by policy
- Tenant Owner: VIEW, EDIT own billing profile where allowed
- Tenant Manager: VIEW limited
- Tenant Staff: VIEW limited or NONE
- Affiliate: NONE

## Operations

### Conversations, call logs, message logs
- Platform Super Admin: VIEW
- Platform Admin: VIEW
- Tenant Owner: VIEW
- Tenant Manager: VIEW
- Tenant Staff: VIEW limited by workspace policy
- Affiliate: NONE

### Appointments
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant Owner: VIEW, EDIT
- Tenant Manager: VIEW, EDIT
- Tenant Staff: VIEW, EDIT limited if assigned
- Affiliate: NONE

### Contacts and leads
- Platform Super Admin: VIEW, CREATE, EDIT
- Platform Admin: VIEW, CREATE, EDIT
- Tenant Owner: VIEW, CREATE, EDIT
- Tenant Manager: VIEW, CREATE, EDIT
- Tenant Staff: VIEW, CREATE, EDIT limited by policy
- Affiliate: NONE

## Admin powers

### Tenant suspension
- Platform Super Admin: SUSPEND
- Platform Admin: SUSPEND if allowed
- Tenant Owner: NONE
- Tenant Manager: NONE
- Tenant Staff: NONE
- Affiliate: NONE

### Plan and entitlement override
- Platform Super Admin: EDIT, APPROVE
- Platform Admin: EDIT if allowed
- Tenant roles: NONE
- Affiliate: NONE

### Tenant impersonation
- Platform Super Admin: IMPERSONATE
- Platform Admin: IMPERSONATE if allowed
- Tenant roles: NONE
- Affiliate: NONE

### Secret rotation
- Platform Super Admin: EDIT, RECONNECT
- Platform Admin: EDIT, RECONNECT
- Tenant Owner: EDIT, RECONNECT own tenant integrations
- Tenant Manager: RECONNECT if allowed
- Tenant Staff: NONE
- Affiliate: NONE

## Affiliate area

### Affiliate account self-management
- Platform Super Admin: VIEW, EDIT
- Platform Admin: VIEW, EDIT
- Tenant roles: NONE
- Affiliate: VIEW, EDIT own account

### Commission ledger
- Platform Super Admin: VIEW, APPROVE, EDIT
- Platform Admin: VIEW, APPROVE if allowed
- Tenant roles: NONE
- Affiliate: VIEW own records only

### Payout execution status
- Platform Super Admin: VIEW, APPROVE
- Platform Admin: VIEW, APPROVE if allowed
- Tenant roles: NONE
- Affiliate: VIEW own status only

## RBAC rules

1. Admin visibility does not imply secret reveal capability.
2. Publishing prompts should be narrower than drafting prompts if needed later.
3. Impersonation must always create audit records.
4. Tenant cross-access is never allowed.
