# Prisma schema spec

## Objective

This document defines the target relational model for the VoiceAutomation SaaS application. The Prisma schema must treat the application database as the source of truth for tenants, plans, entitlements, prompts, channels, integrations, billing references, affiliate tracking, and audit history.

## Design principles

1. Use UUID primary keys for application-owned records.
2. Use explicit foreign keys.
3. Use created and updated timestamps on all mutable records.
4. Use soft deletion only where business recovery is useful.
5. Store external provider IDs separately from internal IDs.
6. Keep secrets out of normal relational content tables.
7. Version prompts instead of mutating them without history.
8. Model effective entitlements separately from plan definitions.

## Core enums

### UserStatus
- ACTIVE
- INVITED
- SUSPENDED
- DISABLED

### TenantStatus
- TRIAL
- ACTIVE
- PAST_DUE
- SUSPENDED
- CANCELED
- ARCHIVED

### PlanInterval
- MONTHLY
- YEARLY

### PromptScope
- PLATFORM
- TENANT
- CHANNEL
- ROLE
- CAMPAIGN

### PromptStatus
- DRAFT
- PUBLISHED
- ARCHIVED

### ChannelType
- WIDGET
- INBOUND
- OUTBOUND

### AgentRoleType
- ORCHESTRATOR
- APPOINTMENT
- SALES
- CUSTOMER_SERVICE
- MARKETING
- ASSISTANT
- SECRETARY

### IntegrationProvider
- GOOGLE
- TWILIO
- STRIPE
- TRANSACTIONAL_EMAIL

### IntegrationStatus
- NOT_CONNECTED
- CONNECTED
- ERROR
- RECONNECT_REQUIRED
- DISABLED

### ConversationDirection
- INBOUND
- OUTBOUND
- WIDGET

### ConversationStatus
- OPEN
- COMPLETED
- FAILED
- ESCALATED
- ABANDONED

### AppointmentStatus
- PENDING
- CONFIRMED
- RESCHEDULED
- CANCELED
- FAILED

### MessageChannel
- EMAIL
- SMS
- VOICE

### AffiliateStatus
- PENDING
- ACTIVE
- PAUSED
- DISABLED

### CommissionStatus
- PENDING
- APPROVED
- HOLD
- PAID
- REVERSED

### AuditActorType
- USER
- ADMIN
- SYSTEM
- WORKFLOW

### SecretOwnerType
- PLATFORM
- TENANT
- USER
- INTEGRATION

### EntitlementValueType
- BOOLEAN
- INTEGER
- STRING

## Core models

### User
Fields:
- id
- email
- passwordHash
- firstName
- lastName
- status
- lastLoginAt
- createdAt
- updatedAt

Relations:
- tenant memberships
- audit log actor references
- affiliate account optional

Constraints:
- unique email

### Tenant
Fields:
- id
- slug
- displayName
- legalName optional
- status
- timezone
- registrationEmail
- publicEmail optional
- publicPhone optional
- website optional
- createdAt
- updatedAt
- deletedAt optional

Relations:
- members
- business profile
- Business DNA
- prompt versions
- channels
- agents
- integrations
- subscriptions
- contacts
- conversations
- appointments
- phone numbers
- audit logs
- entitlement assignments
- workflows
- affiliate conversions

Constraints:
- unique slug

### TenantMember
Fields:
- id
- tenantId
- userId
- roleKey
- isOwner
- createdAt
- updatedAt

Constraints:
- unique tenantId + userId

### RoleDefinition
Fields:
- id
- key
- name
- description
- isPlatformRole
- createdAt
- updatedAt

Examples:
- PLATFORM_SUPER_ADMIN
- PLATFORM_ADMIN
- TENANT_OWNER
- TENANT_MANAGER
- TENANT_STAFF
- AFFILIATE

### Plan
Fields:
- id
- code
- name
- description
- interval
- stripePriceId optional
- isActive
- createdAt
- updatedAt

### PlanEntitlement
Fields:
- id
- planId
- key
- valueType
- booleanValue optional
- integerValue optional
- stringValue optional
- createdAt
- updatedAt

Constraint:
- unique planId + key

### TenantEntitlement
Fields:
- id
- tenantId
- key
- valueType
- booleanValue optional
- integerValue optional
- stringValue optional
- sourceType
- sourceRef optional
- createdAt
- updatedAt

Constraint:
- unique tenantId + key

### BusinessProfile
Fields:
- id
- tenantId
- brandName
- logoUrl optional
- addressLine1 optional
- addressLine2 optional
- city optional
- region optional
- postalCode optional
- country optional
- serviceAreasJson optional
- businessHoursJson optional
- fallbackNotificationEmail optional
- createdAt
- updatedAt

Constraint:
- unique tenantId

### BusinessDNA
Fields:
- id
- tenantId
- identityJson
- servicesJson
- pricingJson
- operationsJson
- salesJson
- appointmentJson
- supportJson
- languageJson
- complianceJson
- version
- isActive
- createdAt
- updatedAt

Notes:
- Keep structured JSON blocks for flexibility.
- Version Business DNA snapshots.

### PromptVersion
Fields:
- id
- tenantId optional
- scope
- channelType optional
- agentRoleType optional
- name
- content
- status
- versionNumber
- parentPromptId optional
- createdByUserId optional
- publishedAt optional
- createdAt
- updatedAt

Indexes:
- tenantId + scope
- tenantId + status

### AgentProfile
Fields:
- id
- tenantId
- agentRoleType
- displayName
- isEnabled
- modelProvider
- modelName
- promptVersionId optional
- settingsJson
- createdAt
- updatedAt

Constraint:
- unique tenantId + agentRoleType

### ChannelConfig
Fields:
- id
- tenantId
- channelType
- isEnabled
- greetingMode
- afterHoursMode
- escalationMode
- configJson
- promptVersionId optional
- createdAt
- updatedAt

Constraint:
- unique tenantId + channelType

### IntegrationConnection
Fields:
- id
- tenantId optional
- provider
- status
- label
- externalAccountId optional
- externalEmail optional
- metadataJson optional
- lastVerifiedAt optional
- reconnectRequiredAt optional
- createdAt
- updatedAt

Use cases:
- Google mailbox
- Google Calendar
- Twilio account
- transactional sender references

### GoogleConnectionDetail
Fields:
- id
- integrationConnectionId
- mailboxEmail
- grantedScopesJson
- calendarIdsJson optional
- tokenExpiresAt optional
- createdAt
- updatedAt

Constraint:
- unique integrationConnectionId

### TwilioConnectionDetail
Fields:
- id
- integrationConnectionId
- accountSid
- messagingServiceSid optional
- createdAt
- updatedAt

Constraint:
- unique integrationConnectionId

### StripeCustomerRef
Fields:
- id
- tenantId
- stripeCustomerId
- createdAt
- updatedAt

Constraint:
- unique tenantId
- unique stripeCustomerId

### Subscription
Fields:
- id
- tenantId
- planId
- stripeSubscriptionId optional
- status
- currentPeriodStart optional
- currentPeriodEnd optional
- cancelAtPeriodEnd
- canceledAt optional
- createdAt
- updatedAt

### PhoneNumber
Fields:
- id
- tenantId
- twilioNumberSid optional
- e164Number
- displayLabel optional
- isInboundEnabled
- isOutboundEnabled
- isSmsEnabled
- forwardingTarget optional
- createdAt
- updatedAt

Constraint:
- unique e164Number

### Contact
Fields:
- id
- tenantId
- firstName optional
- lastName optional
- fullName optional
- email optional
- phoneE164 optional
- source
- tagsJson optional
- metadataJson optional
- createdAt
- updatedAt

Indexes:
- tenantId + email
- tenantId + phoneE164

### Conversation
Fields:
- id
- tenantId
- contactId optional
- channelType
- direction
- status
- startedAt
- endedAt optional
- summaryText optional
- transcriptRef optional
- outcomeCode optional
- outcomeJson optional
- externalCallId optional
- createdAt
- updatedAt

Indexes:
- tenantId + startedAt
- tenantId + channelType
- externalCallId

### Appointment
Fields:
- id
- tenantId
- contactId optional
- conversationId optional
- status
- appointmentType optional
- startAt
- endAt
- timezone
- providerEventId optional
- location optional
- notes optional
- createdAt
- updatedAt

### MessageLog
Fields:
- id
- tenantId
- contactId optional
- conversationId optional
- channel
- direction
- sender
- recipient
- subject optional
- bodyRef optional
- providerMessageId optional
- deliveryStatus optional
- createdAt
- updatedAt

### WorkflowExecutionRef
Fields:
- id
- tenantId optional
- workflowCode
- executionRef
- status
- inputHash optional
- resultJson optional
- startedAt
- finishedAt optional
- createdAt
- updatedAt

### AffiliateAccount
Fields:
- id
- userId
- status
- referralCode
- payoutMethodJson optional
- taxProfileJson optional
- createdAt
- updatedAt

Constraints:
- unique userId
- unique referralCode

### AffiliateClick
Fields:
- id
- affiliateAccountId
- tenantId optional
- sessionId optional
- landingPath optional
- referrer optional
- ipHash optional
- userAgent optional
- createdAt

### AffiliateConversion
Fields:
- id
- affiliateAccountId
- tenantId
- subscriptionId optional
- conversionType
- conversionValue optional
- occurredAt
- createdAt
- updatedAt

### AffiliateCommission
Fields:
- id
- affiliateConversionId
- affiliateAccountId
- tenantId
- amountMinor
- currency
- status
- approvedAt optional
- paidAt optional
- payoutRef optional
- createdAt
- updatedAt

### AuditLog
Fields:
- id
- tenantId optional
- actorType
- actorUserId optional
- action
- targetType
- targetId optional
- metadataJson optional
- ipHash optional
- createdAt

Indexes:
- tenantId + createdAt
- actorUserId + createdAt
- action + createdAt

### SecretRef
Fields:
- id
- ownerType
- ownerId
- secretType
- label
- provider
- externalRef optional
- lastValidatedAt optional
- rotationStatus optional
- createdAt
- updatedAt

Constraint:
- ownerType + ownerId + secretType + label

## Suggested implementation notes

1. Keep provider credentials in a vault or encrypted store, not in normal text columns.
2. Use Prisma middleware or service-layer logic to stamp audit events.
3. Keep prompt publication logic transactional.
4. Avoid polymorphic confusion by using clear ownerType plus ownerId patterns only where necessary.
