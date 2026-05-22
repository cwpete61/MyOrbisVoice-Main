# GMB Evaluation — Partner Door-Opener (spec)

> **Status:** spec, 2026-05-22. No code yet — review before building.
> **Lives in:** OrbisVoice repo (the partner program is the parent / MyOrbisResults
> sales surface for all products). The GBP-audit engine is written portable so it
> later powers MyOrbisLocal's Phase A and any white-label instance.

---

## Purpose

A lead-gen wedge for **Partners** (the sales channel). A partner enters a
prospect business, the tool pulls that business's Google Business Profile data and
scores it, and produces a shareable branded report. The partner uses it as a
foot-in-the-door to pitch the trifecta (MyOrbisVoice + MyOrbisLocal + MyOrbisWeb).

**Read-only audit only.** No content generation, no publishing, no GBP writes.
This scope is deliberate — it's a clean slice that ships fast without touching the
larger MyOrbisLocal build ("no chaos").

---

## Placement

- **Partner portal** (`apps/web/src/app/(partner-portal)/`) — a new "GMB Evaluation"
  section/page where partners run + revisit evaluations.
- API routes under the partner-scoped surface (`apps/api/src/routes/`), RBAC-gated
  to the affiliate/partner role.

---

## Data source: Serper.dev (no OAuth)

Partner types a business name + city (optionally website). The engine queries
Serper.dev — no prospect login required, ideal for cold prospecting.

- **Places / Maps lookup** → name, address, phone, primary + secondary categories,
  rating, review count, hours, website, photos count.
- **Maps search** for `[category] [city]` (and any target keywords) → the prospect's
  **map-pack / local-3-pack position** vs competitors.
- Optional reviews endpoint → recent review velocity / rating trend.

Cost: ~$0.001–0.003 per query, a few queries per evaluation. Free tier ~2,500
credits to start.

**Provider interface is swappable.** Engine talks to a `GbpDataProvider` interface;
Serper is the first implementation. DataForSEO, Google Places, or the real GBP API
can slot in later without touching the scoring logic.

---

## Engine (portable module)

A self-contained module with **no coupling to OrbisVoice domain models**, so it
lifts cleanly into MyOrbisLocal later:

```
apps/api/src/services/gmb-audit/
  index.ts            evaluate(input) → AuditResult
  providers/
    serper.ts         GbpDataProvider impl (Serper.dev)
    types.ts          GbpDataProvider interface + raw profile shape
  scoring.ts          pure scoring fns (no I/O)
```

`evaluate({ businessName, city, website?, keywords?[] })` → fetch via provider →
score → return a typed `AuditResult`. Scoring functions are pure (testable, no
network).

### Scoring dimensions

Each scored 0–100 with a short plain-language finding + fix recommendation:

- **Categories** — primary set correct + sufficient secondary categories vs the
  competitor frequency table for the niche.
- **Profile completeness** — hours, website, phone, description, attributes present.
- **Map-pack visibility** — position for target keywords; "not in top 3" = headline gap.
- **NAP consistency** — name/address/phone coherent across the returned data.
- **Photos** — count + recency.
- **Reviews** — count, average rating, velocity.

Output = an overall score + per-dimension breakdown + ranked list of gaps (the
sales hooks).

---

## Output: interactive screen + branded report

1. **Interactive audit screen** (partner portal) — the partner walks the prospect
   through it live (call / screen-share). Per-dimension scores, gaps, map-pack
   position visual.
2. **Branded report export** — PDF + shareable web link the partner leaves behind.

### Brand parameterization (white-label ready)

The report carries a **brand context** (logo, colors, company name, contact, domain)
resolved per-partner — never hardcoded. Default = MyOrbisResults branding; a
white-label partner's brand slots in via the same parameter. Honor this from day
one; retrofitting branding later is expensive.

---

## Data model (one new table)

```
GmbEvaluation
  id            uuid
  partnerId     -> AffiliateAccount (who ran it)
  businessName  string
  city          string
  website       string?
  overallScore  int
  result        jsonb   (full AuditResult: per-dimension scores + gaps)
  rawPayload    jsonb   (provider response, for re-render without re-querying)
  createdAt     datetime
```

Lets partners revisit past evaluations and re-export reports without spending
another Serper query.

---

## Secrets

- Serper API key stored **write-only**, encrypted, in `SystemConfig`
  (Admin → System Settings). Never in the repo, never returned to the browser.
- Per-workspace rate cap on evaluations (entitlement) to bound Serper spend.

---

## Bilingual (mandatory)

EN + ES ship together — both the audit screen strings and the report. Spanish =
Latin American, informal "tú". Universal references (brand names, `MyOrbisVoice`,
provider names) stay English. Run `pnpm i18n:check` before "done".

---

## Build sequence (when greenlit)

1. `GmbEvaluation` model + migration.
2. Engine module + Serper provider + scoring (pure fns + unit tests).
3. API routes (run evaluation, fetch past, export report) — partner RBAC.
4. Partner-portal screen (interactive audit) — EN/ES.
5. Branded report (web link + PDF) — brand-parameterized — EN/ES.
6. Admin: Serper key field in System Settings + per-plan evaluation cap.
7. Manual verification: run a real prospect, both languages, report export, brand swap.

---

## Reuse into MyOrbisLocal

The `gmb-audit` engine is the front half of MyOrbisLocal's Phase A (GBP + Category
Audit). When MyOrbisLocal is built, lift this module across (separate repo → copy,
not a shared package) and add the connected-mode GBP-API provider behind the same
`GbpDataProvider` interface.
