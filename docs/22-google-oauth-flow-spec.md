# Google OAuth flow spec

## Objective

This document defines how the platform connects a customer-provided Gmail or Google Workspace mailbox for appointment and email workflows.

## Core policy

The platform uses OAuth, not mailbox passwords, as the standard operating model.

## Actors
- tenant owner or authorized tenant manager
- app backend
- Google OAuth server
- Google APIs for Gmail and Calendar

## Flow steps

### Step 1 — Start connection
User clicks Connect Google.

App creates:
- tenant-bound state token
- anti-forgery nonce
- redirect URL
- requested scopes list

### Step 2 — Google consent
User signs in with the dedicated mailbox and grants requested scopes.

### Step 3 — OAuth callback
Google redirects back to the app.

App validates:
- state token
- nonce
- tenant binding
- user authorization level

### Step 4 — Token exchange
App exchanges authorization code for tokens.

Store securely:
- refresh token if provided
- access token only as needed
- token expiry
- granted scopes
- mailbox email

### Step 5 — Verification
App validates:
- mailbox identity
- calendar access if required
- Gmail send capability if required

### Step 6 — Connection result
App updates integration status to CONNECTED or ERROR.

## Scope policy

Request only the scopes required for:
- sending confirmation emails
- reading or writing booking events
- optional mailbox operations if explicitly supported later

## Reconnect scenarios
Reconnect is required when:
- refresh token revoked
- granted scopes insufficient
- mailbox changed
- provider error persists

## UI requirements

Connection panel must show:
- connected mailbox address
- connected at timestamp
- last verified timestamp
- scope summary
- reconnect action
- disconnect action if allowed

## Audit requirements

Audit events must record:
- who initiated connection
- tenant context
- mailbox connected
- success or failure status
- reconnect events

## Failure cases

- user cancels consent
- code exchange fails
- missing refresh token on repeat connection where provider does not return it
- calendar access denied
- mailbox mismatch with expected user choice

## Rules

1. Never display stored tokens in the UI.
2. Never accept the registration email as the mailbox automatically without explicit user choice.
3. Bind OAuth state to tenant and user.
4. Mark reconnect required on persistent provider failures.
