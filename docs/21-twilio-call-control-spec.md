# Twilio call control spec

## Objective

This document defines the telephony control layer for inbound, outbound, forwarding, and SMS events.

## Twilio features in scope
- inbound calls
- outbound calls
- call status callbacks
- SMS sending and inbound SMS webhooks
- call forwarding
- after-hours routing
- voicemail fallback

## Inbound call flow

1. Twilio sends webhook to app voice endpoint.
2. App validates tenant number and active configuration.
3. App resolves channel rules and effective prompt stack.
4. Voice gateway or control layer returns instructions for live handling.
5. If human transfer is required, forwarding or dial action executes.
6. Call summary and result are posted back to app storage.

## Outbound call flow

1. Campaign or operator action requests outbound call.
2. App validates entitlement and call permissions.
3. App creates outbound attempt record.
4. Twilio places call.
5. Live session runs.
6. Status callbacks update final state.

## Call control states
- QUEUED
- RINGING
- IN_PROGRESS
- COMPLETED
- NO_ANSWER
- BUSY
- FAILED
- CANCELED
- FORWARDED
- VOICEMAIL

## Forwarding rules

Forwarding may depend on:
- business hours
- customer request
- escalation reason
- plan entitlement
- tenant-configured fallback number

Validation rules:
- forwarding target must be E.164 normalized
- forwarding can be blocked if entitlement disabled
- forwarding attempts must be logged

## SMS rules

SMS may be used for:
- booking confirmation
- reminder
- follow-up
- missed call response
- lead nurture

Required checks:
- tenant SMS entitlement
- tenant number supports messaging
- recipient phone present and normalized
- opt-out handling honored where applicable

## Webhook endpoints in scope
- voice inbound webhook
- voice status callback
- sms inbound webhook
- sms delivery callback if used

## Call record fields
Each call attempt should track:
- tenantId
- conversationId optional
- direction
- source number
- destination number
- Twilio call SID
- status
- start time
- end time
- duration seconds optional
- forwarded boolean
- forwarding target optional
- outcome code

## Operational rules

1. Treat Twilio webhooks as asynchronous truth updates.
2. Do not assume a call is final until callback confirms terminal state.
3. Keep raw Twilio identifiers for debugging and reconciliation.
4. Log transfer decisions and forwarding reasons.
