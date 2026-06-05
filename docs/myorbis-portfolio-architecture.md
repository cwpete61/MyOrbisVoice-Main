# MyOrbis Portfolio Architecture — Account Hub, Entitlements & Consolidated Billing

> **Scope:** This is a **parent-brand (MyOrbisResults) architecture doc**, not a
> MyOrbisVoice-only doc. It is drafted in the MyOrbisVoice repo because Voice is
> the most-affected existing product and this is the active workspace. When a
> dedicated MyOrbisResults / Account-Hub repo exists, this becomes the canonical
> source there (mirror or move). Do **not** treat it as a Voice-internal design.
>
> **Status:** Decisions locked 2026-06-05. No code written yet — this is the
> agreed target architecture to build toward.
>
> **⚠️ NOTE (2026-06-05): MyOrbisLocal is ON HOLD** until the Account Hub
> modification (this architecture — identity + entitlements + consolidated
> billing + Voice cutover) is done. MyOrbisReviews and box #2 provisioning may
> proceed, but the full MyOrbisLocal build does not start until the modification
> is complete, so Local is built against the Hub from day one rather than
> retrofitted.

---

## 1. Problem

MyOrbisResults is the parent brand over sibling products: **MyOrbisVoice**,
**MyOrbisLocal**, **MyOrbisReviews** (a Local-aligned lead-gen wedge into the
larger Local agency offering), **MyOrbisWeb**, and **Staff Training**.

A tenant may buy **any combination** of these. Two requirements drive this
architecture:

1. **Enter basic business info once** — no repetitive data entry across products.
2. **One commercial relationship** — central onboarding + a single consolidated
   invoice through MyOrbisResults, not independent per-product invoicing.

…while preserving **product runtime isolation** (a crash/exploit/deploy in one
product must not bleed into another).

---

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| Identity | System of record for shared tenant data | **Central Account Hub (parent-brand owned)** |
| Key | Canonical tenant identifier | **Hub adopts Voice's existing tenant UUIDs as the canonical `tenantId`** (no FK rewrite) |
| Auth | Sign-in across products | **SSO via Keycloak (self-hosted)** |
| Sync | How products get shared data | **API-first + event/webhook cache invalidation; eventual consistency; products tolerate Hub-down via local cache** |
| Stripe account | One vs many | **Promote Voice's existing Stripe account; rebrand billing name → MyOrbisResults** (settings change, not migration; assumes same legal entity) |
| Subscription shape | Invoice structure | **Single subscription per customer, multiple items** → one native consolidated invoice with per-product line items |
| Existing Voice customers | Migration | **Grandfather** existing subs; **new + expansion** bill centrally. Migrate legacy later, gradually |
| Pricing presentation | Packaging | **Both** — à la carte (Reviews wedge entry) **+** bundles (e.g. "Trifecta" for expansion/discount) |
| Isolation tier (box #2) | Container separation | **Tier A** — per-stack network + volumes + project on shared rootful daemon (skip rootless; same trust domain) |
| Reverse proxy (box #2) | Proxy layout | **One shared Caddy + per-product `conf.d/` fragments** (each product owns its fragment) |

---

## 3. Architecture overview

```
                 ┌──────────────────────────────────────────────┐
                 │   MyOrbis Account Hub  (MyOrbisResults)         │
                 │   SYSTEM OF RECORD for shared tenant data       │
                 │   • canonical tenantId    • SSO (OIDC)          │
                 │   • business profile      • entitlement matrix  │
                 │   • users / roles         • ONE Stripe customer │
                 │   • consolidated billing (single subscription)  │
                 └───┬───────────────┬────────────────┬───────────┘
        SSO + sync   │               │                │
        (HTTPS +     ▼               ▼                ▼
        service auth)
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │ MyOrbisVoice │  │ MyOrbisLocal │  │MyOrbisReviews│  ( + Web, Training )
            │  (box #1)    │  │  (box #2)    │  │  (box #2)    │
            │ own DB       │  │ own DB       │  │ own DB       │
            │ + cached     │  │ + cached     │  │ + cached     │
            │   profile/   │  │   profile/   │  │   profile/   │
            │   entitlement│  │   entitlement│  │   entitlement│
            └──────────────┘  └──────────────┘  └──────────────┘
```

**Principle:** the Hub owns the shared truth; each product **caches** the subset
it needs and keeps its own operational data. No product points at a shared live
database — that would re-introduce the coupling/bleed we are avoiding.

---

## 4. Data ownership

| Hub owns (enter once) | Product owns (isolated, per-stack DB) |
|---|---|
| **`tenantId`** (canonical join key) | Voice: Business DNA, prompts, agents, channels, conversations, Twilio, A2P |
| Business identity: legal/DBA name, logo, brand | Local: GMB data, audits, rankings |
| Contact: address, phone, email, website, hours, timezone, languages | Reviews: review campaigns, review records, lead capture |
| Users + roles (for SSO) | each product's own jobs/config |
| **Product entitlement matrix** (who has Voice / Local / Reviews / …) | each product enforces its own entitlements (reads synced copy) |
| Billing: **one Stripe customer** per tenant; single multi-item subscription | each product = named Stripe Price(s) as line items |

---

## 5. Canonical tenant ID — the one non-negotiable

The Hub uses **Voice's existing tenant UUIDs** as the canonical `tenantId`.
Every product uses it as the foreign key. Consequence:

- Voice's **134 `tenantId` FKs across 87 models do not change.**
- Greenfield Local/Reviews adopt the Hub's `tenantId` from day one.
- **Never** let a product mint its own tenant IDs and reconcile later — that is
  the worst pain in this whole design.

---

## 6. Identity & SSO

- Hub is the **identity provider** (OIDC/OAuth2). Products are clients.
- One login, one password reset, MFA centralized.
- **Do not hand-roll OIDC.** Use an off-the-shelf IdP. *Open decision:* Keycloak
  or Ory (self-host, free, you operate) vs WorkOS/Clerk (hosted, paid, less ops).
- Voice's existing `User` model is already OAuth-ready (`googleId`, `passwordHash`,
  refresh tokens) — good bootstrap source, but auth moves up to the Hub.

---

## 7. Sync model

- **API-first:** products fetch the tenant profile + entitlement set on
  login/session and **cache** locally.
- **Event/webhook:** Hub fires on profile/entitlement change → products bust cache.
- **Eventual consistency:** products serve the last-known cached copy if the Hub
  is briefly unreachable. **A Hub outage must never block product runtime** — see
  the Voice hot-path rule below.
- n8n (already the Voice orchestrator) can drive provisioning/sync workflows.

---

## 8. Consolidated billing (Stripe)

- **One Stripe account** = Voice's existing account, **rebranded to MyOrbisResults**
  (public business name + statement descriptor + branding). Settings change only;
  no customer/subscription/payment-method migration. **Assumes same legal entity** —
  confirm before executing.
- **One Stripe Customer per tenant** (at the Hub).
- **Each product = named Stripe Price(s):** `MyOrbisVoice — Pro`,
  `MyOrbisLocal — Agency`, `MyOrbisReviews — Starter`, etc.
- A tenant's combination = **multiple subscription items on one subscription** →
  Stripe emits **one consolidated invoice with per-product line items.**
- **Entitlement flow:** Stripe webhook → Hub updates entitlement matrix →
  products read their flag (synced/cached).
- **Pricing:** à la carte **and** bundles.
- **Customer comms:** notify existing Voice customers before the statement
  descriptor flips `MYORBISVOICE → MYORBISRESULTS` (classic chargeback trigger).

---

## 9. Hosting & network

- **Two Contabo servers, separate VPS:**
  - **Box #1 `147.93.183.4`** (`vmi2716750`, ~23 GiB RAM): runs **MyOrbisVoice**
    (full stack) + unrelated off-limits tenant stacks (bps_zf, zerofees, lightbox,
    yt_transcriber). Shared/fragile Caddy here — do not repeat the monolithic
    Caddyfile mistake.
  - **Box #2 `109.123.249.34`** (`vmi3318357`, Ubuntu 24.04, 11 GiB RAM, 6 cores,
    ~190 GB free): **bare** today. Earmarked for the **Local family** — MyOrbisLocal
    + MyOrbisReviews. Needs first-time provisioning (Docker + Caddy + first compose).
- **Account Hub** = its own small stack (identity-api + own Postgres + Redis).
  Likely **box #1** (RAM headroom, already runs billing/Stripe), but it serves
  products on **both** boxes.
- Boxes are separate VPS → **no private docker network spans them.** Cross-box
  Hub access is over **HTTPS with service-to-service auth** (signed service tokens
  or mTLS), not a shared docker network.

### Box #2 isolation (Local + Reviews)

```
Box #2 (Ubuntu 24.04)
├── /opt/myorbislocal     → compose project "myorbislocal"
│     ├── network: local_net      (own bridge)
│     ├── volumes: local_pg, local_redis
│     ├── containers: myorbislocal-{api,web,postgres,redis,...}
│     └── .env.prod (600)
├── /opt/myorbisreviews   → compose project "myorbisreviews"
│     ├── network: reviews_net    (own bridge)
│     ├── volumes: reviews_pg, reviews_redis
│     ├── containers: myorbisreviews-{api,web,postgres,redis,...}
│     └── .env.prod (600)
└── Caddy (shared) → conf.d/myorbislocal.caddy + conf.d/myorbisreviews.caddy
```

- Per-stack network + volumes + project → neither stack can reach the other's
  services or data by default.
- **Reviews → Local lead handoff via API/webhook, NOT a shared DB** — preserves
  isolation while serving the land-and-expand funnel.
- Per-service `mem_limit`/`cpus` (11 GiB shared; Local's agency build is the hog —
  it, not Reviews, is what eventually forces a VPS bump).

---

## 10. Phased Voice cutover (Voice stays live throughout)

Voice is the most-affected product (shared identity is currently baked into its
deep schema). Cut over in stages — never a big-bang.

- **Phase 0 — Hub stands up.** Build Account Hub; **backfill it from Voice's
  existing tenants/users/Stripe** (Voice is the bootstrap source). Hub adopts
  Voice's tenant UUIDs as canonical.
- **Phase 1 — Central onboarding + billing for NEW/expansion.** New customers and
  any cross-product purchase go through MyOrbisResults (Hub + the rebranded Stripe
  account, single multi-item subscription). Existing Voice-only subs untouched
  (grandfathered).
- **Phase 2 — SSO cutover.** Voice becomes an OIDC client of the Hub. Run Hub IdP
  **alongside** Voice's current auth, then retire the local path. (Highest-risk
  step — phase it.)
- **Phase 3 — Entitlements from Hub.** Voice reads its entitlement set from the
  Hub (cached); keeps its existing gating/enforcement code (only the *source*
  changes).
- **Phase 4 — Migrate legacy billing (optional/gradual).** Move grandfathered
  Voice subs onto the consolidated multi-item subscription model.

### Voice hot-path rule (protect this)

Widget/inbound realtime sessions resolve tenant by `publicKey → tenantId` against
the **local cached** tenant projection. **Voice sessions must never block on Hub
availability.** No Hub call on the live audio path; no added latency; degrade to
cache on Hub outage.

---

## 11. Decisions — RESOLVED 2026-06-05

1. **IdP:** **Keycloak, self-hosted.** Runs as its own stack on box #1.
2. **Bootstrap path:** **Fresh Hub + phased migrate.** Stand up a new Hub,
   backfill from Voice's data, migrate Voice to consume it in phases (Voice stays
   live). Lower risk than extracting auth out of the live app up front.
3. **Hub home:** **Own stack on box #1** (RAM headroom, co-located with Voice
   billing/Stripe). Serves products on both boxes over HTTPS + service auth.
4. **Legal entity:** **MyOrbisResults is the entity** → Stripe rebrand is a
   pure display-name settings change (no new account, no tax/payout impact).
   *(Confirm MyOrbisResults is the same legal company already on Voice's Stripe
   account before executing the rebrand.)*

---

## 12. Next steps (no code until approved)

1. Resolve the four open decisions above.
2. Provision box #2 (Docker + Caddy baseline) — separate runbook.
3. Account Hub schema + service spec (identity + entitlements + billing).
4. Reviews→Local lead-handoff contract (API/event shape).
5. Voice Phase 0 backfill plan.
