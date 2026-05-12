# MyOrbisVoice Marketing Style Guide

**Purpose:** Canonical persuasion + copywriting reference for everything user-facing the platform produces — marketing site copy, tenant outbound emails, partner pitch material, agent voice scripts, video scripts, ads, dashboard taglines, onboarding emails. Sourced from the named masters of direct-response copy and conversion psychology, structured so anyone (us, partners, tenants, AI-Assist) can reach for the right framework without reinventing it.

**Living document.** Append + edit as we ship new surfaces and learn what converts on real prospects. Companion to [docs/product-overview.md](product-overview.md) — that doc says **what** we offer; this one says **how to talk about it**.

---

## How this plugs into the platform

| Surface | Integration |
|---|---|
| Marketing site (`site/`) | Every page rewritten to a chosen framework (default: PAS for hero, StoryBrand 7-step for full-page narrative, AIDA for CTAs). Audit-then-rewrite pass scheduled separately. |
| Tenant campaign editor | AI-Assist "Generate email" injects this guide into the system prompt as guardrails. Generated copy follows the framework + respects the tenant's Aggression Setting (see below). |
| Partner Marketing Kit | New "Copy & Frameworks" section surfaces these principles + per-vertical templates partners can paste into their own outreach. |
| Agent voice scripts (Layer 5 of prompt resolver) | Outbound campaign agents pulled into a campaign with a `prompt` overlay reference these principles for objection handling, framing, and closes. |
| Onboarding emails | Already-shipped templates audited against the framework; rewritten where they're bland. |
| Video scripts (Product Explainer 16:9 + 9:16, social cuts, recruiting video) | Each video maps to one named framework. The recruiting video is PAS+citations; social cuts are pure-pain hook + payoff; the explainer is StoryBrand. |

---

## Core positioning constraint (read first)

Persuasion frameworks work because they tell the truth in the **right order**, not because they manipulate. If a claim isn't true, no framework saves it. Three rules govern all copy on the platform:

1. **Numbers must be sourceable.** Every statistic gets an on-screen citation chip (Forbes / BIA-Kelsey / HBR / industry-specific). No "studies show," no orphan "85%."
2. **Stories must be specific or labeled hypothetical.** "Sarah's dental office in Allentown" reads as real. Use it only when there's an actual customer to point at OR mark it explicitly ("imagine a dental office that…"). Never invent quoted customers.
3. **Urgency must be enforceable.** Deadlines must actually trigger. Scarcity must actually be scarce. Kennedy himself names "perpetual last-day sales" as the fastest way to destroy trust.

These three apply even at the Aggressive end of the spectrum. Aggression is about intensity, not invention.

---

## The Aggression Spectrum

Different tenants in different verticals need different copy intensities. A dental office sounds wrong using late-night-infomercial framing; a fitness coach sounds wrong using legal-firm formality. The platform should let each tenant + partner pick their position on this spectrum and have AI-generated content respect it.

**The four tiers:**

| Tier | Voice | Best for | Hallmarks |
|---|---|---|---|
| **1. Conservative** | Ogilvy, Hopkins, Schwartz at his most restrained. Professional, factual, proof-stacked. | Dental, legal, financial advisors, B2B services, healthcare adjacent. | Statements, not exclamations. Specific numbers. Citations on every claim. No urgency tactics. CTAs are invitations: "Schedule a consultation." |
| **2. Balanced** *(default)* | Halbert + Wiebe blend — modern direct-response. Emotional but not alarmist. | Home services, beauty, fitness, mid-market service businesses, most of our target verticals. | PAS framing. Stories used. Emotional but credible. Soft urgency ("limited slots this week"). CTAs are direct: "Get your free walkthrough." |
| **3. Direct** | Kennedy / Halbert. Story-led, urgency-built-in, hard offers. | Coaching, courses, info products, launch events, time-sensitive promotions. | "Here's exactly what you get, here's exactly what you pay, here's exactly when this expires." Real deadlines. Real bonuses. Hard CTAs: "Claim your spot before midnight Sunday." |
| **4. Aggressive** | Late-night infomercial. Use sparingly. | One-time events: Black Friday, product launches, anniversary sales. Never as a baseline voice. | Caps + intensifiers + countdown timers + stacked bonuses. "STOP losing $4,800/month. THIS WINDOW CLOSES IN 47:14:09." Burns trust if used continuously. |

**Default for new tenants:** Balanced. Tenants choose their tier in `/settings` (and per-campaign override in the campaign editor). Partners choose their tier in their profile. The platform itself defaults to Balanced for marketing site copy.

**Implementation note (feature design):** see "Feature spec — Aggression Settings" at the bottom of this doc.

---

## Master copywriters — who, why, and what to study

### John Caples — Headlines
- *Tested Advertising Methods* (4th edition, 1974). Chapter 5 contains his **35 proven headline formulas** + his three classes of headlines.
- Three classes: **Self-Interest** (strongest), **News** (next strongest), **Curiosity** (weakest, easiest to misfire).
- Four best appeals: news, self-interest, fear, curiosity. Self-interest wins almost every test he ran.
- His most famous headline: "**They Laughed When I Sat Down at the Piano—But When I Started to Play!**" — story hook + curiosity + transformation arc, in one line.
- **Steal:** specificity beats cleverness. "How to..." headlines outperform clever ones in 9 of 10 of his split tests. Headlines that promise a clear, specific benefit lift CTR 5-10× over vague ones.
- **Apply:** every page hero, every email subject line, every video opening frame. The first 6-10 words decide whether the rest gets read.

### Gary Halbert — Story-led sales letters
- *The Boron Letters*, *The Gary Halbert Letter* archive. The **most-mailed sales letter in history** is his Coat of Arms letter (~600M sends).
- Halbert's structure: **AIDA** (Attention, Interest, Desire, Action), but with story carrying every step instead of feature lists.
- His personal-story formula in the first third of every letter: **the struggle + what would have happened if he'd failed**. The negative consequence creates the emotional stakes that justify the offer.
- "Copy is selling in print, and selling is pure emotion."
- **Steal:** never explain — share an experience. Wrap product names in stories so they stick.
- **Apply:** every long-form email, every recruiting video, every campaign that has space to breathe.

### Joanna Wiebe — Conversion copy + customer-voice data
- Founded **Copyhackers** in 2011. Originator of the term "conversion copywriting."
- Her central insight: **the best messages don't come from your head, they come from your customers.** Conversion copy is 100% about the prospect — what you write is **swiped from voice-of-customer data + paired with swiped formulas.**
- Eugene Schwartz's **5 Stages of Awareness** (from *Breakthrough Advertising*, 1966) — the framework Wiebe operationalized for digital:
  1. **Unaware** — doesn't know they have the problem
  2. **Pain Aware** — feels the pain, doesn't know solutions exist
  3. **Solution Aware** — knows solutions exist, doesn't know specific products
  4. **Product Aware** — knows your product, hasn't decided to buy
  5. **Most Aware** — ready to buy, needs final reasons + offer
- **Steal:** match copy to the awareness stage of the visitor. Cold-traffic landing pages target Pain Aware (lead with problem). Product-page visitors are Solution+Product Aware (lead with differentiator). Pricing-page visitors are Most Aware (lead with offer).
- **Apply:** every page on the site, every email in a campaign sequence, every CTA. Wrong-stage copy is the #1 conversion killer.

### Dan Kennedy — Direct response + offers
- *No B.S. Direct Marketing*. The **10 Commandments** of direct response.
- The two non-negotiables:
  1. **Every piece of marketing must contain a specific offer** — what you're giving and what you want in return.
  2. **Urgency and immediacy must be built into every marketing message** — real deadlines, limited quantities, time-sensitive bonuses, cost-of-delay framing.
- His urgency tactics (in order of trust-preservation):
  - Limited quantity, limited regional supply, limited time (per actual constraint)
  - Countdown clocks tied to enforced deadlines
  - First-N-buyers bonuses
  - Cost-of-delay math
  - "Group open house" competitive urgency (multiple buyers competing for one resource)
- The trust killer: **fake urgency.** Perpetual "last day" sales train your audience to ignore your deadlines forever.
- **Steal:** every offer should be answerable in one breath. "$497 one-time, lifetime access, 100 units only, deadline midnight Sunday EST."
- **Apply:** pricing pages, launch promos, partner referral pushes, abandoned-cart sequences.

### Matt Furey — Story-driven email
- Cited by Perplexity for **story-led emails that pull readers through the message.**
- Furey's pattern: subject line is curiosity-hook, opening is mid-action ("So I'm walking through the airport when…"), middle is the story, last paragraph ties it to the offer.
- Reader doesn't notice they're being sold to until they've already read the entire email.
- Subject line sweet spot: **6–10 words, specific, customer-focused.**
- **Steal:** in nurture sequences, lead with story for 3-5 emails before the first hard pitch. The reader's relationship with the sender does the persuasive work.
- **Apply:** tenant outbound campaigns where there's a sequence (booking confirmation → reminder → follow-up). Partner email outreach to warm prospects.

### Eugene Schwartz — Stages of awareness + breakthrough advertising
- *Breakthrough Advertising* (1966) — the foundational text Wiebe and most modern conversion copywriters built on.
- Beyond the 5 stages: Schwartz's market sophistication levels (1: first to claim a benefit; 2: bigger claim; 3: mechanism reveal; 4: better mechanism; 5: identification). Tells you how loud you can claim before sounding ridiculous.
- **Steal:** "You don't write copy. You assemble it." Pieces are already in your customer's head — your job is to arrange them in the right order.
- **Apply:** every market we enter, every vertical-specific landing page (dental ≠ legal ≠ home services in claim sophistication).

### Joe Sugarman — The slippery slope
- *Adweek Copywriting Handbook*. Sugarman's "**slippery slope**": every line of copy exists to make the reader read the next line.
- His test: read your copy out loud and identify the line where the reader could plausibly stop. That line is too weak — rewrite until every paragraph has a hook into the next.
- **Steal:** short opening sentences. White space. Conversational paragraph breaks. Each paragraph creates curiosity for the next.
- **Apply:** long-form sales pages, email bodies, video scripts.

### Donald Miller — StoryBrand 7-step
- *Building a StoryBrand* (2017). 7-part framework that turns the customer (not the brand) into the hero of the story:
  1. **A character** (the customer)
  2. **has a problem**
  3. **and meets a guide** (the brand)
  4. **who gives them a plan**
  5. **and calls them to action**
  6. **that helps them avoid failure**
  7. **and ends in success.**
- **Steal:** the guide-not-hero positioning. Brands that center themselves ("our 30-year heritage of excellence") lose to brands that position the customer as hero ("you'll never miss another lead").
- **Apply:** the marketing site home page, the recruiting video, every "about us" page.

---

## Frameworks — when to use which

| Framework | Pattern | Best for | Aggression range |
|---|---|---|---|
| **AIDA** (Halbert) | Attention → Interest → Desire → Action | Long-form sales letters, product pages, full-funnel emails | 2-4 |
| **PAS** | Problem → Agitate → Solve | Cold outreach, ads, problem-aware landing pages, social cuts | 2-4 |
| **BAB** | Before → After → Bridge | Transformation stories, case studies, testimonial framing | 1-3 |
| **4Ps** (Henry Hoke) | Promise → Picture → Proof → Push | Email body, video script, sales-page section blocks | 1-4 |
| **StoryBrand 7-step** | Character → Problem → Guide → Plan → CTA → Failure → Success | Home page, brand video, full-page narrative | 1-3 |
| **5 Stages of Awareness** (Schwartz) | Match copy to Unaware/Pain/Solution/Product/Most-aware reader | Choosing what to lead with on any page | All — meta-framework |
| **Slippery Slope** (Sugarman) | Every line earns the next | Sales pages, long emails, video scripts | All — line-level |
| **Caples 35** | Specific headline patterns ("How to...", "Why...", "When..." etc.) | Headline writing, email subject lines, video first-frame text | All — line-level |

**Default stack for our work:**
- Marketing-site hero: PAS or StoryBrand
- Marketing-site sub-sections: 4Ps
- Email subject line: Caples-style (specific, benefit-driven, 6-10 words)
- Email body: PAS for cold, BAB for warm, story-led (Furey/Halbert) for nurture
- Pricing page: Kennedy offer formula (offer + deadline + cost-of-delay)
- Video script: StoryBrand for explainer, PAS for social cut, BAB for case study

---

## Cialdini's 7 principles — psychology baseline

Every framework above leans on these. They're not separate tactics — they're the gravitational forces every framework arranges around. From *Influence* (1984) and *Pre-Suasion* (2016).

| # | Principle | What to do |
|---|---|---|
| 1 | **Reciprocity** | Give something valuable BEFORE asking. Free 5-min audit, free template, free guide. The audience feels obligated to engage in return. |
| 2 | **Commitment + Consistency** | Get a small yes first. "Want to see a 90-second demo?" → leads to "Want a free trial?" → leads to purchase. Each commitment makes the next easier to keep. |
| 3 | **Social Proof** | Show what other people like them are doing. "Used by 500+ dental practices." "Sarah's office in Allentown captured 23 missed calls last month." |
| 4 | **Authority** | Show expertise + credentials early. Industry-recognized stat citations (Forbes / HBR / BIA-Kelsey). Founder credentials when applicable. |
| 5 | **Liking** | Be similar, complimentary, cooperative. Tenant-facing copy talks like the tenant talks ("you've been juggling missed calls and pricing questions for years"). |
| 6 | **Scarcity** | Limited supply > limited time, when both are available. "100 LTD spots, lifetime price." "First 50 partners get the founding-partner badge." |
| 7 | **Unity** | Shared identity. "Built by service-business owners, for service-business owners." Stronger than liking — implies a tribal in-group. |

**Stacking rule:** real conversion copy uses 3-5 of these in a single email or page. Cold outreach typically: Reciprocity (free thing) + Social Proof (others did it) + Authority (cited stats) + Scarcity (deadline). Hot prospects need: Commitment (small yes) + Unity (us-vs-them) + Scarcity.

---

## Headline formulas — the operational set

Memorize these. They cover ~80% of what you'll ever need.

| Formula | Example | When |
|---|---|---|
| **How to [achieve outcome] (without [common cost])** | "How to capture every missed call without hiring a receptionist" | Pain-aware traffic, evergreen |
| **[N] ways to [achieve outcome]** | "7 calls your front desk is missing every Tuesday" | Curiosity + specificity, list-friendly |
| **Why [unexpected fact]** | "Why 85% of after-hours callers never call back" | News-aware, citation-anchored |
| **The [adjective] way to [outcome]** | "The cheapest way to add a 24/7 receptionist" | Pricing-page traffic |
| **What every [audience] should know about [topic]** | "What every dental office should know about Tuesday-afternoon missed calls" | Vertical-specific landing |
| **If you [condition], here's [solution]** | "If you've ever apologized to a customer for a missed call, this is for you" | Self-identifying audience filter |
| **[Social proof number] [audience] are doing [thing]** | "500+ service businesses are letting AI handle after-hours" | Social-proof opener |
| **[Outcome] in [specific short time]** | "Set up your AI receptionist in under 8 minutes" | Onboarding push, friction-reduction |
| **The [story type] that changed how I [outcome]** | "The voicemail that changed how I think about lead capture" | Story-led nurture email |
| **[Question that names the pain]** | "Tired of explaining missed calls to your customers?" | Cold email, ad copy |

**Anti-formulas to avoid:**
- "Boost your business" (generic)
- "Game-changing" (cliché)
- "Revolutionary" (claims sophistication you haven't earned)
- "We are excited to..." (LLM-default, owner-centered not customer-centered)
- "In today's fast-paced world..." (zero info, zero hook)

---

## Email patterns

### Subject lines
- 6-10 words, specific, customer-focused
- Curiosity > clarity is acceptable for nurture; clarity wins for transactional
- No emojis at Conservative or Balanced tier (only at Direct or Aggressive when contextual)
- No ALL CAPS subject lines except at Aggressive tier
- Personal-from-name ("Crawford from MyOrbisVoice") outperforms brand-from-name in nearly every test

### Body structure (the canonical sequence)

The most-cited email sequence pattern: **welcome → hook → value or story → social proof → soft pitch → hard pitch.** Spread across 5-7 emails over 2-3 weeks for cold lists, compressed into 2-3 emails for warm lists.

**Email 1 — Welcome + Hook**
- Reciprocity (the free thing they signed up for)
- One-line preview of the journey

**Email 2 — Story / Pain agitation (PAS)**
- Specific story: "Sarah's office captured X missed calls last month"
- Pain quantified
- No pitch yet

**Email 3 — Solution intro**
- BAB: before-state, after-state, the bridge (the platform)
- Soft mention of how to start

**Email 4 — Social proof + Authority**
- Customer testimonials (when we have them) or citation-anchored stats
- Authority chips (Forbes, HBR)

**Email 5 — Soft pitch**
- AIDA full sequence
- One CTA, friction-reduced

**Email 6 — Hard pitch + Scarcity**
- Kennedy offer formula
- Real deadline if real, "first 50" if real

**Email 7 — Close + Cost-of-delay**
- "If you don't decide, here's what happens by month's end"
- Last clear CTA, then stop

### Sequence aggression mapping

| Tier | Sequence length | Hard-pitch emails | Notes |
|---|---|---|---|
| Conservative | 7-10 emails over 4-6 weeks | 1-2 (last 2 emails only) | Mostly value, low pressure |
| Balanced | 5-7 emails over 2-3 weeks | 2-3 | Balanced value + offer |
| Direct | 4-5 emails over 7-10 days | 3-4 | Offer-forward, scarcity-anchored |
| Aggressive | 3-5 emails over 3-5 days | All of them | Launch sequences only |

---

## Per-vertical worked examples

The same product needs different framings per vertical. Here's the template for each of our five priority verticals.

### Dental (Conservative)
- **Hook:** "Your front desk closes at 5. Your patients' jaw pain doesn't."
- **Pain:** Cite the AAGD/ADA stat on missed-call drop-offs in dental.
- **Solution:** "An AI receptionist that books cleanings + handles emergencies after hours."
- **Authority:** "Built specifically for dental practices that already use [common PMS]."
- **Offer:** "First month free. We hand you the transcript of every call so you can verify it's working before you pay anything."

### Legal (Conservative)
- **Hook:** "When a potential client calls a personal-injury firm, they call the next firm if you don't pick up. Period."
- **Pain:** Citation: 79% of personal-injury intake calls go to whoever answers first (industry source).
- **Solution:** "Capture every after-hours call, do basic intake, schedule the consult on your calendar."
- **Authority:** "Conflict-of-interest checks built in. No legal advice given. Audit trail per call."
- **Offer:** Conservative — "Schedule a 20-minute walkthrough. Bring a recent voicemail you missed; we'll show you what would have happened."

### Home services (Balanced)
- **Hook:** "Your truck is rolling. Your phone is ringing. Now what?"
- **Pain:** PAS — every missed call between 10am and 4pm goes to the next number on the search results.
- **Solution + Story:** "Mike's HVAC in Phoenix went from missing 14 calls a week to capturing every one of them within 8 days."
- **Social proof + offer:** Specific outcomes + soft urgency (limited onboarding slots this month).

### Fitness (Direct)
- **Hook:** "Your DM inbox doesn't sleep. You shouldn't be the one answering it at 11pm."
- **Pain:** Specific — leads cool fast in fitness; 5-min response window matters more than in any other vertical.
- **Solution:** "AI books trial sessions, answers pricing, handles cancellations. You coach. It admin-s."
- **Direct close:** "First 25 studios get founder pricing — $97/mo locked for life. Tomorrow it's $197."

### Beauty (Direct)
- **Hook:** "She'll book with whoever answers first. After 9pm, that's never you."
- **Pain:** Booking-window economics in beauty / nails / hair.
- **Solution:** Story-led — "Maria's salon in Tampa books 31% more after-hours appointments now."
- **Direct close:** Limited-time founders' rate, scarcity-anchored.

---

## Bilingual considerations

Latin American Spanish persuasion conventions are not US English persuasion conventions translated. Patterns to honor:

- **Informal *tú* form** throughout, never *usted* (per existing CLAUDE.md rule).
- **Family / community framing** lands harder than individualism. "Your business takes care of your family" outpulls "grow your revenue 30%" in nearly every Latin-market split test.
- **Trust-building before offer** is more important. Cold US copy can pitch in email 2; cold LatAm copy usually waits till email 4-5.
- **Idioms that don't translate:**
  - "Game-changer" → "esto cambia las reglas del juego" (works) — never "cambia-juego" (literal, awful)
  - "Move the needle" → drop entirely or replace with "marca una diferencia"
  - "Bottom line" → "lo que importa al final"
  - "No-brainer" → drop entirely; sounds dismissive in Spanish
- **Currency stays in USD** ($) per CLAUDE.md, but LatAm tenants often want context: "$497 USD (aproximadamente $9,500 MXN)" — only when relevant.
- **Authority chips translate.** Forbes is Forbes. HBR keeps its English name. BIA-Kelsey keeps its English name. Stat itself gets the Spanish wrapper.

---

## Anti-patterns (the don't-do list)

These are the patterns LLM-generated copy regresses to by default. The AI-Assist prompt will explicitly prohibit them.

| Anti-pattern | Example | Why it's bad |
|---|---|---|
| LLM hedging | "It might be worth considering whether you could potentially benefit from..." | Costs the read. Direct response is direct. |
| Owner-centered openings | "We are excited to..." | Customer doesn't care about your excitement. |
| Adjective stacking | "Powerful, intuitive, beautiful, modern platform" | Zero info, zero hook. Stack proof, not adjectives. |
| Feature lists in prose | "Our platform includes voice, SMS, email, calendar, CRM, and..." | Bullets exist for a reason. Prose is for stories + arguments. |
| Cliché urgency without enforcement | "Don't miss out!" / "Limited time!" without a real deadline | Burns trust. Kennedy says this is the fastest way to lose direct-response credibility. |
| Generic social proof | "Trusted by businesses worldwide" | Specific or nothing. "500+ dental practices" or don't say it. |
| Buzzwords | "Revolutionary," "synergy," "leverage," "best-in-class" | Sophistication signal that hasn't been earned. |
| Apology framing | "We know your time is valuable, but..." | Lowers the writer's status. Direct response writers never apologize for selling. |
| Walls of text | 200-word paragraphs, no breaks | Sugarman: every paragraph ends, the reader bounces. |
| LLM-default niceness | "Hope this finds you well!" / "Just wanted to reach out!" | Reads as low-effort. Cold opens that work are specific or pattern-interrupting. |

---

## Voice rules per surface

| Surface | Voice |
|---|---|
| Marketing site home page | Customer-as-hero (StoryBrand), conversational, citation-anchored. |
| Marketing site product pages | Solution-aware framing (Schwartz stage 3-4). |
| Marketing site pricing page | Kennedy offer formula. Specific. |
| Tenant dashboard empty states | Helpful + specific. "No conversations yet — try a 30-second test call." |
| Tenant onboarding emails | Furey-style story-led nurture, escalating to direct offers. |
| Partner pitch material | StoryBrand for the deck, Halbert-style emotional + math for the elevator pitch. |
| Agent voice scripts (live calls) | Conversational, brief, no sales-pitch energy on inbound (refuse-info rule applies). Direct on outbound campaigns. |
| Help-center articles | Plain task-doc voice. Persuasion isn't relevant — clarity is. |
| Error messages + form validation | Plain + helpful. Never "oops!" Never apologetic. |
| Audit-log and admin surfaces | Neutral, factual. No persuasion. |

---

## Feature spec — Aggression Settings (proposed)

This is a feature design proposal, not yet built.

### Schema additions

```prisma
// Add to BusinessProfile (tenant-level default)
aggressionTier String @default("balanced")
// Values: 'conservative' | 'balanced' | 'direct' | 'aggressive'
```

```prisma
// Add to Campaign (per-campaign override; null = use tenant default)
aggressionTier String?
```

```prisma
// Add to AffiliateAccount (partner-level default for partner-pitch material generation)
aggressionTier String @default("balanced")
```

### UI surfaces

1. **Tenant `/settings`** — new "Marketing voice" card with 4 radio options + a sample email shown for the selected tier (live preview).
2. **Campaign editor** — dropdown override per campaign with "(use workspace default)" pre-selected.
3. **Partner profile** — same as tenant settings, partner-scoped.
4. **AI-Assist injection** — every "Generate copy" call passes the active aggression tier to the system prompt; the model is instructed to operate at that intensity.

### Sample-preview content per tier

The settings card shows the same campaign rewritten at all four tiers so the tenant sees the difference before picking. Same scenario: a missed-call follow-up email.

| Tier | Sample subject | Sample first line |
|---|---|---|
| Conservative | "We tried to reach you" | "Hi {firstName}, I noticed your call earlier today went to our after-hours line. I wanted to follow up personally..." |
| Balanced | "About your call yesterday" | "Hi {firstName} — when you called yesterday at 7:42pm, our team had already gone home. I'm sorry you didn't get through..." |
| Direct | "You called. Nobody picked up. Here's what happens now." | "{firstName}, you called at 7:42pm yesterday. Nobody answered. That's the exact problem we built MyOrbisVoice to fix." |
| Aggressive | "{firstName}, your call was lost. (Don't lose the next one.)" | "Last night at 7:42pm, you tried to reach us. We failed you. Here's the deal: 5 minutes from now, that won't happen again." |

### Default + safety

- New tenants default to Balanced.
- New partners default to Balanced.
- Aggressive tier shows a warning on selection: "Aggressive tone is best for short campaigns (Black Friday, launches). Using it as a baseline burns prospect trust over time. Sure?"
- Marketing site itself stays at Balanced — does not vary by visitor.

---

## Audit pass — what to rewrite (placeholder)

To be filled in during the audit pass. Each marketing surface gets scored:
- Framework match (does it follow a recognized pattern?)
- Awareness-stage match (does the copy address the right awareness level for the visitor?)
- Cialdini stacking (how many of the 7 principles are present?)
- Anti-patterns present
- Citation discipline (every claim sourced?)

Surfaces to audit:
- `site/index.html` (en + es)
- `site/solutions.html` (en + es)
- `site/pricing.html` (en + es)
- `site/how-it-works.html` (en + es)
- `site/partner.html` (en + es)
- All onboarding emails
- All campaign default templates
- Login + signup page subtitles + microcopy
- Tenant dashboard empty states (every page)

---

## Changelog

### 2026-05-09 — Document established

- Initial framework based on Perplexity-named copywriters (Caples, Halbert, Wiebe, Kennedy, Furey, Copyhackers) plus the user's specific request.
- Added: Eugene Schwartz (5 Stages of Awareness), Joe Sugarman (slippery slope), Donald Miller (StoryBrand 7-step), Cialdini's 7 principles.
- Aggression Spectrum (4-tier) introduced as a tenant + partner setting.
- Per-vertical worked examples for the 5 priority verticals (dental, legal, home services, fitness, beauty).
- Bilingual considerations for Latin American Spanish surface.

---

## Sources

- [Tested Advertising Methods — John Caples](https://www.amazon.com/Advertising-Methods-Prentice-Business-Classics/dp/0130957011) (4th edition, 1974)
- [4 Copywriting Lessons From Caples — Maverick Words](https://maverickwords.com/4-copywriting-lessons-from-john-caples-tested-advertising-methods)
- [The Boron Letters Summary — Drop Dead Copy](https://www.dropdeadcopy.com/the-boron-letters/)
- [AIDA Formula Gary Halbert — SwipeFile](https://swipefile.com/aida-formula-gary-halbert)
- [Halbert's Coat of Arms Letter — Bert Shields Copy](https://bertshieldscopy.com/2018/07/31/halberts-coat-of-arms-letter/)
- [Joanna Wiebe + Conversion Copywriting — Conversion Sciences](https://conversionsciences.com/writing-killer-conversion-copy-with-joanna-wiebe-of-copyhackers-com-audio/)
- [Conversion Copy Course Takeaways — Copyhackers](https://copyhackers.com/2022/04/conversion-copy-course/)
- [Dan Kennedy's 10 Commandments — Connector Economy Hub](https://connectoreconomyhub.com/blog/dan-kennedy-10-commandments)
- [Dan Kennedy 10 Rules — Substack](https://cashflowkingdom.substack.com/p/dan-kennedys-10-commandments-of-direct)
- [Cialdini's 7 Principles — Influence at Work](https://www.influenceatwork.com/7-principles-of-persuasion/)
- [Cialdini's 7 Principles for Conversion — CXL](https://cxl.com/blog/cialdinis-principles-persuasion/)
- *Breakthrough Advertising* — Eugene Schwartz (1966)
- *Adweek Copywriting Handbook* — Joe Sugarman
- *Building a StoryBrand* — Donald Miller (2017)
- *Influence: The Psychology of Persuasion* — Robert Cialdini (1984)
- *Pre-Suasion* — Robert Cialdini (2016)
