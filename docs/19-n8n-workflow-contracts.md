# n8n workflow contracts

## Objective

This document defines the application-to-workflow contract boundary. n8n must receive normalized inputs and emit normalized outputs or callbacks.

## Contract rules

1. Every workflow input includes tenantId.
2. Every workflow input includes traceId.
3. Every workflow input includes actor context where relevant.
4. Every workflow result writes execution metadata back to the app.
5. Workflows must be idempotent when the action can be retried.
6. The app never trusts workflow output blindly for authorization-sensitive decisions.

## Standard workflow envelope

### Input envelope
- workflowCode
- traceId
- tenantId
- triggeredBy
- triggeredAt
- payload

### Output envelope
- workflowCode
- traceId
- executionRef
- status
- result
- error optional
- completedAt

## Workflow contracts

### WF-010 Tenant provisioning
Input payload:
- tenantId
- selectedPlanCode
- ownerUserId
- starterTemplateCode optional

Output:
- createdDefaults
- missingRequirements
- execution summary

### WF-011 Billing lifecycle
Input payload:
- stripeEventType
- stripeCustomerId
- stripeSubscriptionId optional
- eventData

Output:
- billingState
- entitlementSyncTriggered boolean
- dunningAction optional

### WF-012 Entitlement sync
Input payload:
- tenantId
- sourceType
- sourceRef

Output:
- effectiveEntitlements
- changedKeys

### WF-013 Google connection validation
Input payload:
- tenantId
- integrationConnectionId

Output:
- connectionStatus
- verifiedScopes
- mailboxEmail
- reconnectRequired boolean

### WF-014 Appointment booking
Input payload:
- tenantId
- contactId optional
- conversationId optional
- appointmentType
- preferredSlot optional
- fallbackRules
- channelPreferences

Output:
- appointmentId optional
- providerEventId optional
- selectedSlot optional
- alternateSlots optional
- notificationsTriggered

### WF-015 Appointment reminders
Input payload:
- tenantId
- appointmentId
- scheduleType

Output:
- messageCount
- channelsUsed

### WF-016 SMS follow-up
Input payload:
- tenantId
- contactId
- triggerType
- templateCode or renderedContent

Output:
- providerMessageId
- deliveryAccepted

### WF-017 Email confirmation
Input payload:
- tenantId
- recipient
- templateCode
- templateVars
- replyTo optional

Output:
- providerMessageId
- accepted boolean

### WF-018 Lead capture and routing
Input payload:
- tenantId
- leadSource
- contactPayload
- routingRules

Output:
- contactId
- routeTarget
- notificationsTriggered

### WF-019 Human handoff
Input payload:
- tenantId
- conversationId
- escalationReason
- destinationType
- destinationValue

Output:
- handoffStatus
- destinationResolved
- notificationsTriggered

### WF-020 Twilio number provisioning sync
Input payload:
- tenantId
- action
- requestedCapabilities

Output:
- phoneNumberId optional
- twilioNumberSid optional
- provisioningStatus

### WF-021 Outbound campaign preparation
Input payload:
- tenantId
- campaignId
- audienceRules
- schedulingRules

Output:
- jobCount
- scheduledWindow

### WF-022 Outbound retry and follow-up
Input payload:
- tenantId
- campaignId
- callResultCode
- contactId

Output:
- retryScheduled boolean
- followUpTriggered boolean

### WF-023 Affiliate attribution
Input payload:
- affiliateCode
- tenantId optional
- sessionContext
- eventType

Output:
- affiliateAccountId optional
- attributionApplied boolean

### WF-024 Affiliate commission ledger
Input payload:
- affiliateConversionId

Output:
- commissionId optional
- amountMinor
- status

### WF-025 Usage metering
Input payload:
- tenantId
- aggregationWindow

Output:
- usageSummary
- thresholdAlerts optional

### WF-026 Error replay and dead-letter recovery
Input payload:
- failedExecutionRef
- replayMode

Output:
- replayResult
- newExecutionRef optional

### WF-027 Daily operational digest
Input payload:
- tenantId optional
- audienceType
- periodStart
- periodEnd

Output:
- generated boolean
- deliveryTargets

## Callback contract back to app

If workflows call back into the app, they must send:
- workflowCode
- executionRef
- traceId
- tenantId optional
- status
- result or error
- signature or internal auth token
