# Twilio Toll-Free Verification — Submission Package

**Why this exists:** A2P 10DLC approval can take weeks. Toll-free number (TFN) verification is a separate, parallel process that's typically approved in 2–5 business days. A verified TFN can deliver real SMS to US recipients **without** A2P approval, so this is the fastest path to real-delivery testing while the 10DLC application is in review.

**Submit at:** Twilio Console → Phone Numbers → Manage → Regulatory Compliance → Toll-Free Verifications → New (or directly under the number's Messaging Configuration once a toll-free number is provisioned in the ISV master account).

---

## Step 0 — Buy a toll-free number on the ISV master account

Before you can submit verification, you need a toll-free number to attach the verification to.

1. Twilio Console → Phone Numbers → Buy a Number
2. Filter: Toll-Free, country = US, capabilities = SMS (and optionally Voice)
3. Purchase (typically $2/mo)
4. The number lives on the ISV **master** account — that's correct, since for testing we're sending from master, not a tenant subaccount

---

## Step 1 — Verification form fields (copy-paste this content)

Twilio's TFV form changes UI every few months. Field names below are stable; layout may differ.

### Business Information

| Field | Value |
|---|---|
| **Business name** | MyOrbisVoice |
| **Doing-business-as (DBA)** | OrbisVoice |
| **Business website** | https://myorbisvoice.com |
| **Business address** | 716 Washington St, Suite 2, Allentown, PA 18102 |
| **Business contact name** | Crawford Peterson Sr. |
| **Business contact email** | crawford.peterson.sr@gmail.com |
| **Business contact phone** | 929-497-7803 |
| **Business type** | *(confirm: LLC / Sole Proprietor / Other — user said "NO EIN" so likely Sole Proprietor)* |
| **Business industry** | Technology / SaaS |
| **Business registration ID type** | *(SSN if Sole Proprietor; EIN if LLC/Corp — user said NO EIN, so SSN path)* |
| **Business registration ID** | *(provide at submission time — SSN or EIN as appropriate)* |

### Use Case

| Field | Value |
|---|---|
| **Use case category** | Account Notifications |
| **Use case summary** | Transactional messaging from a multi-tenant voice automation SaaS — appointment confirmations, day-before reminders, missed-call follow-ups, and post-call summaries sent only to contacts who have explicitly engaged with one of our customers. |
| **Production message samples (provide at least 2)** | *(see below)* |

### Production message samples

Paste **two or three** of these into the form (Twilio asks for 2 minimum):

> **Sample 1 — Appointment confirmation:**
> Hi {firstName}, this is OrbisVoice confirming your appointment with {businessName} on {appointmentDate} at {appointmentTime}. Reply STOP to opt out.

> **Sample 2 — Day-before reminder:**
> Reminder: your appointment with {businessName} is tomorrow at {appointmentTime}. Reply STOP to opt out.

> **Sample 3 — Missed-call follow-up:**
> Hi {firstName}, we missed your call to {businessName}. Reply with a good time to reach you, or call us back at {businessPhone}. Reply STOP to opt out.

### Opt-in / consent

| Field | Value |
|---|---|
| **Opt-in type** | Verbal opt-in during phone call (the AI agent confirms permission to send confirmations/reminders) AND existing-customer relationship (the contact has called the business or completed a web form on the business website). |
| **Opt-in workflow description** | End users opt in by either (a) speaking to one of our customers' AI receptionists and consenting to receive a confirmation/reminder for their appointment, or (b) submitting a contact form on a customer's website that explicitly states they will receive transactional SMS related to their inquiry. Each business operates under its own end-user-facing terms; OrbisVoice retains opt-in evidence in the conversation transcript or the form submission record. |
| **Opt-in image/URL** | https://myorbisvoice.com/privacy *(or screenshot of the customer-facing intake form once available)* |

### Volume

| Field | Value |
|---|---|
| **Estimated subscriber count** | 500 |
| **Estimated daily message volume** | 50–200 |
| **Estimated monthly message volume** | 1,500–6,000 |

These are starter estimates — Twilio doesn't enforce them, they're just used for routing decisions. Bias slightly low to start; you can request volume increases later.

### Misc

| Field | Value |
|---|---|
| **Will messages contain links?** | Yes — links to the customer's website, booking pages, and unsubscribe pages |
| **Will messages contain phone numbers?** | Yes — the customer's business phone number for callbacks |
| **Has your business or use case been throttled or blocked by carriers before?** | No |
| **Additional information** | OrbisVoice operates as an ISV. All messages are sent on behalf of small-business customers (dental, legal, home services, fitness, etc.) following their own end-user opt-in. The toll-free number being verified here is for transactional messaging tied to specific customer engagements (booked appointments, missed calls, follow-ups) — not promotional broadcasts. |

---

## Step 2 — Submit and wait

Twilio reviews TFV submissions in roughly 2–5 business days. Watch for an email from `compliance@twilio.com` with the verdict. If they ask for clarification, respond promptly — a single missed reply can extend the wait by another full review cycle.

---

## Step 3 — Once verified

When verification approves:

1. The toll-free number is automatically marked verified in Twilio Console
2. SMS to US recipients from that number now delivers without A2P approval
3. In OrbisVoice, set the verified TFN as the platform send-from in **Admin → System Settings → Twilio → Phone Number** (or use it as the per-tenant outbound number on the ISV master account)
4. Run a real-delivery test via the **Send Test SMS** tool with `mode=live` and the verified TFN as the From — your phone should receive the message

---

## What this does NOT cover

- A2P 10DLC long-code messaging — that's the separate, longer-running approval. TFV is independent.
- WhatsApp Business — different process entirely (WhatsApp Sandbox first, then Senders).
- International destinations — those work today via live creds, no verification required.
