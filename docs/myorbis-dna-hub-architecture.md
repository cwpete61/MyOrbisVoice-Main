# MyOrbis DNA Hub — Architecture (author once, used everywhere)

> Goal: customers build their Business DNA **once, in MyOrbisResults**, and every
> product (Voice, Local, Web, Reviews, …) consumes it — no per-app re-entry, no
> editing inside Voice. The Hub is the system-of-record. Voice keeps running
> throughout (staged, non-breaking migration). No code yet — design of record.
> Drafted 2026-06-07.

## Today
Voice owns `BusinessDNA` (per-tenant, versioned `version`/`isActive`, 9 JSON
sections: identity, services, pricing, operations, sales, appointment, support,
language, compliance). Voice's prompt engine reads it locally. Editing is inside
Voice. That's what we're moving up.

## Target end-state
- **One editor** in MyOrbisResults (AI-assisted) → writes the **Hub** (canonical,
  versioned, audited).
- **Every product** reads its **effective DNA** from the Hub; new products inherit
  it automatically on purchase.
- **Voice** consumes the Hub DNA (cached + fallback); its in-app editor becomes a
  read-only "Edit in MyOrbisResults" view.

## 1. Canonical schema — shared core + per-product overlays
Designed for ALL products, not Voice's shape:
- **Core (entered once):** identity, services, pricing, hours, locations, policies,
  language, compliance, brand voice.
- **Product overlays (optional, per product):** `voice.*` (escalation, call
  scripts), `web.*` (SEO, page copy, visual brand), `reviews.*` (response tone,
  templates), `local.*` (GBP categories).
- Versioned + `isActive` + publish workflow + **audit on publish** (per platform
  rule). Mirrors Voice's version model.

## 2. Hub model + API
- `BusinessDNA` model in the Hub: `tenantId`, `version`, `isActive`, `coreJson`,
  `overlaysJson` (keyed by productCode), timestamps. `@@unique(tenantId, version)`.
- `PUT /v1/tenants/:id/dna` — upsert/publish the active DNA (service-token).
- `GET /v1/tenants/:id/dna` — full canonical (editor reads this).
- **`GET /v1/tenants/:id/dna/effective?product=VOICE`** — returns **core + that
  product's overlay merged** ("effective DNA"). Each app fetches its slice.

## 3. AI-assisted DNA building (the time-saver)
The MyOrbisResults editor **auto-drafts** DNA: enter business name + website + GBP
→ enrich/scrape → OpenAI fills identity/services/pricing/hours → user reviews +
edits (never types from scratch). Platform already uses OpenAI. One draft seeds
every product.

## 4. Onboarding capture
After checkout (`/start` → paid), a **"Build your DNA" wizard** runs once → writes
the Hub → every purchased product is provisioned DNA-aware. DNA is part of signup.

## 5. Auto-apply on provisioning
On entitlement grant, the **n8n provisioning flow reads the Hub effective DNA and
seeds the new product**. "Apply across all apps" becomes automatic on purchase.

## 6. Voice migration — staged, non-breaking
1. **Backfill** Voice's active DNA → Hub (`coreJson` from Voice's sections;
   Voice-specific bits → `overlays.voice`). Voice still reads local → zero change.
2. **Shadow/parity:** Voice fetches Hub effective DNA, compares to local, logs
   diffs (no behavior change) — validates trust, same as the entitlement flip.
3. **Flip:** Voice reads canonical DNA from the Hub (cached, **fallback to local
   on miss** → never breaks). Hot path stays safe.
4. **Retire Voice editor:** becomes read-only "Edit in MyOrbisResults." Authoring
   now lives only in MyOrbisResults.

## Phases
- **P1 (foundation):** Hub `BusinessDNA` model + `PUT/GET` + **backfill** Voice DNA.
  Additive, non-breaking. Identical regardless of later choices → safe to start.
- **P2:** DNA editor in the MyOrbisResults dashboard (+ AI-assisted drafting) → Hub.
- **P3:** `effective` resolver + products consume their slice; new products read on
  provision.
- **P4:** Voice shadow → flip (cached+fallback) → retire Voice's editor.
- **P5:** onboarding "Build your DNA" wizard + n8n auto-provision.

## Reuses (proven pieces)
- The **entitlement-consolidation pattern** (Voice→Hub sync, shadow, gated flip) —
  this is the same playbook for DNA.
- `packages/prompt-engine` (DNA consumer logic), the dashboard app (editor home),
  the storefront onboarding, n8n provisioning, OpenAI (drafting).

## Why this is better than a straight port
A plain "move Voice's editor up" gives one product's shape and manual entry. This
gives a **product-agnostic canonical schema (core + overlays + effective resolver)**
+ **AI-assisted authoring** + **onboarding capture** + **auto-provision** — a real
DNA platform, with the same non-breaking migration.
