# Webinar Marketing

Partner-scoped lead discovery + invite list system. Lives in the partner
dashboard under **Webinar Marketing**. Discovers business contacts by
niche + location, verifies them, and builds compliant invite lists.

> **Compliance-first.** Free-mail addresses (gmail, yahoo, etc.) NEVER
> auto-promote to the invite database. They land in a manual-review
> quarantine and require explicit `consentStatus` + `lawfulBasisNotes`
> from the operator. `sourceUrl` is always recorded to satisfy GDPR
> Art. 14 disclosure-of-source.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  PARTNER DASHBOARD (Next.js)                     │
│  /partner-portal/webinar-marketing                               │
│   - List builder                                                 │
│   - Discovery progress                                           │
│   - Manual review queue                                          │
│   - Suppression mgmt                                             │
│   - CSV export                                                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │  REST  /api/partner/webinar-marketing/*
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                       API (apps/api)                             │
│  routes/partner-webinar-marketing.ts                             │
│  services/webinar-marketing/                                     │
│   - lists.service.ts        CRUD + zod validation                │
│   - audit.service.ts        WebinarAuditLog append helper        │
│   - worker.service.ts       setInterval pipeline driver          │
│   - search/*.adapter.ts     duckduckgo / bing / google           │
│   - crawler.service.ts      Playwright + Cheerio + robots.txt    │
│   - classifier.service.ts   email type classification            │
│   - verifier/reoon.adapter  REST verification                    │
│   - verifier/zerobounce.adapter   (fallback)                     │
│   - promotion.service.ts    gate logic ExtractedEmail → invite   │
└────────────────────────┬─────────────────────────────────────────┘
                         │  Prisma
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                       POSTGRES                                   │
│  WebinarLeadList → SearchQuery → DiscoveredUrl                   │
│                  → ExtractedEmail → EmailVerification            │
│                  → WebinarInviteContact (gated)                  │
│  WebinarSuppression       (per-partner blocklist)                │
│  WebinarAuditLog          (append-only audit)                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Pipeline

```
DRAFT
  ↓ partner clicks "Start discovery"
DISCOVERING
  ↓ worker hits each selected search provider with generated queries,
  │ writes DiscoveredUrl rows
EXTRACTING
  ↓ worker crawls each URL (respecting robots.txt + rate limits),
  │ extracts emails (HTML + obfuscation decode), writes ExtractedEmail
  │ rows with raw context snippet
VERIFYING
  ↓ worker classifies + verifies each ExtractedEmail
  │   - syntax + DNS + MX
  │   - disposable-domain check
  │   - external provider (Reoon) if quota left
  │   - suppression list check
  ↓ promotion gate
  │   PASS → insert WebinarInviteContact
  │   FAIL (free-mail / risky / unknown / disposable) → QUARANTINED
READY
  ↓ partner reviews quarantine, approves with consent notes
  ↓ partner exports CSV
```

---

## Compliance guardrails

| Rule                                                                                  | Enforced where                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| No personal-email harvesting                                                          | Classifier marks `@gmail/@yahoo/@hotmail/@icloud/@outlook` as PERSONAL_FREE_MAIL → quarantine |
| No CAPTCHA / paywall / auth bypass                                                    | Crawler never submits forms, never logs in, never accepts cookies banners   |
| No robots.txt bypass                                                                  | `robots-parser` checked per domain before crawl; result snapshotted on row  |
| Auto-promotion gates                                                                  | `promotion.service.ts` — see "Promotion rules"                              |
| Suppressed role emails                                                                | Classifier rejects `no-reply@`, `donotreply@`, `abuse@`, `postmaster@`, `privacy@`, `legal@`, `security@` |
| GDPR Art. 14 source disclosure                                                        | `sourceUrl` stored on every ExtractedEmail + WebinarInviteContact           |
| CAN-SPAM unsubscribe                                                                  | Unsubscribe handler writes WebinarSuppression row with `reason='unsubscribed'` |
| Per-partner verification quota                                                        | Reoon = 50 verifications/day baked into platform (no overage)               |
| Disposable domain blocklist                                                           | `disposable-email-domains` npm package (~120k domains, weekly-updated)      |

### Promotion rules — ALL must be true

A row moves from `WebinarExtractedEmail` to `WebinarInviteContact` only when:

1. `emailType` is `BUSINESS_DOMAIN` OR allowed `ROLE_BASED_BUSINESS`
2. `EmailVerification.providerStatus` = `deliverable`
3. `EmailVerification.disposable` = false
4. No matching row in `WebinarSuppression` (by partnerId + normalizedEmail)
5. `sourceUrl` is non-null
6. `consentStatus` is one of: `OPTED_IN` | `EXISTING_CUSTOMER` | `MANUAL_LAWFUL_BASIS_REVIEWED`
7. If `consentStatus = MANUAL_LAWFUL_BASIS_REVIEWED`, `lawfulBasisNotes` is required
8. No duplicate row in `WebinarInviteContact` for (partnerId, normalizedEmail)

---

## Configuration

### System Settings (production)

Production API keys live in `Admin → System Settings`, encrypted at rest,
write-only in UI. Same pattern as Stripe / Twilio / Google.

| Key                            | Where to set                | Purpose                                       |
| ------------------------------ | --------------------------- | --------------------------------------------- |
| `reoon_verifier_api_key`       | System Settings → Verifiers | Reoon Email Verifier (primary)                |
| `zerobounce_api_key`           | System Settings → Verifiers | ZeroBounce (secondary)                        |
| `bing_search_api_key`          | System Settings → Search    | Bing Web Search API                           |
| `google_cse_api_key`           | System Settings → Search    | Google Programmable Search Engine             |
| `google_cse_id`                | System Settings → Search    | Google PSE search engine ID                   |
| `serpapi_api_key`              | System Settings → Search    | SerpAPI fallback                              |

### Local dev (CLI)

For local CLI use only. Production reads from System Settings.

```env
# .env (local dev — never commit secrets)
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
REOON_API_KEY=
ZEROBOUNCE_API_KEY=
BING_SEARCH_API_KEY=
GOOGLE_CSE_API_KEY=
GOOGLE_CSE_ID=
SERPAPI_KEY=
EMAIL_VERIFICATION_PROVIDER=reoon
CRAWL_MAX_CONCURRENCY=3
CRAWL_DELAY_MS=1500
```

---

## Search providers

| Provider          | Default? | ToS risk    | Use case                                |
| ----------------- | -------- | ----------- | --------------------------------------- |
| DuckDuckGo scrape | ✓        | Low         | Default discovery engine                |
| Bing Web Search   | ✓        | API — none  | Paid API, ~ $4-7/1000 queries           |
| Google scrape     | Off      | **High**    | Advanced toggle only — Google ToS-restricted, captcha risk |
| Google PSE        |          | None        | API path for Google data, limited tier  |
| SerpAPI           |          | None        | Paid proxy — $75/mo flat, simplest      |

Browser-driven scraping uses Playwright with stealth headers + randomized
1.5-15s delays. Per-domain + global concurrency caps enforced.

---

## Email verifier

**Primary: Reoon Email Verifier**

- Platform plan: $10/mo flat
- Quota: 50 verifications/day per partner (50 partners × 50/day = 2,500/day platform total)
- Stages: syntax → DNS → MX → SMTP probe
- Result: `deliverable` | `undeliverable` | `risky` | `unknown`

**Secondary: ZeroBounce** (provider-agnostic adapter — swap by env)

---

## API surface

### Phase 1 (shipped)

| Method  | Path                                         | Purpose                |
| ------- | -------------------------------------------- | ---------------------- |
| GET     | `/api/partner/webinar-marketing/lists`       | List partner's lists   |
| POST    | `/api/partner/webinar-marketing/lists`       | Create new list        |
| GET     | `/api/partner/webinar-marketing/lists/:id`   | List detail            |
| PATCH   | `/api/partner/webinar-marketing/lists/:id`   | Update list config     |
| DELETE  | `/api/partner/webinar-marketing/lists/:id`   | Archive (soft delete)  |

### Phase 2-4 (planned)

| Method  | Path                                                 | Purpose                |
| ------- | ---------------------------------------------------- | ---------------------- |
| POST    | `/api/partner/webinar-marketing/lists/:id/discover`  | Kick off discovery     |
| POST    | `/api/partner/webinar-marketing/lists/:id/pause`     | Pause worker           |
| POST    | `/api/partner/webinar-marketing/lists/:id/resume`    | Resume worker          |
| GET     | `/api/partner/webinar-marketing/lists/:id/queue`     | Manual-review queue    |
| POST    | `/api/partner/webinar-marketing/queue/:emailId/approve` | Approve quarantined |
| POST    | `/api/partner/webinar-marketing/queue/:emailId/reject` | Reject quarantined  |
| GET     | `/api/partner/webinar-marketing/lists/:id/export`    | CSV download           |
| GET     | `/api/partner/webinar-marketing/suppressions`        | Suppression list mgmt  |
| POST    | `/api/partner/webinar-marketing/suppressions`        | Add suppression        |
| DELETE  | `/api/partner/webinar-marketing/suppressions/:id`    | Remove suppression     |

---

## Why free-mail harvesting is blocked by default

- Free-mail addresses (gmail/yahoo/hotmail/icloud/outlook) are personal, not
  business. Mass-emailing them is the textbook spam pattern. ESP reputation
  tanks fast.
- Even when the source page lists a gmail as the business contact, the
  individual using that gmail has not opted in to receive marketing from us
  finding their email on a website.
- GDPR Art. 6 + CASL require lawful basis. Web-scraping a personal email
  doesn't satisfy that on its own. Manual operator review with explicit
  notes does.
- Quarantine + manual approval forces an audit trail. If a complaint comes
  in, we can show `consentStatus` + `lawfulBasisNotes` + `reviewerName` +
  `reviewTimestamp` for every promoted free-mail address.

---

## Build phases

- [x] **Phase 1** — Foundation: Prisma models, nav, page stub, route stubs, worker scaffold, README
- [ ] **Phase 2** — Search adapters (DuckDuckGo, Bing, Google PSE, SerpAPI) + crawler (Playwright + Cheerio + robots.txt + obfuscation decoder)
- [ ] **Phase 3** — Classifier + Reoon verifier + promotion gate
- [ ] **Phase 4** — Partner UI: list builder, discovery progress, review queue, suppression mgmt, CSV export
- [ ] **Phase 5** — CLI commands + unit tests

---

## Migration

After pulling, run:

```bash
pnpm prisma generate
pnpm prisma db push   # dev — or `prisma migrate dev --name webinar_marketing_phase1` in prod
```

The 8 new tables + 7 new enums are additive — no existing rows affected.
