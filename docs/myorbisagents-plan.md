# MyOrbisAgents.com — Product Idea Plan

**Status:** Idea session only (2026-06-30). No code. Captured for later review.
**Owner:** Crawford Peterson
**Relationship to portfolio:** New vertical product under the MyOrbisResults
umbrella, **built on the MyOrbisVoice engine** (gateway, prompt stack, Twilio,
Gemini Live, n8n orchestration). Sibling to MyOrbisVoice / MyOrbisLocal /
MyOrbisBiz — its own positioning, copy, and audience.

---

## 1. One-line

An AI inside sales agent (ISA) + receptionist for **real estate agents** —
answers every call/text/web lead instantly, knows the listings, books showings,
nurtures buyers and sellers, and sends seller updates automatically.

## 2. Why this wins (positioning)

- **Real estate is THE speed-to-lead market.** First agent to respond usually
  wins the deal. Most agents are in showings, on calls, or asleep when a lead
  comes in. An always-on AI that responds in seconds is a direct revenue lever.
- **ROI is absurd in the customer's favor.** A single closed deal = thousands in
  commission. $297/mo is rounding error against one extra deal a year.
- **Replaces / augments a human ISA.** A human inside sales agent costs
  $3,000–$5,000/mo. The pitch: "Your AI ISA for $297." That's the anchor.
- **Bilingual = real edge.** Large Spanish-speaking buyer segment; a fluent
  Spanish voice agent is a differentiator most competitors don't have. Fits the
  MyOrbis bilingual mandate (ship EN + ES together).

## 3. Ideal customer (ICP)

- **$297 Solo** — active solo agent doing ~10–40 transactions/yr.
- **$497 Solo Power** — solo *power producer* who wants the full automation +
  unlimited listings + integrations. Still one person (1 seat).
- **Brokerage tier (future)** — teams + brokerages (multi-seat, routing,
  white-label). All team features live here, not in $497.
- Channel: brokerages and team leads who resell to their downstream agents (reuse
  the MyOrbisResults partner program).

## 4. Pricing (proposed)

### What "listings" means here (important)

Listings on the platform are the **agent's own property book that they add** —
their existing portfolio: active listings, coming-soon, pocket/private listings,
rentals they manage, plus past/relisted inventory. Each added property becomes a
**working unit**: a listing-aware voice/text agent that knows that property, its
own tracking number, a property landing/widget, and showing-booking rules. The
Listing is the core entity of the product, not a side attribute.

This makes the **count gate real**, not cosmetic: an active or team agent's full
book easily reaches 20+ once you count active + coming-soon + managed + pocket
inventory. "≤20 listings" is a genuine capacity line, and a producer who exceeds
it is exactly the customer who should be on Pro.

### Still — pair the count gate with capability

Count is a clean, honest gate, but don't make it the *only* difference. A growing
agent/team needs the team + automation + integration features regardless of how
many properties they hold. So the ladder is **count AND capability**, pointing the
same direction: bigger book → bigger business → wants the Pro feature set.

### Tier structure (decided 2026-06-30)

Three tiers, each with a distinct job. **$297 and $497 are both SOLO (1 seat).**
Teams/multi-seat is its own Brokerage tier — that's the Brokerage tier's reason to
exist, and it keeps the solo tiers from competing on team features.

| | **Solo — $297/mo** | **Solo Power — $497/mo** | **Brokerage — TBD** |
|---|---|---|---|
| Who | active solo agent | solo power producer | teams / brokerages |
| Theme | **Capture** — answer, track, book | **Convert & Manage** | **Scale the team** |
| Seats | 1 | 1 | multiple |
| Listings | up to 20 | unlimited | unlimited (pooled) |
| Team routing | — | — | **round-robin / first-to-claim** |
| White-label | — | — | **brokerage branding** |

### What separates $497 from $297 (capability, not team)

Both are one-person accounts. The jump is automation + volume + integrations:

| | **Solo — $297** | **Solo Power — $497** |
|---|---|---|
| Listings | up to 20 | unlimited |
| Phone numbers | 1 main number | main + **per-listing tracking-number pool** |
| Voice agent | answer, book, confirm, remind, objection handling | everything in Solo |
| Call tracking / transcripts / summaries / caller details | ✅ (engine baseline) | ✅ |
| Nurture automation | basic follow-ups | **full buyer/seller drip + database reactivation** |
| Missed-call text-back | ✅ | ✅ |
| Valuation seller magnet | — | ✅ |
| Seller updates | — | **automated weekly reports** |
| CRM sync | — | **Follow Up Boss / kvCORE / …** |
| Transaction-coordinator mode | — | **milestone reminders to all parties** |
| Included minutes / numbers | base cap | higher cap |
| Setup / support | self-serve | **done-for-you setup + priority support** |

One-liner for the site: **$297 captures and tracks every lead; $497 converts and
manages them.** Both for the individual agent — teams move up to Brokerage.

**Notes / open questions:**
- **Meter minutes/numbers under the hood.** The real cost driver is call/SMS/voice
  minutes + phone numbers, not listings. Each tier gets included minutes + a
  number allowance, with overage — so a heavy $297 user can't run negative margin.
- **Brokerage tier (now confirmed as the 3rd tier, pricing TBD):** multi-seat,
  round-robin routing, shared/pooled number pool, brokerage white-label branding,
  manager analytics. Higher ACV + the resale channel. This is where all *team*
  features live — they are deliberately NOT in $497.
- Annual discount + a **setup/onboarding fee** (agents expect done-for-you setup;
  a fee filters tire-kickers and funds white-glove onboarding).
- **Free wedge for the partner channel:** a "listing concierge" demo number an
  agent can try on one listing (mirrors the MyOrbisBiz audit/eval wedge).

### $497/mo — "Solo Power: Convert & Manage" — full package (canonical)

1 seat, solo agent. Everything in $297 plus the convert/manage layer.

**Engine baseline (inherited from MyOrbisVoice — see §8):**
- Full call transcripts + recordings; AI call summaries
- Caller/contact capture → CRM record; conversation history across channels
- Call outcomes/dispositions + sentiment/intent tagging
- Lead capture + consent/opt-in records (A2P/TCPA evidence)
- Notifications + reporting/analytics; audit logs; voice selection; Business DNA + prompt stack

**Listings:**
- Unlimited listings
- Add by MLS# pull (licensed feed) + CSV/account-connect for the whole book +
  public-records enrichment for off-MLS
- Full **Connections hub** — bring your own MLS / IDX / data / lead / CRM subs (§6)
- AI listing descriptions, property landing/widget, social posts (bilingual)

**Phone + channels:**
- Main number + per-listing tracking-number pool (count TBD)
- Voice, SMS, email, web widget — one persona, shared context

**Voice agent (full Orby):**
- Inbound + outbound + warm transfer
- Booking, schedule changes, confirmations, follow-ups, reminders
- Objection handling, sales-agent mode, secretary mode

**Lead automation + growth:**
- Buyer/seller nurture drips
- Database reactivation + circle-prospecting lists
- Missed-call text-back
- Open-house capture + same-night follow-up
- Instant home-valuation seller magnet (grows the book)

**Seller deliverables:**
- Automated weekly seller-update reports
- Per-listing call attribution ("your listing got 14 calls this week")

**Post-contract:**
- Transaction-Coordinator mode — milestone reminders to all parties

**Integrations:**
- CRM sync (Follow Up Boss first, then kvCORE/BoomTown/Sierra)
- Google Calendar booking

**Language:** EN+ES UI; conversational multi-language (~6–10 per agent) + auto-detect

**Compliance (enforced):** Fair-Housing guardrails, DNC/TCPA scrub, A2P, recording
consent, AI disclosure

**Support:** done-for-you onboarding + priority support

**Usage allowances — TBD (margin levers, set after a Twilio/Gemini cost model):**
- Included voice minutes — ~1,500/mo proposed, overage per min
- Included SMS segments — ~2,000/mo proposed, overage per segment
- Tracking numbers included — ~10 proposed
- Off-MLS/valuation lookups — capped, overage

**Not in $497 (lives in Brokerage tier):** multiple seats, round-robin routing,
white-label branding, pooled numbers, manager analytics.

### $297/mo — "Solo: Capture" — full package (canonical)

1 seat, solo agent. The engine baseline + core capture/book. Strips out the
$497 convert/manage automation layer.

**Engine baseline (same as $497 — it's how the product works):**
- Full call transcripts + recordings; AI call summaries
- Caller/contact capture → CRM record; conversation history across channels
- Call outcomes/dispositions + sentiment/intent tagging
- Lead capture + consent/opt-in records; notifications; reporting/analytics
- Audit logs; voice selection; Business DNA + prompt stack

**Core capture / book:**
- **All 4 channels** — voice, SMS, email, web widget (channels aren't the gate)
- **1 main phone number** — inbound + outbound + warm transfer
- Voice agent: answer, book, confirm, remind, follow-up, objection handling, secretary mode
- **Up to 20 listings**, added by MLS# pull — **single MLS connection** (their own book)
- **Missed-call text-back** (baseline, both tiers)
- **EN + ES** conversational + UI
- Compliance enforced — Fair Housing, DNC/TCPA, A2P, recording consent, AI
  disclosure (legal, not optional → in both tiers)
- Self-serve onboarding

**Confirmed scope lines (2026-06-30):**
- **Languages:** EN + ES only. The ~6–10 conversational language set is a $497 upsell.
- **Outbound:** confirmations / reminders / follow-ups only. Automated *prospecting
  campaigns* (database reactivation / circle prospecting) are $497.
- **Numbers:** 1 main number only. Per-listing tracking-number pool is $497.

**Not in $297 (the $497 convert/manage layer):** unlimited listings, per-listing
tracking-number pool, full Connections hub, full nurture drips, database
reactivation / circle prospecting, valuation seller magnet, automated weekly seller
reports + per-listing call attribution, Transaction-Coordinator mode, CRM sync,
languages beyond EN+ES, done-for-you setup.

**Usage allowances — TBD (cost model):** ~500 voice min / ~750 SMS / 1 number proposed.

**The line:** $297 = *capture, track, book* (every lead answered, recorded,
contacted, booked — 20 listings, EN+ES). $497 = *convert & manage*.

## 5. Features & Benefits

### Confirmed (from the brief)

1. **Phone number** — inbound, outbound, transfers (warm transfer to the agent
   or team member when the lead is hot / asks for a human).
2. **Omnichannel** — email, SMS, voice, web page widget. One agent persona
   across all four; conversation context carries across channels.
3. **Voice agent capabilities** — bookings, schedule changes, confirmations,
   follow-ups, reminders, objection handling, sales-agent mode, secretary mode.
4. **Listing ingestion** — agent adds a property by **MLS number or address**;
   we pull the full structured record from a licensed MLS feed (not by scraping
   portals). The agent's voice/text agent then knows that property and can answer
   buyer questions + book showings for it. Off-MLS properties (FSBO, foreclosure,
   pocket, land) are seeded from public-records APIs + confirmed.
   **(See §6 — pull from the source, not the portals.)**

### Proposed adds (my ideas)

- **Per-listing tracking numbers.** Each listing gets its own number for sign
  riders / flyers / portal ads. Calls are attributed per listing → the agent can
  show the seller "your listing got 14 calls this week." Sellers love proof of
  marketing effort; this alone can justify the subscription on listing
  presentations.
- **Automated seller updates.** Weekly auto-report per active listing: calls,
  showings booked, buyer feedback, web views. Agents universally hate doing this
  by hand and clients universally complain they don't get it. Big retention hook.
- **Showing coordination.** Book/confirm/reschedule showings; integrate with
  ShowingTime / lockbox flows where possible; collect + summarize buyer feedback
  after the showing automatically.
- **Buyer + seller nurture sequences.** Long-horizon drip (buyers take months).
  "New listings that match your criteria" follow-ups; price-drop alerts on
  saved searches.
- **RE-CRM sync.** Follow Up Boss, kvCORE, BoomTown, Sierra Interactive,
  LionDesk, Lofty/Chime. Agents live in these; if we don't sync, we're a silo.
  This is table stakes for serious agents.
- **Team round-robin / lead routing.** Route inbound leads to the next available
  agent; first-to-claim; manager override. Needed for the team/brokerage tier.
- **AI disclosure + human-in-the-loop.** Agent identifies as an AI assistant;
  hot leads escalate to the human fast. Trust + compliance.
- **Listing concierge via sign-rider text.** Buyer texts the number on the yard
  sign → instant property facts + "want to see it? I can book you in." Classic
  RE conversion motion, fully automated.

## 6. Listing ingestion — pull from the source, not the portals

**The key insight: don't touch Zillow / Realtor.com / Redfin at all.** Those
portals are *downstream resellers* of MLS data. The agent already belongs to the
upstream source — their MLS. Pulling from the MLS the agent is a member of
sidesteps the scraping/ToS problem entirely, gives cleaner structured data, and
comes with **licensed photos** (scraping portal photos is copyright infringement;
feed photos are not). Scraping is removed from the plan as a backbone.

### The clean flow

**Agent types their MLS listing number (or address) → we fetch the full
structured record from a licensed MLS feed.** No manual data entry, no scraping.
Beds/baths/price/sqft/status/description/photos all arrive structured + licensed.

### Getting the feed without integrating 600 MLSs

Use an aggregator that brokers the per-MLS licensing so we integrate **one** API,
not hundreds:

- **MLS Grid** — RESO-standard, broad coverage, single data agreement. Strong default.
- **Trestle (CoreLogic)** — widest coverage, RESO Web API, paid.
- **SimplyRETS** — easiest for MVP: demo/sandbox data on day one, they handle the
  per-MLS approvals, clean REST. Good to build + demo against immediately.
- **Bridge Interactive** (Zillow Group) — free RESO Web API access to many MLSs,
  apply per-MLS.
- **Spark API / FBS** — for Flexmls-powered MLS markets.

Per-MLS approval is the real friction (each MLS must greenlight the data license);
the aggregators exist specifically to shoulder that.

### Rights model (what keeps us clean)

- **The agent's OWN listings** — fullest rights; it's their data. The primary,
  cleanest case, and the day-one source (they add their book — see §4).
- **Other MLS listings** (for buyer search / Q&A) — allowed under **IDX**
  licensing, but follow display + attribution rules (no commingling, source
  attribution, etc.).

### Enrichment / off-MLS fallback

For FSBO, foreclosure, pocket, land, or anything with no MLS record — **public-
records property APIs keyed by address** (legitimately licensed, no scraping):
**ATTOM Data**, **Estated**, **Rentcast / RealEstateAPI**, **Regrid** (parcels).
Returns beds/baths/sqft/year built/lot/tax/AVM. Good enough to seed a listing the
agent confirms.

### Agent-owned shortcut

Let the agent **connect their MLS/IDX account** or **upload their MLS export
(CSV)** — most MLSs let a member export their own listings. It's their data; zero
gray area. Great for bulk-loading the whole existing book on onboarding.

### Ingestion ladder (priority)

1. **MLS# / address → licensed MLS feed** (primary; via MLS Grid / Trestle / SimplyRETS).
2. **Agent connect / CSV export** of their own book (bulk onboarding).
3. **Public-records API enrichment** (off-MLS, FSBO, pocket, land).
4. **Copy-paste / manual** — last resort only, agent-confirmed.
5. **Portal scraping — never.**

**Marketing framing:** "Add your listings in seconds — type the MLS number, we
pull the rest." True, licensed, and reliable, vs. paste-and-pray.

### Data-sourcing cost (to MyOrbisAgents)

Yes, there's a cost — but it's mostly small, and one model makes it near-zero.

**Two cost models:**

1. **We license the data (we pay).**
   - MLS aggregators: subscription + per-MLS fees. SimplyRETS / MLS Grid roughly
     tens–low-hundreds $/mo; Trestle (CoreLogic) enterprise/pricier. **Bridge
     Interactive (Zillow Group) API is often $0**, but each MLS must approve and
     **some MLSs charge their own feed fee** regardless of vendor.
   - Public-records APIs (off-MLS): pay-per-lookup, cents each (Estated / Rentcast
     / RealEstateAPI cheap, free tiers; ATTOM enterprise/pricier).
2. **The agent authorizes their own MLS feed (near-zero to us).** The agent is
   already an MLS member with data rights; the vendor pulls under the agent's
   authorization. Their membership covers the data — we ride an entitlement they
   already pay for. Cleanest legally (their data) and cheapest for us.

**Cost shape that matters for margin:**

- MLS feed cost is mostly **fixed/subscription, not per-listing**. Once a market's
  feed is on, 20 vs unlimited listings costs the same → this is *why* "unlimited
  listings" on the $497 tier is cheap to offer.
- Public-records lookups are **per-call** (scale with off-MLS pulls) → cents; cap
  them per tier.
- The real recurring costs in this product are **Twilio numbers + voice/SMS
  minutes + Gemini**, not data. Data pull is usually the smaller line item.

**Recommendation:** default to **Model 2** (agent-authorized → ~$0 data cost for
their own listings). Only buy aggregator coverage (Model 1) when we want
platform-wide IDX *buyer search* across other agents' listings.

*(Vendor price ranges above are approximate, ~2025–26 — verify current pricing +
each MLS's own fee before modeling margins.)*

### Bring-your-own connections (agents wire in their existing subscriptions)

Agents already pay for data — let them connect it, on top of what we provide.
This is strictly good for us: lower cost, better data, stickier, cleanest rights.

**What they can wire in:**
- **Their MLS membership / IDX feed** — pull under *their* license (Model 2 above,
  ~$0 to us, cleanest legally).
- **IDX vendors** they run — kvCORE, IDX Broker, iHomefinder, Realtyna.
- **Paid data / lead subs** — PropStream, ATTOM, CoreLogic, Remine, BatchLeads
  (skip-trace), **REDX / Vulcan7** (FSBO + expired). These feed the database-
  reactivation + FSBO/expired prospecting features: agent brings the data → swarm
  builds the list → Orby dials (DNC-scrubbed).
- **Lead sources** — Zillow Premier Agent, Realtor.com leads → inbound portal
  leads flow in for instant speed-to-lead.
- **Their CRM** — Follow Up Boss, etc.

**Why it wins:** cost shifts to the agent's existing spend (our data bill stays
near-zero); their paid subs beat our free tier on coverage; switching cost climbs
once feeds are wired in; they use rights they already hold; multiple sources give
redundancy.

**How it's built — a per-agent Connections hub:**
- OAuth / API-key vault, **secrets write-only + encrypted** (matches the secrets
  policy — never reveal plaintext). Each connection = a credential reference.
- Engine + swarm use whichever source is authorized; fall back to our base feed /
  public-records when none.
- Positioning: **"Use ours, bring yours, or both — we use the best available source."**

**Cautions:** respect each provider's ToS when using the agent's key in our tool
(usually fine for the agent's own use; verify per provider); secrets handling is
non-negotiable since these are the agent's paid accounts.

**Tiering:** a single connection (their MLS) in $297; the **full Connections hub**
(multiple data / lead / CRM sources) as a **$497** feature — lines up with
"convert & manage."

## 7. Compliance — core features, not afterthoughts

Housing + telephony is one of the most regulated combos. These are
product-defining:

- **Fair Housing (FHA).** An AI answering buyer questions can create **steering**
  liability for the agent (questions about "safe neighborhoods," "good schools,"
  "family area," "what kind of people live there"). The agent **must** refuse /
  redirect protected-class and steering questions, give only factual,
  non-steering info, and log every exchange. This guardrail is a selling point
  ("Fair-Housing-aware AI"), not just risk mitigation.
- **TCPA / DNC.** Outbound voice/SMS to leads requires consent + DNC scrubbing or
  the agent gets sued. Extend the existing MyOrbisVoice A2P / consent plumbing;
  enforce consent capture + DNC checks before any outbound.
- **A2P 10DLC.** SMS registration per the existing Voice flow.
- **Agency / license boundaries.** AI must not give legal advice or make agency
  representations; disclose it's an assistant; keep a human accountable.
- **Recording consent.** Two-party-consent states for call recording.

## 8. Architecture — reuse the MyOrbisVoice engine

Do **not** fork. MyOrbisAgents is a vertical skin + data model on top of the
existing engine:

- **Voice gateway** — unchanged (Gemini Live, Twilio, tool-calls, transcripts).
- **Prompt stack** — add RE layers: platform → tenant(agent/brokerage) → channel
  (widget/inbound/outbound) → **role: Real Estate ISA / Showing Coordinator /
  Seller-Update agent** → session (the specific listing + lead context).
- **Business DNA** — RE-shaped: agent profile, brokerage, service area, listings,
  buyer/seller scripts, objection library, Fair-Housing guardrail set.
- **New core entity: Listing** — address, price, beds/baths, status, photos,
  source, tracking number, per-listing prompt context, showing rules.
- **Integrations** — RESO/IDX, RE CRMs, ShowingTime; via the existing service
  abstraction + n8n orchestration for nurture/reporting workflows.
- **App owns config; gateway owns live sessions; n8n owns orchestration.** Same
  boundary rules as the parent. Same partner program, billing (Stripe), entitlements.

This means the build is mostly: new tenant config UX (agent/listings), RE prompt
overlays + guardrails, listing ingestion, RE integrations, and marketing — not a
new voice runtime.

### Inherited from the MyOrbisVoice engine (zero extra build)

Pull every useful benefit forward — it's the same runtime. These ship "for free"
and are **baseline in both tiers** (they're how the product works, not premium
add-ons):

- **Full call transcripts** + **call recordings**
- **AI call summaries** per conversation
- **Caller / contact capture → CRM record** (who called, number, what they wanted)
- **Conversation history across channels** (voice / SMS / email / widget = one thread)
- **Call outcomes / dispositions** (booked, callback, missed, escalated)
- **Sentiment / intent tagging**
- **Lead capture + consent / opt-in records** (A2P / TCPA evidence)
- **Tool-call logging** (what the agent did on the call)
- **Notifications** (new lead, booking) + **reporting / analytics**
- **After-hours behavior, forwarding, warm transfer**
- **Audit logs**, **voice selection** (Zephyr / Despina / …), **Business DNA +
  layered prompt stack**
- **Entitlements / quotas + Stripe billing + the partner program**
- **Widget sessions, inbound receptionist, outbound caller** channels

**Tiering rule from this:** engine-level capture/tracking (transcripts, summaries,
caller details, recordings, dispositions) is **baseline → in $297 and $497**. The
$497 differentiators are the *scale* layer on top — team seats/routing, automation
(nurture / reactivation / TC), per-listing tracking numbers, CRM sync, done-for-you
setup. Keeps "$297 captures *and tracks* every lead; $497 converts, manages, and
scales" honest.

## 9. MVP scope (smallest thing that proves the loop)

1. Agent signup + agent profile + service area (Business DNA, RE-shaped).
2. One phone number per agent (inbound + warm transfer + SMS).
3. Add a listing via **MLS# lookup** against a licensed feed (start on a
   SimplyRETS/MLS Grid sandbox), public-records enrichment for off-MLS, manual as
   fallback; listing-aware Q&A + showing booking to the agent's Google Calendar
   (reuse Voice booking).
4. Web widget + SMS + inbound voice on one persona; conversation context shared.
5. Fair-Housing guardrail + AI disclosure in the prompt stack.
6. Outbound follow-up to a lead with consent capture (reuse A2P/consent).
7. Bilingual EN + ES from day one.

**Prove:** instant lead response + booked showing + a seller-update sample. That's
the demo that closes agents.

## 10. Phases (rough)

- **P0** Positioning, domain, marketing site (EN+ES), eval/demo wedge.
- **P1** MVP (§9) on the Voice engine; first 5–10 design-partner agents.
- **P2** Per-listing tracking numbers + automated seller updates (retention).
- **P3** RE-CRM sync (Follow Up Boss first — most popular) + team routing tier.
- **P4** Broaden MLS coverage (more markets approved via the aggregator) + full
  IDX buyer-search rights — extend the licensed-feed backbone from §6.
- **P5** Brokerage tier + partner-channel resale.

## 11. Risks / watch-list

- Listing data sourcing (mitigated by pulling from licensed MLS feeds via an
  aggregator, not scraping portals — §6). Real friction is per-MLS approval, not
  legality.
- Fair Housing steering liability (mitigated by guardrails + logging — §7).
- TCPA/DNC on outbound (mitigated by consent + scrub — §7).
- Margin: minutes/numbers are the real cost; listing-count gate hides it. Add
  usage caps (§4).
- CRM-silo risk: agents won't adopt a tool that doesn't sync to their CRM (§5).
- Crowded space (Structurely, Ylopo AI, Lofty AI ISA, etc.) — differentiate on
  voice quality, bilingual, per-listing attribution, and the MyOrbis partner
  channel.

## 12. Open questions

**Decided (2026-06-30):**
- ✅ Three tiers: $297 Solo / $497 Solo Power (1 seat each) / Brokerage (multi-seat,
  white-label, routing — pricing TBD). Team features only in Brokerage.
- ✅ Listings = the agent's own book they add (count gate is real). §4.
- ✅ Data sourcing = pull from licensed MLS feeds (MLS# → feed), never scrape
  portals; default to agent-authorized (~$0 cost). Public-records for off-MLS. §6.
- ✅ Bring-your-own connections hub (MLS/IDX/data/lead/CRM); full hub is a $497
  feature, single MLS connection in $297. §6.
- ✅ Languages: EN+ES UI; conversational multi-language (~6–10 per agent). §15.
- ✅ Engine baseline (transcripts/recordings/summaries/caller details/etc.) is in
  BOTH tiers. §8.
- ✅ $497 full spec locked (§4). $297 full spec locked (§4): EN+ES only, outbound =
  confirmations/reminders/follow-ups (not prospecting), 1 main number only.

**Still open:**
- Usage allowances (both tiers): minutes/SMS + tracking-number count — set after a
  Twilio/Gemini cost model. (Proposed: $497 ~1,500min/2,000SMS/10 numbers; $297
  ~500min/750SMS/1 number.)
- Brokerage tier pricing + seat pricing.
- Onboarding fee — yes/no, and amount?
- First MLS aggregator to integrate: MLS Grid vs Trestle vs SimplyRETS (sandbox). §6.
- First RE CRM for sync (recommend Follow Up Boss).
- Domain/brand: MyOrbisAgents.com confirmed; reuse the MyOrbisResults shell?

## 13. Value-add backlog (prioritized)

Ranked by impact-per-effort, leaning on what the voice engine already does. The
top group is where the durable differentiation lives.

### Tier 1 — high impact, drives retention + price justification

- **Transaction-Coordinator (TC) mode.** After a deal goes under contract, auto
  milestone reminders to all parties: inspection, appraisal, financing
  contingency, title, walkthrough, closing. Agents pay human TCs $300–500 **per
  deal** — replacing/augmenting that is a standalone ROI story and a sticky
  workflow. Lives in the $497 tier. (Pure orchestration — fits n8n.)
- **Database reactivation / circle prospecting.** Outbound voice+SMS over the
  agent's old leads + sphere: "just sold near you," "is now a good time to sell,"
  "still looking?" The database is every agent's #1 untapped asset and they never
  work it. TCPA/DNC-gated. Massive latent value from data the agent already owns.
- **Instant home-valuation seller magnet.** The agent's *existing* book is the
  primary listing source (they add it). This magnet is the **growth source on top**:
  "What's your home worth?" widget/number → captures **new seller leads** that
  become new listings. Listings are inventory; inventory is what agents crave most.
  Existing book = day-one value; valuation magnet = how the book grows.
- **Automated seller updates.** Weekly per-listing report (calls, showings,
  feedback, views). Agents hate doing it; sellers complain they never get it.
  Retention glue. (Already in §5; reaffirmed as Tier 1.)
- **Per-listing tracking numbers + attribution.** Proves marketing ROI to sellers
  on the listing presentation. (Already in §5; Tier 1.)

### Tier 2 — strong adds, mostly integrations

- **Missed-call text-back.** Instant SMS the moment a call is missed. Cheap,
  classic, high-conversion. Should arguably be in the MVP — it's table stakes now.
- **Legit lead-source hookups.** Zillow Premier Agent + Realtor.com lead APIs (the
  *sanctioned* path, unlike scraping listings) → instant speed-to-lead callback
  the moment a portal lead lands. This is the real speed-to-lead motion.
- **RE-CRM sync.** Follow Up Boss first (most popular), then kvCORE / BoomTown /
  Sierra. Without it we're a silo serious agents won't adopt. (Already §5.)
- **Open-house capture + same-night follow-up.** Sign-in → that-night nurture.
- **Showing feedback aggregation.** Auto-collect buyer-agent feedback post-showing,
  roll into the seller report.
- **Post-close review requests** (Google / Zillow) → ties to sibling MyOrbisReviews.
- **AI listing content.** Generate listing descriptions + social posts from the
  listing data we already hold. Near-zero marginal cost, daily-use hook.

### Tier 3 — moat / channel / later

- **MLS / IDX (RESO Web API) ingestion.** The durable listing-data backbone vs.
  paste-and-pray (see §6). Bigger lift; do after PMF.
- **White-label for brokerages.** Brokerage buys, brands it, distributes to agents.
  Higher ACV + the resale channel through the MyOrbisResults partner program.
- **Compliance pack as a sellable feature.** Bundle Fair-Housing-aware answering +
  TCPA/DNC enforcement + recording-consent handling and *market the safety*. In a
  category nervous about AI + housing law, "the compliant one" is a wedge, not
  just a guardrail (see §7).
- **Power dialer / ringless voicemail** for outbound prospecting (TCPA-careful).
- **Agent-to-agent referral network.** Out-of-area referrals between tenants — a
  marketplace play once there's density.

### The "should be MVP" call-outs

Two items above are cheap and so high-converting they probably belong in the first
release, not the backlog: **missed-call text-back** and the **instant valuation
seller magnet** (the latter because it *grows* the agent's book — and the book is
the platform's core asset). Note the day-one listing source is always the agent
adding their existing portfolio; the magnet is additive, not the primary feed.

## 14. What the AI swarm owns

Don't conflate three different AIs:

- **Orby (product voice agent)** — real-time, *in* the conversation. Synchronous,
  customer-facing, one call at a time. Lives in the voice gateway.
- **Claude Code** — builds the software.
- **The swarm** — an **asynchronous background fleet** that does the research,
  prep, content, targeting, monitoring, and orchestration *around* the live
  conversations. **Never in the live call** (no real-time audio — same rule as
  n8n). n8n is the deterministic plumbing; the swarm is the intelligent layer that
  rides on it and executes the agentic steps.

One line: **Orby handles the conversation; the swarm handles everything that
feeds, follows, targets, monitors, and improves the conversation.**

### Swarm responsibilities

**Listing data + content**
- Watch MLS feeds: new listings, price changes, status flips → refresh records,
  flag stale.
- Off-MLS enrichment: address → public-records pull, dedupe, normalize.
- Generate listing descriptions, property landing copy, social posts, flyers —
  bilingual.
- Data hygiene: missing fields, bad photos, **Fair-Housing-risky wording** →
  flag/fix before it goes live.

**Lead intelligence + targeting** (decides *who/what*; Orby does the talking)
- Enrich inbound leads (who's the buyer, what they own, equity).
- Database mining: score the agent's old DB for likely movers (tenure, equity,
  life events) → build reactivation call lists.
- Circle-prospecting lists around new listings / just-solds.
- Comps + "what's my home worth" valuations + neighborhood market reports (the
  seller-magnet content).

**Ops + reporting**
- Compile the weekly **seller-update reports** (calls/showings/feedback/views).
- **Transaction-coordinator** tracking: watch milestone deadlines, draft reminders.
- Monitor speed-to-lead SLA, missed calls, conversion drops → alert.

**Compliance (background gate)**
- **DNC/TCPA scrub** outbound lists *before* Orby dials.
- Fair-Housing review of generated content + scripts.
- Audit-log review.

**Self-improvement (the compounding part)**
- Mine call transcripts → objection patterns, failed-booking causes → improve the
  prompt stack / objection library. A/B-test scripts. The swarm makes the product
  agent better over time.

**Portfolio-level (shared MyOrbis swarm)**
- pSEO neighborhood/market pages (like the MyOrbisBiz content orchestrator),
  partner/brokerage outreach research.

### Boundary (keep the architecture rule)

App owns config · gateway owns live sessions (Orby) · n8n owns orchestration
workflows · **swarm = the intelligent workers n8n triggers** for research /
content / targeting / QA. Real-time audio never goes in the swarm or n8n.

## 15. How many languages

Two surfaces with very different cost — **decouple them.**

**Agent-facing UI + marketing site → EN + ES (2).** Matches the MyOrbis mandate.
Every added UI language is expensive *forever* — all strings, both directions,
enforced by the i18n parity scanner. Expand only when a market or partner demands
it. Keep this small.

**Conversational agent (Orby → buyers/sellers) → many, and cheap.** Gemini Live is
natively multilingual, so a language is **config, not a rebuild**. This is where
languages make money — the callers are home buyers/sellers, often immigrant /
international buyers. Make conversational language a **per-agent setting +
auto-detect the caller and answer in kind.**

**US real-estate language priority** (speaker base + international buyer money —
China / Mexico / India / Brazil / Colombia lead US purchases):

1. English
2. **Spanish** (the #1 add, non-negotiable)
3. Mandarin / Cantonese (CA / NY / WA — luxury + international)
4. Tagalog
5. Vietnamese
6. Korean
7. Portuguese (FL / MA — Brazilian buyers)
8. Russian
9. Haitian Creole / French (FL)
10. Hindi

**Recommendation:**
- **UI / marketing: 2** (EN, ES) now; expand deliberately, not by default.
- **Conversational agent: EN + ES guaranteed**, plus a curated **~6–10 enabled
  per-agent** from the list above + auto-detect. A Miami agent toggles
  ES + Haitian Creole + Portuguese; a Bay Area agent toggles Mandarin + Tagalog.

**Bonus:** Fair Housing forbids denying service by language, so broad
conversational coverage is a compliance + inclusion plus, not just a feature — and
bilingual/multilingual is already a stated differentiator vs. competitors (§11).

---

# Part II — Go-to-market + the outreach machine (added 2026-06-30)

Status: **in-house product for now.** Everything below is architected to be
partner-enabled later (see §22) but built for our own use first. Near-term goal:
prove the offer converts + delivers, and hit a **$2,000-in-14-days** cash target.

## 16. Go-to-market — the Founding Sprint

The fastest cash is **done-for-you setup + annual prepay**, not slow-drip MRR.
Sell an outcome delivered this week on the existing Voice engine (a real-estate
ISA), branded MyOrbisAgents; the customer doesn't care it's MyOrbisVoice under
the hood.

**The Summer Founding offer** (both tiers; first 10 agents; hard deadline):
- **$500 setup** (full price — immediate cash, signals real work) **+ 50% off the
  FIRST YEAR** (renews at standard — NOT a permanent discount).
- Monthly fallback at full price ($500 setup + $297/$497) so the annual-averse
  don't walk; the gap nudges to annual.
- **30-day money-back on setup** (risk reversal for a new product to a skeptical buyer).

**Cash math (annual list = 12× monthly; 50% off yr 1):**

| Tier | Annual (50% off yr 1) | + $500 setup = per close |
|---|---|---|
| Solo Capture $297 | $1,782 | **~$2,282** |
| Solo Power $497 (lead with this) | $2,982 | **~$3,482** |

**One annual close ≈ the $2k goal.** Or 2 monthly at $497 / 3 at $297. Lead with
**$497** for agents (they want the full ISA; higher cash/close; one extra deal
pays for it a decade over).

**Target the right agent — the sweet spot (see §17 rubric):** solo or 2–3 person,
**10–40 sales/yr**, actively working leads, ideally a **Zillow Premier Agent**
(pays for leads → bleeds on slow response → sharpest pain), bonus **bilingual**.
Two failure modes to skip: **too big** (mega-team = already has an ISA op) and
**too small** (near-inactive = no lead volume = no pain).

**Data sourcing = manual, not scraping.** A human reads public Zillow profiles and
copies the facts; the tools process the pasted text. Never fetch/scrape Zillow
programmatically. Cold outreach = **email/video only** (CAN-SPAM: unsubscribe +
address); no cold SMS/calls to their mobiles (TCPA). Protect the sending-domain
reputation — low volume, personalized, warmed.

## 17. Prospect Evaluation + Outreach Engine (the outbound machine)

The unifying insight: **the outreach machine and the product run on the same data
model.** A scored prospect with a demo built is 80% of an onboarded customer.

**The loop:**
```
Score prospect → format their listing (AI) → build personal demo page (live widget)
   → render personalized video → send via video-email → agent talks to "their" AI ISA
   → CTA: Stripe founding offer → onboard (their data is already collected)
```

### 17a. Prospect scorer ("evaluation agent")
- **Input:** paste the raw Zillow agent blob (messy is fine). AI (gpt-4o-mini)
  **extracts** structured fields: name, brokerage, market, sales/12mo, team vs
  solo, avg price, price range, years, reviews, Premier Agent, language, contact.
- **Score = deterministic rubric** (consistent, explainable — like the audit); AI
  only writes the qualitative notes. Rubric:
  - Premier Agent **+30** · 10–40 sales **+20** · solo/small team **+15** · active
    listings **+10** · producer/reviews **+10** · bilingual **+10** · tech-polished **+5**
  - Penalties: 0–2 sales **−20** · mega-team **−15**
  - Tier: **A ≥ 70 · B 50–69 · C < 50** (loud red flag on mega-team / inactive).
- **Output:** score + tier + **recommended tier ($297 vs $497)** + **pitch angle**
  (luxury → protect-high-value; solo-volume → missed-call) + red flags.
- **Save → Prospects DB** with a pipeline: **Target → Contacted → Sent video →
  Replied → Demo → Won / Lost / Skip.** Ranked list (A-tier first) = the call sheet.

### 17b. Personalized demo — one shared number + a widget (the closer)
Two channels, **one personalized demo record** (their name / market / sample
listing / RE-ISA DNA) drives both:

**Phone demo — ONE shared Twilio number (not one per agent).** The AI identifies
the caller, loads their demo, and role-plays *their* ISA. Identify in this order:
1. **Caller-ID match** (primary) — the agent's phone is on the prospect record; on
   inbound, match the calling number → load instantly: *"Hi Chase, this is your AI ISA."*
2. **Ask name + confirm** (fallback) — *"Which agent am I speaking with?"* → fuzzy
   match → **confirm** (*"Chase Horner with Sotheby's?"*) before running (voice
   name-recognition is the weak link).
3. **Demo code** (bulletproof) — a code in the video email (*"call X, enter 4827"*).
- Then: *"Ask me about the property at [their listing] like a buyer would"* →
  grounded answers + books a showing → pivot to CTA. **Meta-proof:** the line
  identifying + routing the caller is itself the product working on them.
- Keep the opener fast + warm — one question, one confirm, go. No IVR.
- **Build win:** removes per-agent number provisioning from the critical path —
  one number + a caller-ID/name lookup against the prospect DB.

**Web demo — the widget.** Per-agent `/demo/[slug]` on the Voice app (widget needs
the gateway session): name + market + live RE-ISA widget + founding offer + CTA.
- **Templated/dynamic** — auto-minted from the prospect record; no per-agent design.
- **Bilingual** default for Spanish-speaking agents. **Matched sample listing**
  (luxury vs starter) so the demo feels like their world.
- **Engagement tracking** — opened / talked to the widget? → auto-advance pipeline
  to "Demo" + flag a hot follow-up.
- The page/phone are the *interactive* demo (talking > watching); the video is the hook.

### 17c. Property-data → voice formatter (also the product's listing-ingestion core)
- Paste raw listing data (MLS sheet / description / notes — no scraping) → AI
  **rewrites into three things the voice AI needs:** (1) structured facts, (2) a
  spoken summary, (3) grounded buyer Q&A.
- **Guardrails (non-negotiable):** grounded — invent nothing; **Fair-Housing-safe**
  — no steering in the rewrite or the Q&A; **reviewable** — agent confirms before
  live (they're the licensed party). Never auto-publish listing facts.
- This is exactly the §6 "paste-and-confirm" ingestion — build once, use for demo
  *and* product.

### 17d. Personalized video generator
- **Remotion** (data-driven video: props → MP4 per agent), fed from the prospect
  record. Short (30–60s): personalized intro card → a demo beat (subtitled AI-ISA
  handling a buyer for *their* listing, from 17c) → offer + CTA to the demo page.
- **Strategic split:** the **page** is the demo; the **video** is the hook to get
  the click. Don't over-render.
- **Cheap high-ROI win:** personalized video **thumbnail with their name**.
- Bilingual for Spanish agents. **Sprint scope:** strong base video + personalized
  intro/thumbnail + link to the personal page; full auto-render is a v2.

### 17e. AI-assist editors (UX pattern, used everywhere data is pasted)
- Pattern on every paste window: **paste raw → "✨ Rewrite/Format" → human edits → save.**
- **Match the editor to the content — don't put rich text everywhere:**
  - **Structured facts** → editable **form fields** (AI fills from paste).
  - **Voice / DNA prose** → **plain / light editor** (the voice model wants plain
    text; HTML is noise).
  - **Marketing copy / scripts / emails** → **rich text** (reuse the Voice app's
    `RichTextEditor` — already built, with paste-sanitize + toolbar).
- Build **one reusable "AI-assist field" component** + reuse the rich editor;
  reuse `ai-assist.service` (`generateDnaSection`, `generateScriptDraft`).

## 18. Agent DNA (the RE-shaped Business DNA)

The DNA is what makes the ISA *be that agent* vs a generic bot. It's the tenant
layer of the existing prompt stack, real-estate-shaped. Captures:
- **Identity / brand / voice** (tone matches a Sotheby's luxury agent vs a starter hustler)
- **Market** (areas, price points, specialties: luxury / first-time / relocation / investment)
- **Listings** (via 17c paste→format)
- **Booking rules** (showing hours, calendar/lockbox/ShowingTime, what to collect)
- **Lead qualification** (budget, pre-approval, timeline, cash vs finance, agency)
- **Scripts / objection handling** (their scripts — reuse the Scripts feature)
- **Escalation / handoff** (when to warm-transfer, after-hours behavior)
- **Language** · **Prohibited language / brand guardrails**

**Assistant identity — the agent is "Orby."** Every agent's ISA introduces itself
as **"Orby, [Agent]'s personal digital assistant"** (never claims to be the agent
or a human — AI disclosure). Consistent Orby brand across the MyOrbis ecosystem.

**Calendar integrations for booking:**
- **Google Calendar — available now** (engine has OAuth + appointment sync). Agent
  connects via Integrations → Connect Google; Orby books real events.
- **Calendly · Outlook/Office365 · ShowingTime (RE-specific) — net-new builds**
  (roadmap; each is its own OAuth/API integration service). Until connected, Orby
  captures + confirms the showing against the agent's stated hours.

**Demo vs customer DNA — the key split:**
- **Cold demo** runs on a strong **default RE-ISA DNA template** + light
  personalization (name / listing / market). **Zero agent effort** → the cold demo
  just works before signup.
- **Customer** gets a **full Agent DNA** built at onboarding — AI-assisted (reuse
  `generateDnaSection`): answer a few questions + paste scripts/listings → AI drafts
  each section → agent confirms.
- **Compliance lives in the PLATFORM layer** (Fair Housing, TCPA, AI disclosure),
  inherited by every agent — no one can turn it off, and we don't rebuild it 50×.

## 19. Orchestrator responsibilities (the lifecycle spec)

The Orchestrator is the **dispatcher** — routes each moment to the right sub-role
(Appointment / Sales / Secretary / Customer-Service) + tool-call (calendar, SMS,
transfer, listing-lookup), holds context across channels + sessions, enforces
compliance, logs everything. What it must handle:

- **Explain a listing** — factual answers grounded in listing DNA (no invention);
  refuse Fair-Housing steering; every answer points at booking a showing.
- **Qualify** — budget, pre-approval, timeline, cash vs finance, agency; capture
  contact + consent; route hot vs nurture.
- **Book** — offer real slots, create the appointment, collect who's coming +
  meeting/lockbox instructions, enforce agent rules (e.g. proof-of-funds for luxury).
- **Confirm** — pre-confirm, chase non-responders, release no-shows.
- **Remind** — buyer (24h + 1h) with address/time/directions; agent's daily showings.
- **Reschedule / cancel** — offer new slots, update, re-confirm, notify the agent.
- **Running-late updates** — buyer late → ping agent to hold; agent late →
  proactively text the buyer. Real-time two-sided coordination (where human ISAs fail).
- **Post-showing follow-up** — collect feedback, gauge interest, push next step;
  long-horizon nurture.
- **Escalation / handoff** — warm-transfer on hot/ready/complex/asks-for-human;
  after-hours capture; **always discloses it's an AI.**
- **Proactive / outbound** — database reactivation, new-listing + price-drop
  alerts, open-house follow-up (DNC/TCPA-gated).
- **Seller side** — seller inquiries, "what's my home worth" capture, listing
  appointments, seller-update reports.

## 20. White-label / custom domains

- **Default: free `*.myorbisagents.com` subdomain** per customer (zero DNS effort).
- **Upgrade: their own subdomain** (`ai.theirsite.com`) via **CNAME → us**, served
  by **Caddy on-demand TLS** (auto per-hostname certs + an `ask` validator so only
  real customers get one) + hostname→owner routing in the app. Your Caddy stack
  already supports this pattern.
- Tier it: free subdomain = everyone; **custom domain = $497 Pro / Brokerage** perk.
- **Not sprint work** — a post-signup build. But *mention it in the pitch* ("run it
  on your own domain") — closes the white-label-minded agent at zero build cost.
- DNS friction is real for non-technical agents → make custom-domain concierge.

## 21. Architecture — where each piece lives

Two buckets:
- **Product (build on the Voice engine, reuse everything):** Agent DNA, listing
  formatter, demo page + widget, AI-assist editors, the ISA/orchestrator. The
  Voice app already has the prompt engine, Business DNA, `ai-assist.service`,
  `RichTextEditor`, gateway/widget, entitlements, billing, partner rails — MyOrbisAgents
  is a **vertical skin**, not a rebuild. Do NOT re-port this into MyOrbisBiz.
- **Sales tooling (lighter, could live standalone / admin):** the prospect scorer +
  outreach (video, send). Pure cold-outreach, not customer-facing product.

## 22. Partner-ready seams (design for partners, build for in-house)

In-house now, partner-enabled later — wire the cheap seams, defer the features.
- **Wire now:** an **`ownerId`/`partnerId` on every record** (prospect, DNA,
  listing, demo — default = house/you); **scoped queries** from row #1; **reuse the
  existing Hub commission ledger + affiliate/referral rails** (same rails as the
  directory-claim→commission flow already built); per-owner branding; owner-scoped
  entitlements. Retrofitting a tenancy key later is the expensive migration — adding
  it now is free.
- **Defer:** partner signup for this vertical, partner dashboards, payout UI,
  white-label UI, partner access to the prospect tool.
- **Why it matters:** the **partner channel is the scalable answer to the reach
  problem.** A RE coach / brokerage / marketing agency already owns **50–500
  agents** + the trust — one partner = a whole book of prospects. Prove the offer
  in-house, then hand the machine to partners on rails that already exist.

## 23. Build inventory — what we HAVE vs. what we NEED

**Reuse from the MyOrbisVoice engine (already built — zero/low build):**
| Capability | Status |
|---|---|
| Real-time voice/widget gateway (Gemini Live, Twilio, tool-calls) | ✅ have |
| Layered prompt engine + Business DNA (versioned) | ✅ have — reshape to Agent DNA |
| `ai-assist.service` (`generateDnaSection`, `generateScriptDraft`, gpt-4o-mini) | ✅ have |
| `RichTextEditor` (paste-sanitize + toolbar) | ✅ have — reuse for marketing copy |
| Scripts feature (call/email/sms, AI assist) | ✅ have — feeds Agent DNA scripts |
| Booking → Google Calendar, reminders (offsets), confirmations | ✅ have |
| Transcripts / recordings / summaries / dispositions / CRM / audit | ✅ have (engine baseline) |
| Stripe billing, plans, entitlements/quotas | ✅ have — add founding SKUs |
| Partner program: Hub ledger, affiliate/referral, commissions | ✅ have — reuse for §22 |
| Directory + audit scoring pattern (MyOrbisBiz) | ✅ have — model for the prospect scorer |
| Caddy edge (on-demand TLS pattern for custom domains) | ✅ have |

**Need to build (net-new for MyOrbisAgents):**
| Piece | Effort | For the sprint? |
|---|---|---|
| **Prospect scorer** (paste→extract→rubric→tier→save→pipeline) | M | yes (ranks the list) |
| **Founding-offer Stripe links** ($297/$497 monthly + annual-50 + $500 setup) | S | yes (collect cash) |
| **Shared demo phone line** (1 Twilio number + caller-ID/name/code lookup → load personalized demo) | S–M | yes (the closer, phone) |
| **Personalized demo page** `/demo/[slug]` + live RE-ISA widget (default DNA) | M | yes (the closer, web) |
| **Property→voice formatter** (paste→facts+summary+FAQ, guardrails) | M | yes (magic demo + product core) |
| **Default RE-ISA DNA template** (qualify/book/Fair-Housing-safe) | S–M | yes (demo runs on it) |
| **Personalized video** (base + intro/thumbnail; Remotion auto-render) | S sprint / L full | partial (base now, auto v2) |
| **AI-assist field component** (reusable paste→rewrite→edit) | S | yes (used across windows) |
| **Prospect pipeline / call-sheet UI** | S | yes |
| **Landing/offer page** (founding rate + guarantee + deadline) | S | yes |
| **Full Agent DNA onboarding** (AI-assisted intake) | M | no — post-sale |
| **Listing ingestion at scale (MLS/IDX, BYO connections §6)** | L | no — post-PMF |
| **Custom-domain white-label** (Caddy on-demand + routing) | M | no — Pro/Brokerage later |
| **`ownerId` seams on new tables** (§22) | S | yes (cheap now, do it from row 1) |
| **Brokerage tier + partner-facing features** | L | no — after in-house proof |

**Critical path for the $2,000 / 14 days** (thinnest line to cash):
1. Founding-offer **Stripe links** (S).
2. **Prospect scorer + pipeline** to rank the copy-paste list (M).
3. One **default RE-ISA DNA** + **property formatter** (M) so the demo answers about a real listing.
4. **The demo — one shared phone line** (caller-ID/name lookup → personalized) **+
   the `/demo/[slug]` widget** (M) — the thing that closes. One number, not per-agent.
5. **Landing/offer page** + a **base personalized video/thumbnail** (S).
6. Manual onboarding (you set up each closed agent by hand — no onboarding UI needed yet).

Everything else (full Agent DNA UI, MLS ingestion, white-label, partner features)
is post-sale / post-PMF. Ship the closing loop, collect the cash, then deepen.

---

## 24. Platform directives (2026-07-01)

- **Mobile-first design.** Agents live on their phones; buyers hit the demo/widget
  on mobile. Every surface (demo pages, landing, dashboard) designed mobile-first —
  big tap targets, single-column, fast, thumb-reachable. Desktop is the enhancement.
- **Mobile app (roadmap).** An agent-facing mobile app = the cockpit (leads,
  showings, transcripts, notifications, tune Orby). **PWA-first** (installable Voice
  web dashboard) → native later. Not sprint work.
- **Phone demo line = reuse MyOrbisVoice inbound.** The engine's inbound channel
  already does number → tenant → Orby config → gateway (`resolveInboundCall`). To
  give an agent's demo a phone line: **assign a Twilio number to the demo tenant +
  enable inbound.** No new build. The shared-number-for-all-agents caller-ID lookup
  (§17b) is an enhancement layered on top afterwards.

### Live founding Stripe links (2026-07-01) — collectible now
Each bundles the **$500 setup** + the plan. One annual close ≈ the $2k goal.
- **Solo Power — Founding Annual** ($500 + $2,982/yr ≈ **$3,482**): https://buy.stripe.com/6oUaEZ1NNfgp2TZ33o0Ny05
- **Solo Power — Monthly** ($500 + $497/mo): https://buy.stripe.com/8x27sN8cbb09527cDY0Ny06
- **Solo Capture — Founding Annual** ($500 + $1,782/yr ≈ **$2,282**): https://buy.stripe.com/28E28tcsrd8h0LR47s0Ny07
- **Solo Capture — Monthly** ($500 + $297/mo): https://buy.stripe.com/4gMeVfgIH3xHdyDbzU0Ny08

(Lead with Solo Power. "50% off yr 1" is baked into the annual price; renews at
standard next year — set the year-2 renewal price when you productize. Live
account, real charges.)

### Dashboards — current split + the unify roadmap
Today the surfaces are split by product-vs-outreach:
- **Agent (customer) dashboard = the Voice web app** (`app.myorbisvoice.com`, tenant
  login) — Business DNA editor, Channels, Conversations, Appointments, Integrations,
  billing. This IS the agent cockpit (unbranded for now).
- **Operator admin = two places:** prospecting → MyOrbisBiz `/admin` → Prospects;
  agent/tenant management → Voice platform `/admin` (platform-admin account).

**Roadmap (post-PMF, NOT sprint):** unify into a **MyOrbisAgents-branded agent
dashboard** (the Voice tenant dashboard reskinned + installable **PWA**, mobile-
first per §24) + a single operator console. Deliberately deferred — rebranding is
polish; first customers get a working Orby + manual white-glove onboarding, which
doesn't need a branded shell to close or deliver.

### First demo built (2026-07-01)
Chase Horner RE-ISA demo is **live**: tenant on the Voice engine, published Agent
DNA (Orby persona, Fair-Housing guardrail, sample $2.45M listing, calendar-aware
booking Mon–Sat 9–6), widget enabled + embedded on a hosted personalized page
(`myorbisagents.com/demo/chase-horner/`). Proves the "skin on the engine" thesis.

---

*Idea doc — Part I (product concept) locked 2026-06-30; Part II (GTM + outreach
machine) 2026-06-30; platform directives + first live demo 2026-07-01. In-house
first, partner-ready by design.*
