# OAuth and secrets policy

## Principle

Store tokens and secrets securely. Do not use customer email passwords as the standard operating credential model.

## Google integration policy

Customers must connect a dedicated Gmail or Google Workspace mailbox through OAuth.

Store:
- mailbox address
- scope list
- token status
- encrypted refresh token
- encrypted access token if temporarily retained
- token expiry metadata
- reconnect required flag

Do not store in plaintext:
- mailbox password
- recovery codes
- app passwords unless explicitly supported as a special fallback and still encrypted

## Twilio integration policy

Store:
- account SID
- encrypted auth token or API key material
- incoming number references
- messaging service references

## Stripe integration policy

Store:
- Stripe customer IDs
- subscription IDs
- price IDs
- invoice references
- webhook signing secret in platform configuration

## Secret storage approach

Use one of these patterns:
- application-level encrypted secrets table with key management
- dedicated vault service

Each stored secret must support:
- label
- owner type
- owner ID
- secret type
- created at
- updated at
- last validated at
- rotation status

## UI behavior

All secrets are write-only fields in the UI.

UI must display:
- connected / not connected
- last verified time
- reconnect needed
- rotate secret action

UI must not display:
- actual secret value after save

## Audit rules

Every secret change must create an audit event.
