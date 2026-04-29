# n8n workflow inventory

## Channel orchestrators

### WF-001 Widget orchestrator
Purpose:
- coordinate post-session events from website widget interactions

### WF-002 Inbound receptionist orchestrator
Purpose:
- coordinate inbound-call outcomes, summaries, transfers, appointments, and notifications

### WF-003 Outbound caller orchestrator
Purpose:
- coordinate campaign execution outcomes and follow-up actions

## Support workflows

### WF-010 Tenant provisioning
Creates default records, prompt templates, and starter configuration.

### WF-011 Billing lifecycle
Responds to subscription events, plan changes, failed payments, grace periods, and suspensions.

### WF-012 Entitlement sync
Updates tenant features and quotas after billing or admin changes.

### WF-013 Google connection validation
Checks mailbox and calendar connection health.

### WF-014 Appointment booking
Handles booking creation, reschedules, alternates, and confirmation dispatch.

### WF-015 Appointment reminders
Sends reminders by email and optional SMS.

### WF-016 SMS follow-up
Sends configured post-call or post-booking SMS messages.

### WF-017 Email confirmation
Sends booking, summary, or workflow-triggered email sequences.

### WF-018 Lead capture and routing
Creates or updates contact records and routes leads to the right queue.

### WF-019 Human handoff
Handles staff notification, call-forward events, and escalation tasks.

### WF-020 Twilio number provisioning sync
Tracks number assignment, release, and routing status.

### WF-021 Outbound campaign preparation
Builds call job batches.

### WF-022 Outbound retry and follow-up
Retries according to campaign rules and sends follow-up actions.

### WF-023 Affiliate attribution
Records affiliate click and conversion events.

### WF-024 Affiliate commission ledger
Calculates commission entries and payout eligibility.

### WF-025 Usage metering
Aggregates minutes, messages, bookings, and usage thresholds.

### WF-026 Error replay and dead-letter recovery
Handles failed events, replay queues, and operator alerts.

### WF-027 Daily operational digest
Sends admin or tenant summary reports.

## Workflow rules

1. Keep workflows modular.
2. Avoid giant all-in-one workflows.
3. Write tenant-safe inputs into every workflow.
4. Make workflows idempotent where possible.
5. Log workflow execution references into the app database.
