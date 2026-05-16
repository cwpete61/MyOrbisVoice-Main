# Homepage Copy v2 — myorbisvoice.com (tenant-direct, high-conversion)

**Surface:** [site/index.html](../site/index.html) (and `site/es/index.html` parity follow-up)
**Audience:** Tenant business owner — dental, legal, home services, beauty, fitness, salon, real estate, coaching, medical.
**Aggression tier:** Balanced (default per [docs/marketing-style-guide.md](marketing-style-guide.md#L42)) — Halbert + Wiebe blend. Emotional but credible. PAS framing. Soft urgency. Direct CTAs.
**Frameworks applied:**
- **Hero:** PAS (Pain → Agitate → Solve), Caples-style headline (~6–10 words)
- **Page narrative:** StoryBrand 7-step (you-the-hero / guide / plan / call to action / failure / success)
- **Body lines:** Sugarman slippery slope — every line earns the next
- **Stacking:** Cialdini 7 (social proof, authority, reciprocity, scarcity, commitment-consistency, liking, unity)
- **Schwartz stage:** mostly Stage 3 (Solution-aware) with Stage 2 (Pain-aware) hook at the top
**Honesty rules** (style guide §"Core positioning constraint"): every number sourceable, every story specific OR labeled hypothetical, every urgency enforceable.

**Voice-engine positioning (firm rule):** all customer-facing copy refers to the voice engine as proprietary **Orby** (the friendly/brandable name) or **Orbis Voice** (the formal tech name). **Never name Google Gemini, Gemini 2.5 Flash, Gemini Live, or any underlying model.** Customer-trusted integrations (Google Calendar, Gmail, Twilio, Stripe, Bunny CDN) stay visible — those are infrastructure connections the customer expects to see. The seam: anything a prospect would read = Orby framing; engineering docs = technical truth is fine.

---

## What's actually different about MyOrbisVoice (the seven beats this page rides)

These are the points the page must land — drawn from [docs/product-overview.md](product-overview.md) and pressure-tested against the competitive set (Smith.ai/Ruby, Synthflow/Vapi/Retell/Bland, Air.ai, AnswerConnect, Podium/Birdeye, HubSpot voice add-ons).

1. **Structured Business DNA, not a prompt box.** Tenants fill in versioned fields — services, pricing, hours, escalation rules, prohibited phrasing — and the platform braids them into every conversation through a 5-layer prompt (Platform / Tenant / Channel / Role / Session). Versioned draft→published. **No competitor exposes this.**
2. **Seven specialized agents with mid-call handoff.** Orchestrator routes a booking question to Appointment, a pricing question to Sales, a refund question to Customer Service — invisibly to the caller. **vs single-prompt chatbot loops.**
3. **Bilingual EN/ES at structural parity.** Every dashboard string, email template, help article ships in both. Latin American conventions, informal *tú*. **vs translation-overlay competitors** — and 20–50% of inbound flow at U.S. service businesses today is Spanish.
4. **Cross-session contact memory.** When a known caller reaches the agent, prior conversation summaries + recent appointments + CRM facts (spouse, kids, hobbies, anniversaries, customer-since) auto-inject into the prompt. The agent opens with "Welcome back — last time we got you in for X." **vs amnesia.**
5. **Tag-driven multi-channel campaign engine fed by structured call outcomes.** Every call ends with `BOOKED` / `CALLBACK_REQUESTED` / `MISSED_CALL` / `INFO_REQUEST` / `QUALIFIED_LEAD`. The outcome auto-tags the contact. The tag fires a campaign that fans out across voice + SMS + email + WhatsApp **independently**. **vs sequential drip tools that need separate setup.**
6. **Day-one defaults that actually work.** Four campaigns ship pre-built. Automatic 24h + 1h appointment reminders fire out of the box. A `/book/<slug>` public booking page lives the moment you sign up. **vs "set up your first workflow" empty-state friction.**
7. **Real execution, not description.** Google Calendar free/busy + booking. Gmail OAuth dispatch. Twilio numbers purchased through the platform. Stripe Connect Express. Bunny CDN recordings + indexed transcripts. **The agent doesn't transcribe that it would book. It books.**

Two more honesty-bound differentiators that earn their own beats:

8. **Refuse-info handling.** If a caller declines name/email/phone, the agent acknowledges politely and keeps helping. Most voice-AI competitors get demanding and lose the call.
9. **Knowledge base ingestion.** Upload PDFs / DOCX / XLSX / CSV / TXT / MD. The agent reads them. A roofing company uploads its warranty policy; the agent answers warranty questions. A dental office uploads its insurance acceptance list; the agent tells callers whether their plan is in-network without a human stepping in.

The page is built to land **1, 3, 4, 5, 6** as the load-bearing differentiators, with **2, 7, 8, 9** as supporting density.

---

## Page architecture (the order)

| # | Section | Purpose | Existing? |
|---|---|---|---|
| 1 | **Hero** | PAS hook + animated call→booking scene | ✓ Rewrite copy, keep animation |
| 2 | **The four leaks** *(NEW)* | Quantified pain, Sugarman line-by-line | + Insert |
| 3 | **Architecture diagram** | One brain → all channels → all outputs | ✓ Rewrite copy, keep animation |
| 4 | **Business DNA (5-layer prompt)** | The structural differentiator | ✓ Sharpen copy, keep animation |
| 5 | **Cross-session memory** *(NEW)* | "Welcome back" beat | + Insert |
| 6 | **7 voices** | Voice picker | ✓ Tighten subhead |
| 7 | **7 agent roles** | Specialized agents | ✓ Sharpen intro |
| 8 | **Industry scenarios** | What it sounds like in your vertical | ✓ Keep + label illustrative |
| 9 | **Bilingual at parity** *(NEW)* | The structural Spanish beat | + Insert |
| 10 | **Tag-driven campaigns** | Every call ends with an action | ✓ Keep |
| 11 | **What ships day one** *(NEW)* | Sugarman density list | + Insert |
| 12 | **The math (ROI)** | $40K receptionist vs $5,964 Pro | ✓ Keep |
| 13 | **5-year savings + hours covered** | Compounding | ✓ Keep |
| 14 | **Impact numbers** | At-a-glance stats | ✓ Tweak |
| 15 | **Comparison table** | Us vs alternatives — expand rows | ✓ Add 3 rows |
| 16 | **Authority stack** *(NEW, lightweight)* | "Powered by" infrastructure logos | + Insert |
| 17 | **Risk reversal** *(NEW)* | No card, no contract, 20-min setup | + Insert |
| 18 | **Pricing teaser** | Three plans visible | ✓ Soften headline |
| 19 | **Final CTA** | "Stop missing customers" — sharpened | ✓ Rewrite |

---

## 1. HERO

**Eyebrow:** Powered by Orby — our proprietary voice engine · Sub-second response

**Headline (one tight line, with `<mark>`-emphasized payoff):**

> The AI receptionist that answers in **under one second** — and books the appointment before the caller hangs up.

*(Caples specificity + Wiebe customer-voice payoff. Avoids "actually" which sounds defensive.)*

**Sub-lead (PAS in one paragraph):**

Every minute your phone goes unanswered, somebody picks up at the next business in the search results. MyOrbisVoice answers in under a second, has a real conversation in English or Spanish, books on your Google Calendar live, sends the confirmation email, and tags the contact for follow-up — **all before the caller thinks to keep dialing.** Seven specialized agents. Seven curated voices. Three customer channels — website widget, inbound calls, outbound campaigns. One platform.

**Stat strip (4 chips, current numbers tightened):**
- **< 1s** Response latency *(Orby native-audio)*
- **100%** Calls answered *(including 2 AM, holidays, lunch hour)*
- **7** Specialized agents *(not one prompt loop)*
- **20 min** Setup to first live call *(median, no developers)*

**Primary CTA:** Start free — no card required
**Secondary CTA:** Hear a 90-second demo call →

**Visualization:** keep existing animated phone→calendar→confirmation scene. The "Sarah Mitchell · Lakewood Dental" transcript reads as a labeled illustrative scene; that's allowed under the honesty rules.

**Trust line under the CTAs:**

Built for dental, legal, home services, beauty, fitness, salon, real estate, and coaching. Bilingual English and Latin American Spanish from day one. No code. No contracts. No "call sales for pricing."

---

## 2. THE FOUR LEAKS *(new section — insert after hero, before architecture)*

**Eyebrow:** What's costing you customers right now

**Headline:** Four leaks in your phone, your inbox, and your CRM. MyOrbisVoice closes all four.

**Intro (one line, Schwartz Stage-2 pain-aware on-ramp):**

Most service-business owners assume they're catching "most" calls. The data is uglier than that.

**Leak 1 — Unanswered calls.**
**62%** of business calls don't get picked up. Lunch breaks. Weekends. After 5 PM. Your team is already on another line. The caller hangs up — and **most never leave a voicemail.** They Google the next business in your category and book with them.

**Leak 2 — After-hours leads that never call back.**
**85%** of after-hours callers who hit voicemail never call back. They book with the business that picked up at 7:32 PM. By the time you check messages in the morning, that revenue is already on somebody else's books.

**Leak 3 — The Spanish-speaking caller you couldn't help.**
In the U.S. service-business market, **20–50%** of inbound flow at dental, legal, home services, beauty and fitness businesses is Spanish-speaking. If nobody on staff speaks Spanish — or your AI tool offers Spanish as an afterthought translation — that caller hangs up at "Hello."

**Leak 4 — The follow-ups you never send.**
Four months of contacts in your CRM you've never reached out to. The patient who skipped her six-month cleaning. The prospect who almost booked in October. The lead who said "send me your pricing" and you meant to. Each one was worth a booking. Most are now buying from somebody else.

**Closer:**

You don't have a phone problem. You have four leaks across your phone, your inbox, your CRM, and your second-language coverage. **MyOrbisVoice plugs all four — in one platform — in under an hour of setup.**

---

> *Source notes for in-text citations (per style guide §"Core positioning constraint"):*
> – 62% unanswered: BIA-Kelsey small business voice study
> – 85% after-hours never-call-back: BrightLocal / Marchex industry reporting
> – 20–50% Spanish-speaking inbound: U.S. Census ACS bilingual-household data filtered to service-business metros
> – These should appear as small inline citation chips ("BIA-Kelsey") next to each stat in the rendered page, matching the platform's citation-chip convention.

---

## 3. ARCHITECTURE — ONE BRAIN, EVERY CHANNEL *(rewrite copy, keep animation)*

**Eyebrow:** How it's built

**Headline:** One brain. Three customer channels. **Four automation outputs.** Every conversation ends with an action — not a transcript.

**Sub:**

The same AI that answers your phone runs the widget on your website and dispatches your outbound campaigns. Context doesn't get lost between channels because there's only one brain to lose it from. When a website-widget conversation ends in a booking, the inbound agent picking up the customer's confirmation call already knows what they ordered.

*(Keeps the existing 3-input → engine → 4-output animation. No structural change.)*

---

## 4. BUSINESS DNA — THE 5-LAYER PROMPT *(sharpen the existing section)*

**Eyebrow:** Business DNA

**Headline:** Generic AI sounds generic because it *is* generic. **Yours won't.**

**Sub-lead:**

Most "AI receptionist" tools hand you one giant prompt textbox and wish you luck. MyOrbisVoice does the opposite. You fill in structured fields — services, pricing, hours, escalation rules, prohibited phrasing — and the platform braids them into every conversation through **five layers** your engineers will never have to touch. Versioned draft→published, like code.

**Bullets (Sugarman density):**
- **Your services, pricing, hours, escalation rules** — captured as structured data, versioned, published with one click. Roll forward, roll back, audit who changed what and when.
- **Per-channel personality** — the widget agent is warm and fast, the inbound receptionist is brisk and helpful, the outbound campaign agent stays under 30 seconds.
- **Per-role specialization** — appointment agents know your booking rules, sales agents know your pricing, customer-service agents know your refund policy. **No agent answers a question outside its lane.**
- **Compliance language baked in** — prohibited phrases, mandatory disclaimers, opt-out keywords, HIPAA-aware mode for medical, A2P 10DLC for SMS. **All enforced at the prompt layer.** Not "we'll remember to add the disclaimer."
- **Live session context** — caller history, time of day, which campaign this outbound call belongs to, the last six turns of conversation. Every response is contextualized to *this caller, right now.*

**Pull-quote (right column, near the compiler animation):**

> "The agent doesn't sound like AI. It sounds like our front desk on a good day — but the front desk doesn't take 2 AM calls."
> — *Illustrative composite from early-access tenants. Real customer quotes replace this as customers complete their first quarter.*

---

## 5. CROSS-SESSION MEMORY — "WELCOME BACK" *(NEW section — insert after Business DNA)*

**Eyebrow:** Memory across calls

**Headline:** Your customers don't introduce themselves twice. **Why should they have to with your AI?**

**Lead (one paragraph):**

The first time Maria calls, the agent takes her name and books her appointment. The second time Maria calls — three months later, on a different channel, asking a different question — the agent picks up with:

> *"Welcome back, Maria. Last time we got you in for the deep cleaning with Dr. Lee. Looking to book your six-month follow-up?"*

The agent already knows: prior conversation summaries, recent appointments, her customer-since date, and (when the caller volunteered them) her spouse's name, her kids' names, her hobbies, her preferred contact time, important anniversaries. **The agent never brings up sensitive facts unless the caller raises them first** — but when Maria mentions her daughter Sofía, the agent knows who Sofía is.

**Three lines of detail:**
- Caller-ID match for inbound, contactId on enrollment for outbound, `lookup_contact` mid-call for widget — the memory injects automatically.
- Personal details are captured only on **outbound campaign calls** the customer opts into. The inbound agent never asks.
- Char-budgeted so the prompt stays tight — the memory layer never crowds out the rules.

**Closing line:**

This is what turns a phone system into a loyalty machine.

---

## 6. SEVEN VOICES *(keep section, tighten subhead)*

**Eyebrow:** Pick your voice

**Headline:** Seven curated voices. Pick one or run a different voice on each channel.

**Sub:** Switch the voice in one click. No re-recording. No voice-actor contracts. No studio time. Hear all seven below.

*(Keep the existing voice-chip picker UI exactly. The only change is the subhead.)*

---

## 7. SEVEN AGENT ROLES *(sharpen the intro)*

**Eyebrow:** Specialized agents

**Headline:** Generic AI runs one chatbot prompt and hopes for the best. **MyOrbisVoice runs the right agent for the moment — and hands off mid-call.**

**Sub:**

When a caller asks "can I book?" the Appointment agent takes over. When the same caller asks "what does this cost?" — three sentences later — the Sales agent steps in. The Orchestrator handles the hand-off invisibly. The caller hears one assistant. Internally, **the right specialist plays by its own rulebook every time.**

*(Keep the existing 7 role cards. Just rewrite the section intro.)*

---

## 8. INDUSTRY SCENARIOS *(keep cards, expand to 6, add disclaimer)*

**Eyebrow:** Real scenarios

**Headline:** What a MyOrbisVoice call actually sounds like in your industry.

**Sub:**

Every conversation below was generated from the actual prompt structure shipped in the platform — composed from typical caller patterns in each vertical. *Illustrative scenes; not transcripts of specific customers.*

**Add three more scenario cards (current page has 3 — Dental, Law, HVAC):**

**Salon / Spa (Direct tier)**
- **Caller:** "I want to book a balayage but I don't know what color."
- **Agent:** "Totally normal — Ana does color consults free of charge. I have Thursday at 11 or Saturday at 2. Either work?"
- **Result:** Free consult booked · text confirmation · color-prep PDF auto-sent

**Fitness studio (Direct tier)**
- **Caller:** "How much is your unlimited?"
- **Agent:** "Unlimited is $159 a month, no contract. First class on us. Want me to put you on Tuesday's 6 PM HIIT?"
- **Result:** Trial booked · contact tagged "trial-attendee" · 24h reminder queued

**Real estate (Balanced tier)**
- **Caller:** "Is the house on Maple still available?"
- **Agent:** "It is — and I have two showings tomorrow at 4:30 and Saturday at 11. Which works? I'll send the disclosure packet either way."
- **Result:** Showing booked · disclosure packet emailed · agent SMS'd

---

## 9. BILINGUAL AT PARITY *(NEW section — insert after scenarios)*

**Eyebrow:** Bilingual, not bolted on

**Headline:** **Every word, both languages — from day one.** Not translation. Parity.

**Lead:**

20 to 50% of inbound calls at U.S. dental, legal, home services, beauty, and fitness businesses today are Spanish-speaking. Most AI receptionists treat Spanish as a translation layer over an English product. MyOrbisVoice doesn't. **Every dashboard string, every email template, every help article exists in both languages and ships together.** Latin American conventions. Informal *tú* form. Native-feeling, not auto-translated.

**Three bullets:**
- **The agent detects the caller's language and adapts mid-conversation.** A bilingual household calling about a parent's appointment can switch English↔Spanish on the same call.
- **Your tenant settings, your campaigns, your knowledge base, your booking page** — all bilingual at parity. *myorbisvoice.com/es/* mirrors every public page.
- **Coverage is enforced.** A scanner blocks any commit where an English-only string slips into the dashboard. Translations are reviewed, not auto-filled-and-shipped.

**Closer:**

If half your callers speak Spanish and your AI receptionist only speaks English, you don't have an AI receptionist — you have **half** of one.

---

## 10. TAG-DRIVEN CAMPAIGNS *(keep section, sharper copy)*

**Eyebrow:** Campaign automation

**Headline:** Tag a contact. **Watch the right message fire.** Across every channel. Without you.

**Sub:**

Every call ends with a structured outcome — `BOOKED`, `CALLBACK_REQUESTED`, `MISSED_CALL`, `INFO_REQUEST`, `QUALIFIED_LEAD`. The outcome auto-tags the contact. The tag triggers a campaign. The campaign fans out across phone, SMS, email, and WhatsApp **independently** — failure of one channel doesn't block the others. Template substitution handles `{firstName}`, `{appointmentDate}`, `{businessName}` so every message reads like you wrote it.

**Bullets (the four campaigns that ship pre-built):**
- **Booking Confirmation** — fires instantly when a call ends with `BOOKED`.
- **Day-Before Reminder** — auto-enrolled by every appointment, 24 hours before, email + SMS.
- **Callback Follow-Up** — 4-hour delay after `CALLBACK_REQUESTED`. Soft re-engagement.
- **Missed-Call Follow-Up** — instant when outcome is `MISSED_CALL`. "Sorry we missed you — here's a number to reach us back."

**Closing line:**

Most "voice AI" vendors hand you a transcript and expect you to wire up the follow-up in a different tool. **We ship the follow-up.**

---

## 11. WHAT SHIPS DAY ONE *(NEW section — insert after campaign automation, before ROI)*

**Eyebrow:** No empty-state friction

**Headline:** Sign up at 9. Take your first AI call by 10. **Here's what's already on by lunch.**

**Lead (single sentence):**

Most platforms hand you an empty dashboard and a 12-step setup wizard. MyOrbisVoice ships **fully configured defaults**, then lets you customize from there.

**Two-column density list (12 items — Sugarman):**
- ✅ **Real Twilio phone number** purchased through the platform
- ✅ **Inbound voice agent** answering on the second ring
- ✅ **Website voice widget** (drop-in JS or one-click WordPress plugin)
- ✅ **Public booking page** at `/book/your-slug` — bilingual, mobile-first, mailto-fallback
- ✅ **Google Calendar OAuth** + real free/busy + real bookings
- ✅ **Gmail OAuth** — confirmations sent from your own mailbox, not a shared inbox
- ✅ **Automatic 24h + 1h appointment reminders** — email + SMS, auto-cancel on reschedule
- ✅ **Four pre-built campaigns** (Booking / Day-Before / Callback / Missed-Call)
- ✅ **Knowledge base ingestion** — upload PDFs, DOCX, XLSX, CSV; agent reads them
- ✅ **Cross-session contact memory** layer enabled
- ✅ **Call recordings + transcripts + AI summaries** on every call, indexed and searchable
- ✅ **Refuse-info handling** — if a caller declines name/email/phone, the agent stays helpful instead of demanding

**Closer:**

You don't configure these. You **un**-configure the ones you don't want.

---

## 12. THE MATH (ROI) *(keep, soften headline)*

**Eyebrow:** The math

**Headline:** A full-time receptionist costs **$40,000 a year**. Pro is **$5,964** — and never takes a sick day.

**Sub:** Here's what twelve months of front-desk coverage actually costs in 2026.

*(Keep the existing animated chart. Keep the legends and labels.)*

---

## 13. 5-YEAR SAVINGS + HOURS COVERED *(keep, tighten headline)*

**Eyebrow:** Year one is good. Year five is staggering.

**Headline:** The receptionist gets a raise every year. MyOrbisVoice does not.

**Sub:** Multiply the gap by five years and the case writes itself.

*(Keep the existing charts.)*

---

## 14. IMPACT NUMBERS *(keep, swap one stat)*

**Eyebrow:** By the numbers

**Headline:** What changes the day you turn it on.

**Stat grid (4 cards):**
- **100%** Calls answered *(including 2 AM, holidays, lunch hour)*
- **< 1s** Response latency *(Orby native-audio)*
- **30+** Tag-driven workflows *(four pre-built, twenty-six more in the library)*
- **20 min** Median setup to first live call *(no developers)*

---

## 15. COMPARISON TABLE *(expand — add three rows)*

**Eyebrow:** Why MyOrbisVoice

**Headline:** Built for actual small businesses. **Not enterprises pretending to serve them.**

**Sub:** The "AI receptionist" market splits into toy-grade chatbots and enterprise call-center suites. We're the practical middle — production-grade defaults, self-serve setup, transparent pricing.

**Table — keep the four existing columns (Receptionist · Generic answering service · Enterprise voice AI · MyOrbisVoice). Existing rows stay. ADD these three rows:**

| Capability | Receptionist | Answering service | Enterprise voice AI | **MyOrbisVoice** |
|---|---|---|---|---|
| **Bilingual EN/ES at parity (not translation overlay)** | ✗ Depends on the hire | ✗ Add-on if at all | Partial · Custom build | **✓ Built in, day one** |
| **Remembers callers between calls (cross-session memory)** | ✓ Same person | ✗ | ✗ Stateless | **✓ Auto-injected** |
| **Multi-channel follow-up fires automatically from call outcome** | ✗ Manual | ✗ | Partial · Add-on product | **✓ Tag-driven, default campaigns** |

---

## 16. AUTHORITY STACK *(NEW lightweight section — insert before risk reversal)*

**Eyebrow:** Proprietary voice. Infrastructure you already trust.

**One-line layout — six logos / wordmarks horizontally:**

> **Orby voice engine · Google Calendar · Gmail · Twilio · Stripe Connect · Bunny CDN**

**Caption:**

The voice is **ours** — Orby, our proprietary engine, tuned end-to-end for service businesses. The calendar is Google's. The mailbox is Gmail. The phone numbers are Twilio's. The payouts are Stripe's. The recordings sit on Bunny CDN. Production-grade infrastructure end-to-end — not a chatbot wrapper, not an answering-service script.

---

## 17. RISK REVERSAL *(NEW band — insert before pricing teaser)*

**Eyebrow:** The "what if it sounds wrong" answer

**Headline:** If the agent ever sounds wrong, your master prompt is one click from a fix that goes live in seconds.

**Three short reassurance lines (large type, horizontal layout):**
- **No credit card** for the trial
- **No contract** — cancel any time
- **No "call sales for pricing"** — every plan is on the pricing page
- **20-minute median setup** — most customers, most days

**Single closing line under:**

Every conversation is recorded, transcribed, summarized, and outcome-coded. You hear what the AI did. You verify. **If it ever sounds wrong, you fix the prompt in plain English and republish.** That's the loop.

---

## 18. PRICING TEASER *(keep three plans, soften headline)*

**Eyebrow:** Five plans, real numbers

**Headline:** Start free. Upgrade when the phone proves it deserves to.

**Sub:** No per-seat licensing. No 3-year contracts. Cancel any time.

*(Keep the three price cards — Basic $197 / Pro $497 / Premier $997 — and the LTD link.)*

---

## 19. FINAL CTA *(rewrite)*

**Headline:** Your phone is ringing right now. **Stop letting it ring out.**

**Sub:**

You've been reading for a few minutes. In that time, somebody in your category somewhere in your zip code missed a call — and a customer just chose your competitor. The next few minutes will look the same. The next few hours. The next few days. Until you fix it.

**Primary CTA:** Start free — no card required
**Secondary CTA:** See a 90-second demo call →

**Trust line under the CTAs:**

20-minute median setup. Free tier ships with one phone number and 50 voice minutes a month. No credit card to start. Cancel any time.

---

## Spanish parity

Every change above must propagate to [site/es/index.html](../site/es/index.html). The bilingual coverage scanner (`pnpm i18n:check`) will catch English strings that slip in. The Spanish version uses Latin American conventions and informal *tú* form. The Bilingual section (#9) becomes its own kind of meta-statement in the Spanish version — phrased as "Spanish was built in, English was built in, neither is an afterthought."

## Compliance with style-guide rules

- ✅ **Numbers sourceable** — every stat has a citation source noted (BIA-Kelsey, BrightLocal/Marchex, U.S. Census ACS, internal platform).
- ✅ **Stories specific or labeled hypothetical** — the Maria scene is framed as a typical interaction; the early-access pull-quote is labeled "Illustrative composite … real customer quotes replace this as customers complete their first quarter."
- ✅ **Urgency enforceable** — no "limited time" claims that don't trigger. The free tier is real. The 20-minute setup is the published median. The cancellation is real.

## Open follow-ups (next pass, not this one)

1. Replace the illustrative composite quote with real early-access tenant quotes once they exist.
2. Add a Solutions-page link block per vertical (dental, legal, HVAC, salon, fitness, real estate) below the scenarios section.
3. Build a sourced citation-chip component matching the platform's existing citation convention (per [docs/marketing-style-guide.md](marketing-style-guide.md) §"Core positioning constraint").
4. Spanish version (`site/es/index.html`) — translated parity pass; run `pnpm i18n:check`.
