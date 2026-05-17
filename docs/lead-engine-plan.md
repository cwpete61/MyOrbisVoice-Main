# Plan — Lead Engine (per-partner scraping + enrichment)

**Status:** plan / awaiting build approval. Drafted 2026-05-17.

A per-partner lead-sourcing system in the partner-portal **lead section**.
Inspired by "9x12 Lead Scout": a partner runs an industry + location
search, the engine finds local businesses and enriches each with contact
data, the partner reviews the leads and promotes the good ones into their
CRM, then works them via **cold email**.

**Sourcing decision (2026-05-17): Hybrid.** Self-host Google Maps + website-
email scraping (high value, lower risk, cheap per lookup). Paid API for
social enrichment if/when Phase 2 ships. No all-self-hosted (maintenance +
ban war), no all-paid (cost + vendor lock for the easy 80%).

---

## The model

1. **Search** — partner enters industry + location + result count. A job
   runs the Google Maps scraper → local businesses (name, address, phone,
   website, rating, sometimes owner name).
2. **Enrich** — for each business with a website, crawl it for a contact
   email + contact info. (Phase 2: social profiles.)
3. **Stage** — enriched results land in a `Lead` staging table, scored and
   deduped. Noisy scrape output never pollutes the real CRM directly.
4. **Review** — partner sees leads in the lead section, saves / accepts /
   rejects (mirrors Lead Scout's Saved Leads + Search History).
5. **Promote** — accepted lead → `Contact` in the CRM "New Lead" pipeline
   stage (the partner CRM already has this stage).
6. **Work** — partner runs the contact through **cold email only** (see
   compliance wall). AI email-intro generator assists.

---

## Architecture

- **`myorbisvoice-leadengine`** — a new isolated Python container (the
  scrapers are Python; the app stays Node/TS). Own Docker network entry,
  **own proxy egress** — scraping never runs from the prod box's bare IP
  (shared server; an IP ban would hit neighbors). Follows the CLAUDE.md
  isolation rule (`myorbisvoice-*` prefix, own network).
- **Google Maps** — `omkarcloud/google-maps-scraper` self-hosted in that
  container. The one repo with real traction; check its license before
  embedding.
- **Website email** — reimplemented clean (fetch site, crawl `/contact`
  `/about`, regex emails, filter role/junk addresses). ~100 lines — do NOT
  import the unvetted email-scraper repos; scraper repos are a known
  malware vector. Read for technique, write our own.
- **Internal API** — the leadengine exposes a small internal HTTP API
  (submit search / poll status / fetch results); the Node API calls it and
  owns all persisted data. The app stays system-of-record.
- **Job queue** — Redis-backed (platform already runs Redis). Async; the
  partner watches search status (PENDING → RUNNING → COMPLETED).

---

## Data model (new)

- **`LeadSearch`** — `partnerId`, `industry`, `location`, `resultCount`,
  `status`, lead/email counts, `createdAt`. Drives the Search History view.
- **`Lead`** — staging row. `searchId`, `partnerId`, `businessName`,
  `ownerName?`, `email?`, `phone?`, `website?`, `address`, `rating?`,
  `socialsJson?`, `enrichmentStatus`, `score`, `reviewStatus`
  (`NEW`/`SAVED`/`ACCEPTED`/`REJECTED`), `promotedContactId?`.
- **Per-partner search credits** — searches cost credits (Lead Scout shows
  a remaining-credits meter). Counter on `AffiliateAccount` or a ledger.

---

## Compliance wall — non-negotiable

A scraped lead has consented to nothing. Carries `source = SCRAPED`,
`consentStatus = NONE`.

- The voice gateway, SMS service, and campaign engine **must refuse** to
  auto-contact a Contact that is `SCRAPED` + `consentStatus = NONE`.
  Texting/AI-calling scraped numbers = A2P brand death + TCPA liability.
- Scraped leads are reachable by **cold email only**, through the isolated
  cold-email sending domain (separate from transactional/booking mail) with
  CAN-SPAM enforced: unsubscribe link, instant honor, physical postal
  address (partner address fields already exist), suppression list checked
  before every send.

---

## Phasing

**Phase 1 — Google Maps + website email.** The leadengine container,
`LeadSearch` + `Lead` models, the partner-portal Lead Search UI (industry /
location / count → results table → save → promote to CRM), credits. This
alone yields a complete cold-email-ready B2B lead — 80% of the value, 20%
of the risk.

**Phase 2 — social enrichment.** LinkedIn / Instagram / TikTok / YouTube
via a paid scraping API (self-hosted social scrapers are a losing ban war).
Behind a flag; partner-approved spend.

**Phase 3 — cold-email engine.** AI email-intro generator + send pipeline.
Builds on the uncommitted `email-policy` / `email-bulk-policy` /
`email-suppression` / `email-webhook` work already in the tree.

**Optional** — Route Planner (door-to-door TSP optimization) like Lead
Scout, if partners do in-person prospecting.

---

## Open items to confirm before/while building

- **Cold-email sending domain** — one platform subdomain, or per-partner
  domains (each partner owns their own reputation)? Big fork.
- **Costs + credits** — per-partner credit model; who funds the paid social
  API + the residential proxy provider for self-hosted scraping. Both are
  paid line items → need explicit authorization (no-unauthorized-purchase
  rule).
- **`omkarcloud/google-maps-scraper` license** — verify it permits
  embedding before Phase 1.
- **Lead scope** — partner-only, or also surfaced to tenants?
- **Enrichment depth** — contact fields only, or firmographics / intent
  signals too?

## Risks

- Untrusted repos — reimplement, never import unvetted scraper code.
- ToS — Google/LinkedIn/IG/TikTok/FB all prohibit scraping; LinkedIn
  litigates. Self-hosted scraping carries breakage + IP-ban risk.
- Prod-IP isolation — scraping egress must be proxied, never the shared
  Contabo IP.
- Legal — cold email is CAN-SPAM-legal in the US with the rules followed;
  social scraping is the hottest exposure (Phase 2 gate).
