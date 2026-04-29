# Affiliate ledger spec

## Objective

This document defines the affiliate tracking and commission ledger model.

## Affiliate flow

1. affiliate signs up
2. platform approves or activates affiliate
3. affiliate receives referral code and link
4. visitor lands with referral attribution
5. tenant signup and subscription event occur
6. conversion is linked to affiliate
7. commission record is created
8. payout eligibility is evaluated
9. payout status is tracked

## Core entities
- affiliate account
- referral link or code
- click event
- conversion event
- commission ledger entry
- payout batch reference

## Attribution rules

Attribution should consider:
- referral code
- cookie or session window
- signup timestamp
- first-touch or last-touch policy

Decide one policy and keep it consistent.

## Commission record fields
- commissionId
- affiliateAccountId
- tenantId
- conversionId
- amountMinor
- currency
- commissionRate or rule reference
- status
- approvedAt optional
- paidAt optional
- payoutRef optional
- reversalReason optional
- createdAt

## Status lifecycle
- PENDING
- APPROVED
- HOLD
- PAID
- REVERSED

## Hold rules
Commissions may move to HOLD when:
- subscription still in refund window
- payment disputed
- payment failed
- fraud review triggered

## Approval rules
Approval may be automatic or admin-reviewed.

## Reversal rules
Reverse commission when:
- subscription charge reversed
- qualifying payment never settles
- fraud or invalid self-referral detected

## Affiliate dashboard metrics
- clicks
- attributed signups
- active customers
- pending commissions
- approved commissions
- paid commissions
- payout history
- conversion rate

## Audit rules
Every ledger mutation must create an audit event.
