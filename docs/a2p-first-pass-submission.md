# A2P 10DLC — First-Pass Submission Dossier (MyOrbisVoice own brand)

**Purpose:** the single, complete document for registering MyOrbisVoice's
own A2P 10DLC brand + campaign on Twilio — designed so the submission is
approved on the **first pass**, no rejection cycles. Orchestrator's master
checklist: every required component, every value, every pre-flight check.

Compiled 2026-05-16 from current Twilio + TCR documentation (sources at
the end). Companion to [twilio-a2p-automation.md](twilio-a2p-automation.md)
(the API/automation reference).

---

## A. Path decision — Low-Volume Standard brand (EIN path)

**Decided 2026-05-16: MyOrbisVoice obtains an EIN, then registers as a
Low-Volume Standard brand.**

Why the EIN path won over the no-EIN Sole Proprietor path:

- The no-EIN **Sole Proprietor** path requires an **Individual** Primary
  Customer Profile — which mandates a **photo-ID upload + selfie identity
  verification** — plus the brand **OTP** (texted to a mobile, human reply).
  Those are human identity-proofing steps Twilio mandates; they cannot be
  automated. It also caps at 1 campaign / ~3,000 msgs/day.
- The **EIN** path uses a **Business** Primary Customer Profile (verified by
  business documentation + registration-authority validation — **no selfie,
  no personal ID step**) and a **Low-Volume Standard** brand (**no OTP**).
  The whole pipeline is genuinely automatable (`runStandardSubmission`).
  5 campaigns + real throughput.

The EIN is free, issued instantly online at irs.gov (~10 min); a sole
proprietor qualifies. Legal structure stays "Sole Proprietorship" — adding
an EIN does not change the entity, it just unlocks the Standard brand tier
(TCR requires a Sole Proprietorship *with* an EIN to register Low-Volume
Standard, not Sole Proprietor).

**Pipeline (all automated once the EIN is in hand):**
Business Primary Customer Profile → A2P TrustProduct → Low-Volume Standard
BrandRegistration → Messaging Service → UsAppToPerson campaign.

**Status:** awaiting the EIN from Crawford Peterson. Everything else in this
dossier is ready.

---

## B. Submission data form

> **Path changed (2026-05-16) — see §A.** The structure below (Starter
> Customer Profile, Sole Proprietor A2P Trust Bundle) was the no-EIN path.
> On the EIN path it becomes: **Business Primary Customer Profile** →
> **A2P TrustProduct** → **Low-Volume Standard brand**. The *data values*
> below (legal name, address, contact, samples) carry over unchanged; only
> the bundle structure differs. The one new input needed is the **EIN**.
> The full data set is re-confirmed with the owner at submission time.

Fill every line. `[NEED]` = required input not yet supplied. `[CONFIRM]` =
drafted value, verify it. Values must be **byte-identical** wherever they
repeat (Customer Profile, Brand, Campaign, website) — see §E.

### B.1 Starter Customer Profile (the person)

| Field | Value |
|---|---|
| Profile friendly name | MyOrbisVoice — Starter Profile |
| First name | Crawford ✓ |
| Last name | Peterson ✓ |
| Contact email | support@myorbisvoice.com — branded, already live ✓ |
| Contact phone | (404) 383-0220 — on the live site ✓ |
| Address — street | 716 Washington St ✓ (verified on live site) |
| Address — unit | Suite 2 ✓ |
| Address — city | Allentown ✓ |
| Address — region | PA ✓ |
| Address — postal code | 18102 ✓ |
| Address — country | US |

> ✓ **Contact email resolved.** The myorbisvoice.com domain already has
> branded mailboxes (`support@myorbisvoice.com`, `admin@myorbisvoice.com` —
> both on the live site footer). Use `support@myorbisvoice.com` for the
> registration. **Do NOT use `crawford.peterson.sr@gmail.com`** — Twilio
> flags free webmail (errors 21740 / 21736). No new mailbox needed.

The address is verified on the live site (USPS-verifiable). Email + address
may each be used at most **10×** across all TCR brand registrations.

### B.2 Sole Proprietor A2P Trust Bundle

| Field | Value |
|---|---|
| Brand name | MyOrbisVoice |
| Vertical / industry | TECHNOLOGY `[CONFIRM]` |
| **OTP mobile number** | +1 929 497 7803 ✓ (confirmed real mobile, not Twilio) |

> ⚠️ **OTP mobile** — must be a **real US/Canada mobile handset**. **Not** a
> Twilio number, not any VoIP/CPaaS number, not a landline. When the brand
> is submitted, Twilio texts a one-time code to this number; the owner must
> **reply within 24 hours**. The number can be used on at most **3** Sole
> Proprietor registrations ever (TCR-tracked, across all vendors). OTP must
> be completed within **30 days** of registration or the brand is voided
> and must be deleted + resubmitted.

### B.3 Campaign (UsAppToPerson)

| Field | Value |
|---|---|
| Use case | `SOLE_PROPRIETOR` (the only option for an SP brand) |
| Description | `[CONFIRM]` — see B.4; must name sender, recipient, purpose, consent |
| Message samples | `[CONFIRM]` — see B.5; 2–5 samples, 20–1024 chars each |
| Message flow / CTA | `[CONFIRM]` — see B.6; 40–2048 chars |
| Has embedded links | `[NEED]` — true if any sample contains a link |
| Has embedded phone | `[NEED]` — true if any sample contains a phone number |
| Privacy Policy URL | https://myorbisvoice.com/privacy.html |
| Terms & Conditions URL | https://myorbisvoice.com/terms.html |
| Opt-in keyword / message | START / see B.7 |
| Opt-out keyword / message | STOP / see B.7 |
| Help keyword / message | HELP / see B.7 |

> Privacy Policy URL + Terms URL become **mandatory campaign fields on
> 2026-06-30** — supplying them now is required and forward-safe.

### B.4 Campaign description `[CONFIRM]`

> MyOrbisVoice sends transactional text messages — appointment
> confirmations, appointment reminders, and account notifications — to its
> own customers who have opted in through the consent checkbox on the
> myorbisvoice.com booking and contact forms. Messages are recurring and
> triggered by the customer's own bookings and account activity.

*(Confirm this matches what MyOrbisVoice's own number will actually send.
If it will send login/2FA codes, add that. If it will send any marketing,
say so explicitly — and the opt-in must then be marketing-grade.)*

### B.5 Sample messages `[CONFIRM]` — drafts

Use `[brackets]` for variable content. Each ≥20 chars. At least one names
the brand and carries opt-out language.

1. `MyOrbisVoice: Your appointment with [Business] is confirmed for [Date] at [Time]. Reply STOP to opt out, HELP for help.`
2. `MyOrbisVoice: Reminder — your appointment with [Business] is tomorrow at [Time]. Reply STOP to unsubscribe.`
3. `MyOrbisVoice: [Business] received your request and will follow up shortly. Msg & data rates may apply. Reply STOP to opt out.`

*(Replace with the real messages MyOrbisVoice will send. Do not invent —
samples must reflect actual traffic; reviewers cross-check later.)*

### B.6 Message flow / Call-to-Action `[CONFIRM]`

> End users opt in by checking an unchecked consent checkbox on the booking
> and contact forms at myorbisvoice.com. The checkbox states they agree to
> receive recurring automated SMS from MyOrbisVoice, that message and data
> rates may apply, that consent is not a condition of purchase, and links
> to the Privacy Policy and Terms. Consent is also obtainable verbally
> during a call, recorded in the customer record.

### B.7 Auto-reply messages (each 20–320 chars)

- **Opt-in / confirmation:** `MyOrbisVoice: You're subscribed to appointment and account text alerts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`
- **Opt-out:** `MyOrbisVoice: You're unsubscribed and will receive no more messages. Reply START to opt back in.`
- **Help:** `MyOrbisVoice support: help@myorbisvoice.com. Msg & data rates may apply. Reply STOP to unsubscribe.`

---

## C. External assets — VERIFIED on the live site 2026-05-16

Twilio/TCR reviewers fetch the website, Privacy Policy, and Terms during
review. **All three were checked live on 2026-05-16 — already compliant.**

### C.1 Website — https://myorbisvoice.com ✓
- [x] Live, public, HTTPS, content-complete.
- [x] "MyOrbisVoice" visible (header logo, footer, throughout).
- [x] Describes the service ("AI receptionist that answers in under a second…").
- [x] Privacy Policy + Terms + Cookie Policy linked in the footer.
- [x] Visible contact info: address + admin@/support@ emails + (404) 383-0220.

### C.2 Privacy Policy — https://myorbisvoice.com/privacy.html ✓

Already has **§7 "SMS Communications"** with the non-sharing clause:

> "No mobile information will be shared with third parties or affiliates for
> marketing or promotional purposes. All text messaging originator opt-in
> data and consent information will not be shared with any third parties."

Plus STOP/HELP, message frequency, and "message and data rates may apply".
**Compliant as-is.**

*Optional bulletproofing* — Twilio's guidance names "sold … or lead
generators" explicitly. Current wording says "shared" not "sold" and omits
"lead generators". A one-line edit to `site/privacy.html` §7 (and
`site/es/privacy.html`) closes any reviewer doubt: change the bold sentence
to "…will never be **sold or shared** with any third parties, affiliates,
**or lead generators**." Low effort, not a blocker.

### C.3 Terms & Conditions — https://myorbisvoice.com/terms.html ✓

Already has **§8 "SMS Terms & Conditions"** — STOP/HELP, message frequency,
rates disclaimer, carrier-not-liable language, and an explicit A2P 10DLC /
Twilio reference. **Compliant as-is.**

### C.4 Opt-in disclosure — on the booking + contact forms — VERIFY

The web consent checkbox must be **unchecked by default**, a **standalone**
action, and **not a condition of purchase**:

> ☐ I agree to receive recurring automated text messages (appointment
> confirmations, reminders, and account updates) from MyOrbisVoice at the
> number provided. Consent is not a condition of purchase. Message
> frequency varies. Message and data rates may apply. Reply STOP to opt
> out, HELP for help. See our [Privacy Policy] and [Terms & Conditions].

---

## D. Pre-flight verification checklist

Run every check. The submission goes out only when all are green.

**Identity & data consistency**
- [ ] Brand type = Sole Proprietor (no EIN — confirmed).
- [ ] Proprietor legal first/last name supplied.
- [ ] Address is real + USPS-verifiable.
- [ ] Contact email is on the myorbisvoice.com domain (not free webmail).
- [ ] Legal name + address + contact are **byte-identical** across the
      Customer Profile, Trust Bundle, Brand, Campaign, and the website.

**OTP readiness**
- [ ] OTP mobile is a real US mobile handset (not VoIP/CPaaS/Twilio).
- [ ] OTP mobile has < 3 prior SP registrations against it.
- [ ] The owner has the handset in hand at submit time, ready to reply ≤24h.

**Website / policy**
- [ ] myorbisvoice.com live, public, business name visible.
- [ ] Privacy Policy live with the §C.2 SMS clause.
- [ ] Terms live with the §C.3 SMS section.
- [ ] Opt-in checkbox present, unchecked by default, on the consent forms.

**Campaign content**
- [ ] Use case = SOLE_PROPRIETOR.
- [ ] Description names sender + recipient + purpose + consent method.
- [ ] 2–5 samples, each 20–1024 chars, brand named in ≥1, `[brackets]` for
      variables, opt-out language present, no marketing unless disclosed.
- [ ] Message flow 40–2048 chars, describes a verifiable opt-in.
- [ ] hasEmbeddedLinks / hasEmbeddedPhone flags match the sample content.
- [ ] No URL shorteners (bit.ly etc.) in any sample.
- [ ] No SHAFT / prohibited content.
- [ ] PrivacyPolicyUrl + TermsAndConditionsUrl set and publicly reachable.

---

## E. Rejection-risk table — pre-empt every one

| # | Risk | Pre-emption | Severity |
|---|---|---|---|
| 1 | Wrong brand type | SP confirmed (no EIN) | fatal |
| 2 | OTP not answered in 24h | Real mobile in hand at submit; resend if missed | fatal |
| 3 | Business info ≠ across records | Byte-identical name/address/contact everywhere | high |
| 4 | Website unvalidatable | Live, public, content-complete, name visible | high |
| 5 | Privacy Policy missing SMS clause | §C.2 clause added before submit | high |
| 6 | Vague campaign description | §B.4 — names sender/recipient/purpose/consent | high |
| 7 | Weak / mismatched samples | §B.5 — realistic, branded, bracketed | high |
| 8 | Incomplete CTA / message flow | §B.6 — full disclosure | high |
| 9 | Opt-in not demonstrable | Unchecked checkbox on live forms + §B.6 | high |
| 10 | Free-webmail contact email | myorbisvoice.com-domain email | medium |
| 11 | URL shortener in samples | Full URLs / branded domain only | medium |
| 12 | Prohibited (SHAFT) content | Transactional only — N/A here, keep it so | fatal* |

\* Prohibited-content rejections (error 30883) **cannot** be fixed by
resubmitting. Everything else can — but TCR stops at the *first* fault, so
**every** item must be right before the single submission.

---

## F. Code gaps to close before the real submission

The automation engine (`apps/api/src/services/a2p.service.ts`) needs:

1. **Campaign privacy/terms URLs** — `createUsAppToPersonCampaign` must
   pass `privacyPolicyUrl` + `termsAndConditionsUrl` (mandatory 2026-06-30).
2. **SP trust bundle vertical** — `createSoleProprietorTrustProduct` should
   set the optional `vertical` attribute on the `sole_proprietor_information`
   end-user.
3. **Auto-reply messages** — wire the §B.7 opt-in/opt-out/help messages
   into the campaign create call.

---

## G. Submission sequence

1. Close the §F code gaps; deploy.
2. Publish the §C website/privacy/terms updates to myorbisvoice.com.
3. Create the branded contact mailbox.
4. Fill every `[NEED]` / `[CONFIRM]` in §B.
5. Run the auto-fill + validation gate; clear §D.
6. **Twilio-mock test** (`a2p_brand_mock=true`) — full pipeline, zero fees.
7. Disable mock; submit the real registration; answer the OTP within 24h.
8. Track to APPROVED via status sync.

---

## Sources

- Twilio — Direct Sole Proprietor Registration Overview
- Twilio — New Sole Proprietor A2P 10DLC Registration for ISVs (API)
- Twilio — A2P 10DLC Campaign Approval Requirements
- Twilio — Why Was My A2P 10DLC Campaign Registration Rejected?
- Twilio — A2P 10DLC Brand Approval Best Practices
- Twilio — Improving Your Chances of A2P 10DLC Registration Approval
- Twilio — Troubleshooting and Rectifying A2P Campaigns
- Twilio — UsAppToPerson resource reference
- Twilio Changelog — Privacy Policy + Terms URLs required 2026-06-30
- The Campaign Registry — campaign vetting guidance; CTIA Messaging Principles
