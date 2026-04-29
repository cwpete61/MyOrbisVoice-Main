# Master prompt architecture

The master prompt system must be modular.

## Prompt stack

### Layer 1 — Platform system prompt
This defines global safety, output discipline, tool-use constraints, and platform behavior.

### Layer 2 — Tenant master prompt
This defines the business identity, tone, business facts, goals, and restrictions.

### Layer 3 — Channel overlay
This adapts behavior for:
- widget
- inbound calls
- outbound calls

### Layer 4 — Role overlay
This adapts behavior for:
- Orchestrator
- Appointment
- Sales
- Customer Service
- Marketing
- Assistant
- Secretary

### Layer 5 — Session context
This contains runtime items:
- caller name if known
- call direction
- lead source
- prior contact history
- current campaign
- working hours state
- available actions

## Prompt editor requirements

The app UI must allow:
- structured section editing
- version history
- rollback
- draft vs published versions
- admin override
- test mode against sample scenarios

## Prompt governance rules

1. Keep tenant prompt separate from platform prompt.
2. Never store prompts only inside n8n.
3. Version every prompt change.
4. Allow admin global patches.
