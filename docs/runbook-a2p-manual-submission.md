# Runbook — Manual A2P 10DLC Submission to Twilio Trust Hub Console

**Status as of 2026-05-05:** the `/a2p` form (tenant) and `/admin/a2p` dashboard (admin) capture every field A2P 10DLC requires. Submission to Twilio's Trust Hub API is **not yet automated** — that's a planned next sprint per backlog #20 (~5-7 days). Until then, this runbook covers the manual path.

When a tenant clicks Submit on `/a2p` (or admin clicks Submit on `/admin/a2p` for the platform's own application), status flips from `DRAFT` to `SUBMITTED`. **The data is captured but Twilio doesn't know about it yet.** This runbook is the human bridge.

## When to run this

Whenever an A2P application moves to `SUBMITTED` status. Visible at:
- **All applications:** Admin → A2P 10DLC (`/admin/a2p`)
- **Audit log search:** filter for `action = 'a2p.submitted'` or `action = 'admin.a2p.platform.submitted'`

Goal: take the captured data, post it to Twilio's Trust Hub Console, get back the Twilio SIDs, and mark the application APPROVED in MyOrbisVoice with those SIDs recorded.

## Prerequisites

- You're logged into the Twilio Console at https://console.twilio.com with admin access to the relevant account:
  - **Tenant-scope application** → use the **tenant's subaccount** (visible from Console → Account → Manage subaccounts; switch into the right subaccount before doing the work)
  - **Platform-scope application** → use the **MyOrbisVoice master account** directly

- Twilio Trust Hub access for that account (some accounts need ISV approval before Trust Hub is enabled — check Settings → Compliance).

## Step-by-step

### 1. Pull the captured data

In MyOrbisVoice admin: navigate to https://app.myorbisvoice.com/admin/a2p, find the SUBMITTED application, and use the **Copy** buttons next to each field to grab values to your clipboard.

You'll need to copy:
- Legal name
- EIN
- Business type
- Vertical (industry)
- Website URL
- Full address
- Authorized representative (first name, last name, email, phone)
- Use case
- Sample SMS messages (5 of them, individually)

### 2. Twilio Trust Hub Console — Customer Profile

In Twilio Console (right account scope): **Trust Hub → Customer Profiles → Create new**

- **Profile name:** `<Legal name> A2P Profile`
- **Profile type:** `Primary Customer Profile`
- **Business type:** matches what tenant entered
- **Address:** matches what tenant entered
- **Authorized rep:** matches what tenant entered

Submit. Twilio gives you a `Customer Profile SID` (starts with `BU…`). **Save it.** You'll paste it back into MyOrbisVoice.

### 3. Twilio — Brand Registration

**Trust Hub → A2P → Create Brand**

- **Customer profile:** select the one you just made
- **Brand type:** `Standard` (default) or `Low Volume Standard` (if expecting <6,000 messages/day)
- **Vertical, EIN, legal name:** match captured data
- Pay the registration fee (Twilio shows it: ~$4 Low Volume / ~$44 Standard, one-time)

Submit. Twilio gives you a `Brand SID` (starts with `BN…`). **Save it.**

Brand registration runs through The Campaign Registry (TCR) — typically 1-2 business days for review.

### 4. Twilio — Campaign Registration

**Trust Hub → A2P → Create Campaign**

- **Brand:** select the brand you just made
- **Use case:** matches what tenant entered (Customer Care / Marketing / 2FA / Mixed / Utility)
- **Description:** Write 2-3 sentences describing what messages this campaign sends. Example: *"Appointment reminders, booking confirmations, and follow-up messages from `<tenant business>` to customers who have given consent during phone interactions or website signup."*
- **Sample messages:** paste the 5 sample messages from the captured data
- **Opt-in keywords:** typically `START`, `YES`, `SUBSCRIBE` (or whatever consent flow the business uses)
- **Opt-out keywords:** `STOP`, `END`, `UNSUBSCRIBE`, `CANCEL`, `QUIT` (carrier-required minimum)
- **Help keywords:** `HELP`, `INFO`
- **Message frequency:** estimate (e.g., "1-2 messages per appointment, less than 30/month per recipient")

Submit. Twilio gives you a `Campaign SID` (starts with `CMP…`). **Save it.**

Campaign approval runs through TCR + downstream carrier review (AT&T / Verizon / T-Mobile each have their own queues). Typical: 1-2 weeks end-to-end.

### 5. Link the campaign to phone numbers

Once the campaign status flips to `VERIFIED` in Twilio Console (poll Trust Hub → A2P → your campaign every few days):

- For tenant scope: Twilio Console → switch to tenant's subaccount → Phone Numbers → Manage → Active Numbers → click each number → Messaging → A2P 10DLC → assign the campaign
- For platform scope: same flow on the master account's numbers

Until linked, the registered campaign is just a paper certificate — actual SMS sending still falls back to default (low) throughput.

### 6. Mark approved in MyOrbisVoice

Back at https://app.myorbisvoice.com/admin/a2p, find the SUBMITTED application, click **Mark Approved**, paste the three SIDs you saved (Customer Profile, Brand, Campaign), confirm.

Status flips to `APPROVED`. Audit log records `admin.a2p.marked_approved` with the SIDs. Tenant can now send SMS at full throughput.

## If Twilio rejects the application

Twilio sends an email with the rejection reason. Common reasons:
- Sample messages don't match described use case (most common)
- Vague message-flow description
- Mismatch between EIN and legal name
- Website doesn't have a privacy policy or contact page

In MyOrbisVoice admin, find the application, click **Mark Rejected**, paste the rejection reason. Status flips to `REJECTED` and the tenant sees the reason on their `/a2p` page so they can edit + re-submit.

## Time expectations end-to-end

| Step | Wall time |
|---|---|
| Customer Profile + Brand creation | 30 minutes (admin work) |
| Brand TCR review | 1-2 business days |
| Campaign creation | 30 minutes (admin work) |
| Campaign TCR + carrier review | 1-2 weeks |
| Phone number link + tenant notified | 5 minutes (admin work) |
| **Total** | **~2 weeks**, of which ~1 hour is your time |

The 2-week wall time is unavoidable — it's TCR + the three major US carriers each running their own review. The MyOrbisVoice form just makes the human work clean and auditable.

## When this runbook becomes obsolete

When backlog #20 ships the Trust Hub API integration (~5-7 days of focused work), the entire flow above becomes a single `POST /api/a2p/submit` (tenant) or `POST /api/admin/a2p/platform/submit` (admin) call that fires the 8 Twilio API calls programmatically. Status updates flow back via webhooks. Manual SID-pasting goes away.

Until then, this is the path. Update `docs/launch-blockers.md` if you do enough manual submissions that the friction justifies prioritizing the automation sprint.
