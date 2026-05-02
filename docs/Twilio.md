# Twilio Approval Guide — SMS & Voice

This document is the canonical reference for helping OrbisVoice clients
get approved for outbound SMS and outbound calling through Twilio. It covers
business preparation, website compliance, A2P 10DLC registration, and Voice
Integrity / SHAKEN/STIR setup.

> **Audience:** Client-facing onboarding workflow + internal support
> reference. Used as the source of truth for the in-app help center
> (`integrations-twilio-approval` and related articles).

---

## Step-by-step client workflow

### Step 1: Prepare your business information

The client should collect this before opening Twilio:

- **Legal Business Name:**
- **DBA / Brand Name:**
- **EIN:**
- **Business Type:**
- **Industry:**
- **Website URL:**
- **Business Address:**
- **Business Phone Number:**
- **Business Email:**
- **Authorized Representative Name:**
- **Authorized Representative Title:**
- **Authorized Representative Email:**
- **Authorized Representative Phone:**

Use the same legal name, EIN, address, and website that appear in public
business records. Mismatches can delay or fail the review.

### Step 2: Fix the website before submitting Twilio

The client's website should be live, secure, and complete.

Twilio states that if a website is used for SMS opt-in, the website must
include a privacy policy and terms of service. The privacy policy must
include a non-sharing statement for mobile numbers, message frequency, and
"message and data rates may apply."

**The client website should include:**

- Home page
- About page or business description
- Contact page
- Visible phone number
- Visible email address
- Visible business address or service area
- Privacy Policy
- Terms & Conditions
- SMS consent checkbox on contact/booking forms

For calling trust, Twilio Voice Integrity requires a functioning secure
website URL using `https://`, an EIN or DUNS, a valid U.S. business address,
and an authorized representative with a valid U.S. phone number.

### Step 3: Add the SMS checkbox to client forms

Put this on every form where the client collects phone numbers for SMS.

**Website SMS consent checkbox:**

> ☐ I agree to receive SMS text messages from **[CLIENT BUSINESS NAME]**
> about appointment scheduling, appointment reminders, service updates,
> customer support, and follow-up communications. Message frequency varies.
> Message and data rates may apply. Reply STOP to opt out. Reply HELP for
> help. Consent is not a condition of purchase. See our Privacy Policy and
> Terms & Conditions.

**Important rules:**

- The checkbox must NOT be pre-checked.
- The checkbox must mention SMS or text messages.
- The checkbox must name the client business.
- The checkbox must say what messages the customer will receive.
- The checkbox must be separate from accepting Terms or Privacy Policy.
- The checkbox must be visible on the form, not hidden in the footer.

Twilio rejects opt-in flows when consent language does not clearly ask for
SMS consent, does not mention SMS/text messaging, is buried in policies, or
does not explain what messages the user will receive.

### Step 4: Add this Privacy Policy section

The client should add this to their Privacy Policy.

> **SMS Communications**
>
> When you provide your mobile phone number and opt in to SMS communications,
> **[CLIENT BUSINESS NAME]** may send you text messages related to appointment
> scheduling, appointment reminders, service updates, customer support, and
> follow-up communications.
>
> Message frequency varies based on your interaction with our business.
> Message and data rates may apply. You may opt out at any time by replying
> STOP. For assistance, reply HELP or contact us at **[CLIENT EMAIL]** or
> **[CLIENT PHONE NUMBER]**.
>
> No mobile information will be shared with third parties or affiliates for
> marketing or promotional purposes. All text messaging originator opt-in
> data and consent information will not be shared with any third parties.

Do **NOT** write that SMS opt-in data may be shared with partners,
affiliates, vendors, marketing companies, or unrelated third parties.
Twilio's Messaging Policy prohibits selling, renting, or transferring consent.

### Step 5: Add this Terms & Conditions section

The client should add this to their Terms & Conditions.

> **SMS Terms & Conditions**
>
> By opting in to receive SMS messages from **[CLIENT BUSINESS NAME]**, you
> agree to receive text messages related to appointment scheduling,
> appointment reminders, service updates, customer support, and follow-up
> communications.
>
> Message frequency varies. Message and data rates may apply.
>
> You may opt out at any time by replying STOP. After you reply STOP, we may
> send one final confirmation message to confirm that you have been
> unsubscribed. You may reply HELP for assistance or contact us at
> **[CLIENT EMAIL]** or **[CLIENT PHONE NUMBER]**.
>
> Consent to receive SMS messages is not a condition of purchasing any goods
> or services. Wireless carriers are not liable for delayed or undelivered
> messages.

---

## Twilio SMS form language for client approval

### Campaign description

Paste this into the Twilio A2P Campaign description field:

> This campaign sends SMS messages from **[CLIENT BUSINESS NAME]** to
> customers and prospects who have opted in through our website form,
> booking form, inbound SMS, phone call, or customer support interaction.
> Messages include appointment confirmations, appointment reminders,
> rescheduling notices, service updates, customer support follow-ups, and
> direct responses to customer inquiries. Messages are sent only to
> recipients who provide consent, and recipients can opt out at any time by
> replying STOP.

Twilio says campaign descriptions need a thorough explanation of the
campaign objective. Single-word descriptions such as "Marketing" are
insufficient.

### Message flow / opt-in description

Paste this into the Twilio Message Flow field:

> End users opt in by visiting **[CLIENT WEBSITE URL]** and submitting a
> contact or booking form that asks for their mobile phone number. The form
> includes an unchecked SMS consent checkbox that states: "I agree to
> receive SMS text messages from **[CLIENT BUSINESS NAME]** about appointment
> scheduling, appointment reminders, service updates, customer support, and
> follow-up communications. Message frequency varies. Message and data
> rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is
> not a condition of purchase." End users may also opt in by texting START
> to **[CLIENT TWILIO NUMBER]** or by requesting SMS follow-up during a
> phone call or customer support interaction. Privacy Policy and Terms &
> Conditions are linked on the form and in the website footer.

Twilio requires a detailed opt-in description between 40 and 2049
characters. If multiple opt-in methods are used, all methods must be listed.

### Sample SMS messages

Use two to five sample messages.

> **[CLIENT BUSINESS NAME]:** Your appointment is confirmed for [DATE] at
> [TIME]. Reply C to confirm, R to reschedule, HELP for help, or STOP to
> opt out.
>
> **[CLIENT BUSINESS NAME]:** Reminder, your appointment is scheduled for
> tomorrow at [TIME]. Reply R to reschedule, HELP for help, or STOP to opt
> out.
>
> **[CLIENT BUSINESS NAME]:** Thanks for contacting us. We received your
> request about [SERVICE]. A team member will follow up shortly. Reply HELP
> for help or STOP to opt out.
>
> **[CLIENT BUSINESS NAME]:** Your service request for [SERVICE] has been
> updated. Please call [CLIENT PHONE] with questions. Reply HELP for help
> or STOP to opt out.

Twilio requires sample messages to match the campaign description, identify
the brand by name or website, use brackets for variable content, and include
links or phone numbers if those will appear in real messages.

### Opt-in auto-response

Use this if customers can text START or another keyword.

> **[CLIENT BUSINESS NAME]:** You're subscribed to receive recurring
> appointment, support, and service update texts. Msg frequency varies.
> Msg & data rates may apply. Reply HELP for help or STOP to opt out.

### Opt-out response

> **[CLIENT BUSINESS NAME]:** You have been unsubscribed and will no longer
> receive SMS messages from us. Reply START to resubscribe.

### Help response

> **[CLIENT BUSINESS NAME]:** Help is available at **[CLIENT PHONE]** or
> **[CLIENT EMAIL]**. Reply STOP to opt out.

Twilio requires a clear opt-out process, and the initial message must
include "Reply STOP to unsubscribe" or equivalent opt-out language.

---

## Twilio Voice approval language

### Calling use case description

Use this for Voice Integrity, SHAKEN/STIR, or phone-number trust review:

> **[CLIENT BUSINESS NAME]** uses Twilio Programmable Voice to place and
> receive business calls for appointment scheduling, customer support,
> service follow-up, missed-call response, and customer-requested
> callbacks. Calls are made only for legitimate business purposes to
> customers, prospects, or contacts who requested communication or have an
> existing business relationship with **[CLIENT BUSINESS NAME]**. The phone
> numbers are owned and controlled by **[CLIENT BUSINESS NAME]** and are
> not used for deceptive calling, caller ID spoofing, third-party lead
> generation, or unrelated campaigns.

### SaaS platform disclosure, if needed

Use this only if Twilio asks how the software is involved:

> **OrbisVoice** provides the software used by **[CLIENT BUSINESS NAME]**
> to manage calls, SMS messages, appointment scheduling, and customer
> follow-up. **[CLIENT BUSINESS NAME]** is the sender of record and controls
> its own customer communications, phone numbers, opt-in records, and
> business messaging use case.

This keeps the client as the business sender, not the SaaS company.

---

## Client approval workflow inside Twilio

### SMS approval

1. Create or log in to the client's own Twilio account.
2. Add billing.
3. Complete Trust Hub business profile.
4. Submit business profile for review.
5. Buy SMS-capable local number.
6. Create Messaging Service.
7. Register A2P Brand.
8. Register A2P Campaign.
9. Attach phone number to the Messaging Service.
10. Submit Campaign for approval.
11. Test START, STOP, HELP, and normal outbound messages.
12. Connect approved number to the SaaS platform.

### Calling approval

1. Buy voice-capable Twilio number.
2. Complete Trust Hub Business Profile.
3. Assign phone number to the approved business profile.
4. Create Voice Integrity Trust Product.
5. Submit Voice Integrity review.
6. Enable SHAKEN/STIR.
7. Optional: register CNAM.
8. Optional: register branded calling.
9. Connect the approved voice number to the SaaS platform.

Voice Integrity lets businesses register Twilio phone numbers with analytics
engines to remediate spam labels and manage number reputation.

---

## What the client must NOT say

Avoid these phrases in Twilio forms:

- Cold outreach
- Lead generation
- Purchased list
- Affiliate campaign
- Third-party marketing
- Mass texting
- Automated sales blasts
- Debt relief
- Credit repair
- Loan offers
- High-risk financial services
- Cannabis
- CBD
- Firearms
- Alcohol
- Tobacco
- Gambling
- Get rich quick

Twilio's U.S. SMS guidelines include violations for spam, phishing, SHAFT
content, and carrier-prohibited messaging behavior.

---

## Client approval checklist

Before the client submits:

- [ ] Business name matches EIN.
- [ ] Website is live and secure.
- [ ] Website clearly explains the business.
- [ ] Website has contact information.
- [ ] Website has Privacy Policy.
- [ ] Website has Terms & Conditions.
- [ ] SMS checkbox is visible.
- [ ] SMS checkbox is not pre-checked.
- [ ] SMS checkbox names the client business.
- [ ] SMS checkbox says SMS/text messages.
- [ ] SMS checkbox says message frequency varies.
- [ ] SMS checkbox says message and data rates may apply.
- [ ] SMS checkbox says STOP and HELP.
- [ ] Privacy Policy says mobile opt-in data is not shared.
- [ ] Terms include SMS terms.
- [ ] Campaign description matches the real use case.
- [ ] Sample messages match the campaign description.
- [ ] Every sample message includes the client business name.
- [ ] No cold SMS language is used.
- [ ] No purchased-list language is used.
- [ ] STOP and HELP are configured before live sending.

---

## Best SaaS client onboarding workflow

Use this inside your SaaS onboarding:

### Phase 1: Client Intake
- Collect legal business name, EIN, address, website, email, phone, and
  authorized representative.
- Ask whether they need SMS, calling, or both.
- Ask what messages they will send.

### Phase 2: Website Compliance
- Check website for Privacy Policy, Terms, contact info, and SMS checkbox.
- Provide missing policy copy.
- Confirm opt-in checkbox is live.

### Phase 3: Twilio Setup
- Client creates their own Twilio account.
- Client adds billing.
- SaaS team helps submit Trust Hub, A2P Brand, A2P Campaign, and Voice
  Trust products.

### Phase 4: Approval
- Wait for Twilio/carrier review.
- Fix any rejection reason.
- Resubmit if needed.

### Phase 5: Connection
- Connect approved Twilio Account SID, Auth Token/API Key, phone number,
  Messaging Service SID, and Voice settings to the SaaS platform.

### Phase 6: Production Controls
- Store consent records.
- Honor STOP immediately.
- Keep opt-out suppression active.
- Monitor failed messages, blocked calls, spam labels, and complaint rates.

---

## The critical point

**The client's website, client's consent language, client's Twilio account,
and client's business identity must all match.**

That alignment gives the client the best chance of approval.
