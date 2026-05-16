# Twilio A2P 10DLC — Auto-Submission Reference

**Purpose:** the canonical reference for building/operating MyOrbisVoice's
automated A2P 10DLC compliance application. Read this before working on the
A2P compliance/submission flow. (For the *manual* fallback process, see
[runbook-a2p-manual-submission.md](runbook-a2p-manual-submission.md).)

---

## Direct answer

**Auto-submission is possible. Auto-approval is not.**

As a Twilio ISV, the app can collect customer data, create the required Trust
Hub objects, submit the customer profile, register the brand, create the
campaign, attach the Messaging Service, and track status through Twilio APIs.

- ✅ The app **can auto-submit** A2P profiles, brands, and campaigns through
  Twilio's APIs.
- ❌ The app **cannot bypass** Twilio / TCR / carrier review. Campaigns still
  go through validation and review — Twilio currently quotes **10–15 days**
  for campaign review due to submission volume.

Build it as a **compliance workflow**, not just a form submitter.

---

## What can be automated

### Customer business data to collect (required by The Campaign Registry)

- Legal business name
- EIN / Tax ID
- Business type
- Industry
- Website
- Physical address
- Authorized representative
- Contact email / phone
- Messaging use case
- Opt-in method
- Message examples
- HELP / STOP handling
- Privacy Policy URL
- Terms & Conditions URL

### The API submission flow

1. **Secondary Customer Profile** — per customer, the backend creates a
   Secondary Customer Profile via the Trust Hub API; attach business info,
   authorized representative, address, and supporting documents, then submit
   for review. The Secondary Customer Profile stores the customer's
   business/contact information.

2. **A2P TrustProduct / Trust Bundle** — create and submit the A2P
   TrustProduct tied to the customer's profile. Twilio supports **status
   callbacks** for TrustProduct updates — wire these into the pipeline.

3. **BrandRegistration** — `POST https://messaging.twilio.com/v1/a2p/BrandRegistrations`.
   Represents the customer's A2P 10DLC Brand; holds the TCR-required business
   details. Requires the Customer Profile Bundle SID and A2P Profile Bundle SID.

4. **Wait for Brand approval** — model this as a **state machine**, not a
   single blind request. BrandRegistration statuses: `PENDING`, `APPROVED`,
   `FAILED`, `IN_REVIEW`, `SUSPENDED`, and related states.

5. **A2P Campaign** — after the Brand is approved, create the A2P Campaign
   via the `UsAppToPerson` resource inside a Messaging Service. Creating it
   submits the campaign for review **and incurs A2P fees**.

6. **Status tracking** — use `status_callback` fields + Twilio Event Streams
   so the client dashboard updates when the profile, brand, campaign, or
   phone-number registration changes status. Status callbacks include failure
   details that help with self-service remediation.

---

## Recommended app architecture

```
Customer Onboarding Form
        ↓
Compliance Validator
        ↓
Website / Opt-In Page Checker
        ↓
Customer Authorization Checkbox
        ↓
Twilio Trust Hub API Worker
        ↓
Brand Registration Worker
        ↓
Campaign Registration Worker
        ↓
Phone Number Assignment Worker
        ↓
Webhook / Event Stream Status Tracker
        ↓
Client Dashboard
```

### SIDs the app must persist

- `customer_profile_sid`
- `trust_product_sid`
- `brand_registration_sid`
- `messaging_service_sid`
- `campaign_sid` / `usa2p_sid`
- `phone_number_sid`

Also store every submission payload, review status, failure reason,
timestamp, and remediation note.

---

## What canNOT be automated

- **Customer-provided truth + authorization.** The app must not invent or
  infer compliance data. Require an explicit customer authorization step.
- **Approval.** Twilio, TCR, and carrier reviewers can reject a Brand or
  Campaign for: bad EIN matching, vague opt-in language, missing website
  disclosures, prohibited content, weak message samples, or noncompliant
  privacy/terms pages.
- **Sole Proprietor flows** — Twilio says the steps can be called in one
  uninterrupted API sequence, but synchronous, near-synchronous, and manual
  validations still apply.

---

## Safeguard — review before submit

Add a **"review before submit"** step before the real API call. Twilio offers
**mock Brand and Campaign APIs** for testing — mock campaigns don't send live
SMS traffic and don't incur TCR billing events. Use mocks during development
before submitting real customer registrations.
