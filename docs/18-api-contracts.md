# API contracts

## Objective

This document defines the first-pass REST API surface for the app backend. The API owns configuration, status, orchestration triggers, and secure integration flows.

## General rules

1. All endpoints are tenant-scoped unless explicitly platform-scoped.
2. Admin endpoints must require platform roles.
3. Write endpoints must validate tenant entitlements.
4. Sensitive fields are redacted in response payloads.
5. Idempotency keys are required for critical create or trigger operations where duplicates are costly.

## Auth and session endpoints

### POST /api/auth/signup
Creates a user and tenant subscription intent.

Request:
- email
- password
- businessName
- selectedPlanCode
- affiliateCode optional

Response:
- user
- tenant
- nextStep

### POST /api/auth/login
Request:
- email
- password

Response:
- access token or session cookie
- current user profile
- accessible workspaces

### POST /api/auth/logout
Response:
- success

### GET /api/auth/me
Response:
- user profile
- role memberships
- current tenant context

## Tenant endpoints

### GET /api/tenants/current
Returns current tenant shell.

### PATCH /api/tenants/current
Updates tenant shell fields.

Fields:
- displayName
- legalName
- timezone
- publicEmail
- publicPhone
- website

## Business profile endpoints

### GET /api/business-profile
### PATCH /api/business-profile

Editable fields:
- brandName
- logoUrl
- address fields
- serviceAreasJson
- businessHoursJson
- fallbackNotificationEmail

## Business DNA endpoints

### GET /api/business-dna
Returns active Business DNA version.

### POST /api/business-dna
Creates a new draft version.

### PATCH /api/business-dna/:id
Updates a draft version.

### POST /api/business-dna/:id/publish
Publishes a version.

## Prompt endpoints

### GET /api/prompts
Filters:
- scope
- channelType
- agentRoleType
- status

### POST /api/prompts
Creates a prompt version.

### PATCH /api/prompts/:id
Updates draft prompt version.

### POST /api/prompts/:id/publish
Publishes prompt version.

### POST /api/prompts/test
Runs a prompt test scenario.

Request:
- promptId
- sampleInput
- channelType optional
- agentRoleType optional

## Agent endpoints

### GET /api/agents
### PATCH /api/agents/:roleType
Fields:
- displayName
- isEnabled
- modelProvider
- modelName
- promptVersionId
- settingsJson

## Channel endpoints

### GET /api/channels
### PATCH /api/channels/:channelType
Fields:
- isEnabled
- greetingMode
- afterHoursMode
- escalationMode
- configJson
- promptVersionId

## Integration endpoints

### GET /api/integrations
Returns integration statuses only.

### POST /api/integrations/google/start
Creates OAuth start URL.

### GET /api/integrations/google/callback
Handles OAuth callback.

### POST /api/integrations/google/reconnect
Re-runs connection flow.

### POST /api/integrations/twilio
Creates or updates Twilio linkage.

### POST /api/integrations/twilio/validate
Validates Twilio credentials.

### POST /api/integrations/transactional-email
Registers sender config metadata.

## Booking endpoints

### POST /api/appointments/availability/search
Request:
- appointmentType
- preferredStartRange
- timezone
- durationMinutes

Response:
- available slots
- alternate slots

### POST /api/appointments
Creates appointment.

### PATCH /api/appointments/:id/reschedule
### PATCH /api/appointments/:id/cancel

## Contacts and conversations

### GET /api/contacts
### POST /api/contacts
### PATCH /api/contacts/:id

### GET /api/conversations
### GET /api/conversations/:id

### GET /api/message-logs
### GET /api/call-logs

## Outbound campaign endpoints

### GET /api/outbound-campaigns
### POST /api/outbound-campaigns
### PATCH /api/outbound-campaigns/:id
### POST /api/outbound-campaigns/:id/schedule
### POST /api/outbound-campaigns/:id/pause

## Billing and entitlements

### GET /api/billing/subscription
### POST /api/billing/checkout-session
### POST /api/billing/portal-session
### GET /api/entitlements

## Affiliate endpoints

### GET /api/affiliate/me
### PATCH /api/affiliate/me
### GET /api/affiliate/links
### POST /api/affiliate/links
### GET /api/affiliate/commissions
### GET /api/affiliate/payouts

## Admin endpoints

### GET /api/admin/tenants
### GET /api/admin/tenants/:tenantId
### PATCH /api/admin/tenants/:tenantId
### POST /api/admin/tenants/:tenantId/impersonate
### POST /api/admin/tenants/:tenantId/suspend
### POST /api/admin/tenants/:tenantId/restore
### POST /api/admin/tenants/:tenantId/entitlements
### POST /api/admin/tenants/:tenantId/reconnect/google
### POST /api/admin/tenants/:tenantId/reconnect/twilio

## Webhook endpoints

### POST /api/webhooks/stripe
### POST /api/webhooks/twilio/voice
### POST /api/webhooks/twilio/status
### POST /api/webhooks/twilio/sms
### POST /api/webhooks/transactional-email/events

## Response model guidelines

Responses should include:
- data
- meta optional
- errors only on failure

Errors should include:
- code
- message
- fieldErrors optional
