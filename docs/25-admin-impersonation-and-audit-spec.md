# Admin impersonation and audit spec

## Objective

This document defines how platform admins enter tenant accounts for support and maintenance while preserving accountability.

## Impersonation goals

Admins need to:
- inspect tenant configuration
- correct broken setup
- reconnect integrations
- test tenant-specific views
- resolve onboarding issues

## Allowed impersonation roles
- Platform Super Admin
- Platform Admin only if policy allows

## Start impersonation flow

1. admin selects tenant
2. admin clicks impersonate
3. system validates permission
4. system creates impersonation session record
5. UI shows persistent impersonation banner
6. all actions during impersonation are stamped accordingly

## Session fields
- impersonationSessionId
- adminUserId
- tenantId
- assumedRoleKey
- startedAt
- endedAt optional
- reasonCode optional
- notes optional

## UI rules

During impersonation, UI must show:
- clear banner
- tenant identity
- acting admin identity
- exit impersonation action

## Audit event requirements

Audit event categories:
- impersonation_started
- impersonation_ended
- prompt_published
- business_dna_published
- integration_reconnect_started
- integration_reconnect_completed
- entitlement_override_applied
- tenant_suspended
- tenant_restored
- secret_rotated

Each audit event should include:
- event id
- tenantId optional
- actor type
- actor user id optional
- impersonation session id optional
- action
- target type
- target id optional
- metadata
- createdAt

## Logging rules

1. Never allow silent impersonation.
2. Every impersonated write must include impersonationSessionId.
3. High-risk admin actions should require reason entry if desired.
4. Keep audit logs immutable at the application level.

## Search and export

Admin audit interface should support:
- filter by tenant
- filter by actor
- filter by action
- date range filter
- export for incident review

## Retention

Audit retention should be long enough for operational and billing disputes.

## Minimum controls

- server-side authorization check before impersonation
- signed session state
- forced banner display in UI
- auto-end on logout or timeout
