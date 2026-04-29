# Widget session state

## Objective

This document defines the browser widget session lifecycle, runtime state, and persistence requirements.

## Session goals

The widget must:
- start quickly
- inject the correct tenant context
- select the correct prompt stack
- support real-time voice
- survive transient failures where possible
- write summary and outcomes back to the app

## Session phases

### Phase 1 — Bootstrap
Client loads widget script and receives tenant widget config.

Required config:
- tenantId
- channel enabled state
- widget theme and brand config
- allowed hours behavior
- initial greeting mode
- auth token or ephemeral session initiation token

### Phase 2 — Session creation
The browser requests a session from the app.

App returns:
- sessionId
- traceId
- effective agent role
- prompt bundle reference or resolved prompt content
- Business DNA snapshot reference
- ephemeral voice token if applicable
- allowed tool list

### Phase 3 — Live conversation
Runtime tracks:
- current transcript fragments
- current speaker state
- interruption state
- active tool request state
- silence timer state
- escalation candidate flags
- booking intent flags

### Phase 4 — Tool execution
When a tool action is required:
1. live model or orchestrator requests action
2. backend validates entitlement and authorization
3. backend executes action or dispatches workflow
4. result is returned to session

### Phase 5 — Completion
When session ends:
- finalize transcript
- generate summary
- store conversation outcome
- enqueue follow-up workflows if needed

## Session state model

### Persistent state
Store in database:
- sessionId
- tenantId
- contactId optional
- conversationId
- status
- startedAt
- endedAt optional
- summary
- transcript reference
- outcome code
- outcome metadata

### Ephemeral state
Store in Redis or in-memory runtime:
- live connection handle
- current turn buffer
- partial transcript fragments
- active timers
- current prompt resolution
- current tool-call status
- escalation lock

## Required state fields

- sessionId
- traceId
- tenantId
- channelType = WIDGET
- agentRoleType
- contactHint optional
- locale optional
- timezone
- allowBooking boolean
- allowSms boolean
- allowEscalation boolean
- businessHoursState
- startedAt

## Failure handling

If live connection fails:
- mark reason
- attempt allowed reconnect if within short window
- preserve partial transcript where possible
- record session failure code

## Security rules

1. Never expose long-lived provider secrets to the browser.
2. Use short-lived session tokens only.
3. Validate widget origin if tenant domains are restricted.
4. Bind session creation to enabled tenant state.
