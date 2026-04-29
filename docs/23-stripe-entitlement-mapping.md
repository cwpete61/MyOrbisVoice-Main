# Stripe entitlement mapping

## Objective

This document maps subscription state to effective feature access and quotas.

## Core principle

Stripe is the billing authority. The app database is the entitlement authority after Stripe events are normalized and applied.

## Billing objects tracked
- customer
- subscription
- price
- invoice
- checkout session
- portal session

## Plan mapping model

### Plan definition
Each plan contains:
- code
- billing interval
- display name
- Stripe price reference
- default entitlements
- default quotas

### Effective entitlement sources
Priority order:
1. admin override
2. active plan mapping
3. promotional grant
4. default false or zero

## Example entitlement keys

Boolean keys:
- widget_enabled
- inbound_enabled
- outbound_enabled
- sms_enabled
- call_forwarding_enabled
- human_handoff_enabled
- affiliate_portal_enabled
- multi_agent_enabled
- prompt_testing_enabled

Integer quota keys:
- monthly_voice_minutes
- monthly_sms_segments
- monthly_outbound_calls
- monthly_appointments
- max_phone_numbers
- max_users
- max_live_sessions

String keys:
- support_level
- branding_mode

## Stripe event mapping

### checkout.session.completed
Action:
- link customer to tenant
- confirm purchase intent

### customer.subscription.created
Action:
- create subscription record
- apply plan entitlements

### customer.subscription.updated
Action:
- update current subscription state
- re-run entitlement sync

### customer.subscription.deleted
Action:
- mark canceled
- apply post-cancel policy

### invoice.payment_succeeded
Action:
- preserve active state
- clear dunning flags

### invoice.payment_failed
Action:
- mark billing issue
- start dunning workflow
- preserve grace-period behavior if configured

## Tenant state mapping

### Trial
- limited entitlements
- no production call launch if desired

### Active
- full entitlements based on plan and overrides

### Past due
- preserve read access
- restrict high-cost operations if policy requires

### Suspended
- block channel runtime
- keep admin visibility
- allow reactivation path

### Canceled
- allow data retention rules
- block new usage

## Entitlement sync rules

1. Entitlements are not computed on every request from raw Stripe data.
2. Normalize Stripe events into app records first.
3. Recompute effective entitlements after relevant billing changes.
4. Log each entitlement change event.

## Overage strategy

If overages are supported later, track:
- measured usage
- included usage
- overage amount
- billing period alignment
