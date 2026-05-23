# Combined Plan

_Stitched from the six planning files in this wiki on 2026-05-22 04:03:59._


---

# Plan

_Source: `wiki/plan.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# Plan — MyOrbisLocal

## North Star
Ship an agency-grade local SEO automation SaaS where an agency owner can onboard a client, run a full GBP audit + content plan, generate a "Core 30" content batch through the eight-pass pipeline, and publish directly to WordPress — all from a single dashboard.

---

## Milestone 0 — Foundation (Weeks 1–2)
**Goal:** Running skeleton that can be deployed end-to-end. No AI features yet.

- [ ] Monorepo scaffold: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- [ ] Docker Compose: PostgreSQL 16 + Redis 7 + placeholder worker container
- [ ] Prisma schema: Workspace, User, Role, Client, GBPProfile, ContentJob (initial tables only)
- [ ] Clerk auth integration: sign-up / sign-in, org creation, Next.js middleware route protection
- [ ] Role model: Super Admin → Agency Owner → Agency Staff → Client (Clerk org roles + Prisma permission layer)
- [ ] Basic nav shell: sidebar with placeholder pages for Dashboard, Clients, Content, Reports
- [ ] `/api/webhooks/clerk` — sync Clerk user/org events to Prisma
- [ ] CI/CD: GitHub Actions → Vercel (app) + Railway (worker) deploy on merge to `main`
- [ ] CLAUDE.md written and committed to repo root
- [ ] `.env.example` with all required variables documented

**Ships:** Login → dashboard → placeholder pages. Fully deployable.

---

## Milestone 1 — GBP Integration & Category Audit (Weeks 3–5)
**Goal:** Agency can connect a client GBP, view profile data, and run a category audit.

- [ ] Google OAuth 2.0 flow: connect GBP account, store access/refresh tokens AES-256 encrypted in `GBPToken` table
- [ ] GBP API read via `googleapis`: fetch business name, categories, services, address, phone, hours
- [ ] Manual GBP entry form (fallback for non-connected / prospect clients)
- [ ] Prospect mode vs. Connected mode toggle on each client record
- [ ] GBP category competitor audit: BullMQ job → DataForSEO Local Pack API call for `[service] [city]` → extract category frequency table → write `CategoryAuditResult` to DB
- [ ] Category audit UI: current categories vs. recommended; gap flags; frequency table display
- [ ] Client management CRUD: add / edit / archive clients; associate GBP profile per client
- [ ] Encrypt/decrypt utility in `lib/crypto` (AES-256); used for GBP tokens and AI provider keys

**Ships:** End-to-end GBP connect → category audit report. No Playwright scraping.

---

## Milestone 2 — Website Crawl & Content Gap Analysis (Weeks 6–8)
**Goal:** Tool can crawl a business website and generate a "Core 30" page plan.

- [ ] Website crawler: Crawlee + Playwright BullMQ job (runs in Docker worker) → extract all URLs, titles, H1s, meta descriptions
- [ ] AI page classifier: single-pass Vercel AI SDK call → map each crawled page to a GBP service/category → write `WebsiteCrawl` to DB
- [ ] Gap analysis engine: diff GBP services/categories vs. classified pages → identify missing pages → write `GapAnalysis` to DB
- [ ] Core 30 planner UI: display gap table; allow agency to select/deselect pages for the generation queue
- [ ] Supporting planner: PAA + competitor headline scraper (Crawlee BullMQ job) → topic suggestions per service; AI relevance scoring (0–10)
- [ ] Geo planner: Google Places API call for landmarks near business address + Lead Snap CSV upload/parse; AI 0–10 relevance scoring per landmark
- [ ] Bulk content queue: add selected Core 30 + topical + geo pages to `ContentJob` queue

**Ships:** Full content plan from GBP + website data, ready to send to generation pipeline.

---

## Milestone 3 — Eight-Pass Content Generation Pipeline (Weeks 9–13)
**Goal:** Generate a full batch of pages through the eight-pass AI writing pipeline.

- [ ] BullMQ job chain: one parent job per page → 8 sequential child jobs (one per pass) → pass output stored in DB; each pass reads prior pass output from DB
- [ ] Pass 1 — Research Synthesis: aggregate PAA, competitor angles, local landmarks → structured content brief
- [ ] Pass 2 — Strategic Outline: H2 architecture, section angles, full page flow
- [ ] Pass 3 — Section Draft: independent `streamText` call per H2 section (natural tonal variation)
- [ ] Pass 4 — Burstiness: sentence-length variation; break robotic rhythm
- [ ] Pass 5 — Perplexity Injection: replace predictable AI phrases; remove em-dashes
- [ ] Pass 6 — Human Bookends: rewrite first 2 + last 2 sentences with conversational language
- [ ] Pass 7 — Conversion: inject CTAs, phone numbers, micro-conversions per content type
- [ ] Pass 8 — Final QC: coherence + word count + AI pattern check; set `status = "review"` on pass; flag if score > threshold
- [ ] BYOK: per-workspace AI provider key lookup in `lib/ai/client.ts`; fallback to platform key
- [ ] Parallel asset jobs (concurrent with pass chain): FAQ generation, meta title/description/H1, JSON-LD schema, image prompt → Replicate → R2 upload
- [ ] AI detection score: Originality.ai REST API call on Pass 8 output; stored in `GeneratedPage.aiDetectionScore`
- [ ] Content review editor (Tiptap): per-pass output view; accept / request regeneration; AI detection score display
- [ ] Batch progress dashboard: SSE stream from `job.updateProgress()` → real-time pass status in UI

**Ships:** Full eight-pass pipeline generating reviewable, near-publishable content.

---

## Milestone 4 — WordPress Publishing & Video (Weeks 14–16)
**Goal:** One-click publish to WordPress; video generation and YouTube upload.

- [ ] WordPress REST API integration (`lib/wordpress`): per-client Application Password credentials; upload featured image to WP Media Library; `POST /wp-json/wp/v2/posts`
- [ ] Video script generation: AI pass on final article → video script stored in DB
- [ ] Video generation: Runway ML API (`lib/runway`) → R2 upload; evaluate Hyperframes as cheaper alternative
- [ ] YouTube upload: `googleapis` Data API v3 service account → upload with AI-generated title/tags/description → get videoId
- [ ] Compose final WP post body: content + embedded YouTube `<iframe>` + JSON-LD schema in `<script type="application/ld+json">`
- [ ] WordPress publish UI: post preview; category/tag selection; publish or schedule
- [ ] Publish status tracking: `PublishRecord` table with status `draft | scheduled | published | error`

**Ships:** Full pipeline GBP data → generated content → live WordPress post with embedded video.

---

## Milestone 5 — Performance Tracking & Reporting (Weeks 17–19)
**Goal:** Rankings, visibility, reviews, citations tracked and surfaced in reports.

- [ ] DataForSEO SERP rank tracking: keyword + URL → position polling via weekly BullMQ cron job; write to `RankTracking`
- [ ] BrightLocal citations: NAP consistency audit via `lib/brightlocal`; display inconsistencies in client dashboard
- [ ] GBP review monitoring: GBP API review feed → display in client dashboard
- [ ] Ranking dashboard: position-over-time charts (Recharts); geo-grid visualisation
- [ ] Automated report generation: Markdown → PDF (MARP-based skill); agency-branded; stored in R2; email delivery
- [ ] Client portal: read-only dashboard view for `CLIENT` role users scoped to their own data

**Ships:** Closed-loop SaaS — generate content, publish, track results, report.

---

## Milestone 6 — Billing, Polish & GA (Weeks 20–22)
**Goal:** Production-ready with billing, onboarding, and hardened security.

- [ ] Stripe billing: workspace subscription plans (Free Trial / Starter / Agency); usage metering for AI token consumption; `/api/webhooks/stripe` handler
- [ ] Plan enforcement: BullMQ middleware checks workspace plan tier before enqueuing jobs; returns `402` if over limit
- [ ] Onboarding wizard: guided setup for new Agency Owner (connect GBP → add first client → run first audit → generate first page)
- [ ] Audit log: all destructive actions (delete client, publish content, change plan) recorded in `AuditLog` table per workspace
- [ ] Rate limiting: per-workspace AI job concurrency limits enforced in BullMQ; `Bottleneck` or BullMQ flow limits
- [ ] Sentry: error monitoring on frontend (`@sentry/nextjs`) and worker (`@sentry/node`)
- [ ] Performance: Lighthouse ≥ 95 on all key pages; Core Web Vitals green
- [ ] Security review: OWASP top-10 checklist; encrypted API key storage audit; Prisma middleware `workspaceId` filter audit
- [ ] Docs: agency user guide; API reference for white-label embedding

**Ships:** Public launch candidate.

---

## MVP Scope (End of Milestone 4)
The MVP ships everything through WordPress publishing:
- GBP connect + category audit (DataForSEO; no scraping)
- Website crawl + Core 30 gap analysis
- Eight-pass content generation with BYOK
- Parallel FAQ / meta / schema / image asset generation
- WordPress publish with video embed
- Multi-tenant auth (Agency Owner + Staff + Client)

Rank tracking, full reporting, and billing are post-MVP.

---

## Sequencing Rationale
1. Foundation first — auth and multi-tenancy are load-bearing; everything else depends on `workspaceId` scoping
2. GBP before crawl — crawl enriches GBP data; the content plan is meaningless without GBP categories
3. Gap analysis before generation — the generation queue is populated by the gap analysis output
4. Eight-pass before publishing — publishing without a reviewed article is a non-starter for agencies
5. Tracking after publishing — you need published pages before you can track positions
6. Billing last — avoids constraining early user testing; add enforcement once the product is validated

---

# Tech stack

_Source: `wiki/stack.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# Stack — MyOrbisLocal

## Frontend
- **Framework:** Next.js 14 (App Router, static + server components as appropriate per route)
- **Language:** TypeScript 5.x
- **Styling:** Tailwind CSS 3.x + shadcn/ui component library
- **State management:** Zustand 4.x (client state); TanStack Query 5.x (server state / data fetching)
- **Forms:** React Hook Form 7.x + Zod validation
- **Charts / reporting:** Recharts 2.x
- **Rich text editor (content preview):** Tiptap 2.x
- **Tables:** TanStack Table 8.x

## Backend
- **Runtime:** Node.js 20 LTS
- **API layer:** Next.js API routes (Route Handlers) for simple CRUD; **Express 4.x** worker process for long-running BullMQ job consumers that cannot run in Vercel serverless
- **Job queue:** BullMQ 5.x (backed by Redis; handles all async pipelines — content generation, crawling, publishing, image/video generation)
- **Web crawler:** Crawlee 3.x (Playwright-based; used for website crawling; run inside Docker worker only)
- **WordPress publishing:** WP REST API via thin `lib/wordpress` HTTP wrapper (no plugin dependency on client sites)
- **Schema generation:** custom JSON-LD builder in `lib/schema` (no external dependency needed)
- **Logging:** pino 9.x
- **Error monitoring:** Sentry (`@sentry/nextjs` + `@sentry/node`)

## Database
- **Primary DB:** PostgreSQL 16 (managed via Supabase; pgBouncer connection pooling)
- **ORM:** Prisma 5.x
- **Cache / queue broker:** Redis 7.x (Upstash serverless Redis in production; local Redis via Docker Compose in dev)
- **Full-text search:** PostgreSQL `tsvector` / `pg_trgm` (no separate search engine until scale demands it)

## Auth
- **Auth platform:** Clerk (`@clerk/nextjs` 5.x) — multi-tenant orgs, JWT sessions, role-based access
- **Session strategy:** Clerk JWT + Next.js middleware for route protection
- **Role enforcement:** custom Prisma-backed permission layer (Clerk org roles → internal `Role` enum: `SUPER_ADMIN | AGENCY_OWNER | AGENCY_STAFF | CLIENT`)

## AI / LLM Integration
- **Provider abstraction:** Vercel AI SDK 3.x (`ai` package) — provider-agnostic; supports streaming via `streamText`
- **Supported BYOK providers:** Anthropic `claude-3-5-sonnet-20241022`, OpenAI `gpt-4o`, Google `gemini-1.5-pro`
- **API key storage:** AES-256 encrypted per-workspace in `AIProviderKey` table; decrypted in worker memory only at job runtime
- **Eight-pass pipeline:** BullMQ job chain; each pass is an independent `streamText` call reading prior pass output from DB
- **Image generation:** Replicate API (Flux or SDXL) — thin HTTP wrapper in `lib/replicate`; no MCP
- **Video generation:** Runway ML API — thin HTTP wrapper in `lib/runway`; no MCP
- **AI detection scoring:** Originality.ai REST API — thin HTTP wrapper in `lib/detection`; no MCP

## External Integrations
- **GBP data:** Google Business Profile API (OAuth 2.0) via `googleapis` SDK 140.x
- **GBP competitor category data:** DataForSEO Local Pack API — thin REST wrapper in `lib/dataforseo`; replaces Playwright scraping of Google Maps (ToS-safe)
- **Rank tracking:** DataForSEO SERP API — thin REST wrapper; cron job via BullMQ
- **Google Places (geo planner):** Google Places API (New) — direct HTTP in `lib/places`; no MCP
- **Lead Snap rank maps:** CSV upload + parse utility in `lib/leadsnap`
- **Citations / review monitoring:** BrightLocal API — thin REST wrapper in `lib/brightlocal`
- **YouTube upload:** Google Data API v3 via `googleapis` SDK (service account)
- **Stripe billing:** `stripe` Node.js SDK 14.x; webhook handler at `/api/webhooks/stripe`

## Storage
- **Object storage:** Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`; used for generated images, videos, PDFs, crawl artifacts)
- **CDN:** Cloudflare (automatic with R2 public bucket or pre-signed URLs)

## Hosting & Infrastructure
- **App hosting:** Vercel (Next.js frontend + lightweight API routes)
- **Worker hosting:** Railway (Docker; runs Express worker + BullMQ consumers + Playwright — cannot run on Vercel serverless)
- **Database:** Supabase PostgreSQL 16 (managed; pgBouncer)
- **Redis:** Upstash (serverless; BullMQ-compatible)
- **Dev environment:** Docker Compose (PostgreSQL 16 + Redis 7 + worker container)
- **CI/CD:** GitHub Actions → Vercel (app, auto-deploy on `main`) + Railway (worker, deploy on `main`)

## No MCP Policy
All external service calls are thin HTTP wrappers or SDK calls inside `lib/` subdirectories. No MCP servers are used or spawned. This is a hard project rule.

## Key Libraries Summary

| Layer | Package | Version |
|---|---|---|
| Next.js | `next` | 14.x |
| TypeScript | `typescript` | 5.x |
| Tailwind | `tailwindcss` | 3.x |
| shadcn/ui | `shadcn-ui` | latest |
| Zustand | `zustand` | 4.x |
| TanStack Query | `@tanstack/react-query` | 5.x |
| Tiptap | `@tiptap/react` | 2.x |
| Recharts | `recharts` | 2.x |
| React Hook Form | `react-hook-form` | 7.x |
| Zod | `zod` | 3.x |
| Prisma | `prisma` | 5.x |
| BullMQ | `bullmq` | 5.x |
| Vercel AI SDK | `ai` | 3.x |
| Clerk | `@clerk/nextjs` | 5.x |
| Crawlee | `crawlee` | 3.x |
| googleapis | `googleapis` | 140.x |
| Stripe | `stripe` | 14.x |
| Pino | `pino` | 9.x |
| Sentry | `@sentry/nextjs` | latest |

---

# Repositories

_Source: `wiki/repos.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# Repos — MyOrbisLocal

Curated repos to clone or reference at project start. Only repos that directly reduce build time for a confirmed feature are listed.

## Coding Discipline
- https://github.com/multica-ai/andrej-karpathy-skills — Karpathy coding behaviour SKILL.md; load into Claude Code at project start to keep agentic edits surgical and minimal during rapid feature development

## AI / Content Pipeline Reference
- https://github.com/addyosmani/agentic-seo — Agentic SEO / AEO tooling patterns; reference for orchestrating SEO-specific AI tasks aligned with the eight-pass pipeline architecture

## Job Queue / Workflow Patterns
- https://github.com/n8n-io/n8n — study BullMQ-style job-chain patterns and webhook-triggered pipeline designs before implementing the eight-pass content generation chain
- https://github.com/Zie619/n8n-workflows — community workflow collection; reference for multi-step content pipelines that map directly to BullMQ job graph designs

## Video & Media
- https://github.com/heygen-com/hyperframes — HTML-to-video rendering designed for agents; evaluate as a lightweight, deterministic video generation alternative to Runway ML for schema/FAQ card videos (cheaper, no per-second pricing)
- https://github.com/openvideodev/openvideo — open-source React video editor; reference for the video preview UI component in the content review editor before integrating Runway

## PDF Report Generation
- https://github.com/robonuggets/marp-slides — MARP presentation skill for Claude Code; use as the foundation for generating agency-branded PDF reports from Markdown content in Milestone 5

## Admin / Skill UI
- https://github.com/amaancoderx/npxskillui — skill UI framework; evaluate for the prompt management and Claude Code skill runner panel inside the Super Admin workspace

---

# Architecture

_Source: `wiki/architecture.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# Architecture — MyOrbisLocal

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Agency / Client)             │
│              Next.js 14 App (Vercel)                     │
│  Pages: Dashboard · Clients · Content · Reports · Admin  │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS
          ┌─────────▼──────────┐
          │  Next.js API Routes │  (Vercel serverless)
          │  /api/*             │  Auth: Clerk JWT middleware
          └──┬──────────┬──────┘
             │          │
    Prisma ORM│          │BullMQ enqueue
             │          │
    ┌────────▼───┐  ┌───▼──────────────────────────────────┐
    │ PostgreSQL  │  │  Redis (Upstash)                      │
    │ (Supabase) │  │  Job queues: crawl · generate · publish│
    └────────────┘  └───────────┬──────────────────────────┘
                                │ BullMQ dequeue
                    ┌───────────▼──────────────────────────┐
                    │  Worker Service (Railway)             │
                    │  Express 4 + BullMQ consumers         │
                    │  ┌─────────────────────────────────┐  │
                    │  │ Crawlee / Playwright (website   │  │
                    │  │ crawl only — NOT GBP scraping)  │  │
                    │  ├─────────────────────────────────┤  │
                    │  │ Eight-Pass AI Pipeline          │  │
                    │  │ (Vercel AI SDK → BYOK provider) │  │
                    │  ├─────────────────────────────────┤  │
                    │  │ Asset Jobs (parallel):          │  │
                    │  │  • Replicate (images)           │  │
                    │  │  • Runway ML / Hyperframes      │  │
                    │  │  • Google Data API (YT upload)  │  │
                    │  │  • WP REST API (publish)        │  │
                    │  │  • DataForSEO (rank tracking,   │  │
                    │  │    competitor category audit)   │  │
                    │  │  • Originality.ai (AI detect)  │  │
                    │  └─────────────────────────────────┘  │
                    └──────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────────────┐
                    │  Cloudflare R2 (Object Storage)        │
                    │  images · videos · PDFs · crawl data   │
                    └───────────────────────────────────────┘
```

---

## Components

### 1. Next.js App (Vercel)
All user-facing UI and lightweight API routes. Serverless — no persistent processes.

**Key route groups:**
- `(auth)` — Clerk sign-in/sign-up
- `(app)/dashboard` — agency overview
- `(app)/clients/[clientId]` — per-client GBP profile, audit, content queue
- `(app)/content/[jobId]` — content review editor (Tiptap)
- `(app)/reports` — ranking charts, citation audit, client portal
- `(app)/admin` — Super Admin workspace management
- `api/gbp/*` — GBP OAuth callback, profile read
- `api/crawl` — enqueue crawl job, poll status
- `api/content` — enqueue generation jobs, SSE status stream
- `api/publish` — trigger WordPress publish job
- `api/webhooks/clerk` — Clerk user/org sync to Prisma
- `api/webhooks/stripe` — Stripe billing events

### 2. Worker Service (Railway)
Long-running Docker container. Cannot run on Vercel (Playwright + long AI calls).

**Hosts:**
- **Express app** on port 3001 (health check endpoint; internal-only)
- **BullMQ workers:** `crawl-worker`, `generate-worker`, `asset-worker`, `publish-worker`, `rank-worker`
- **Playwright browser** (Crawlee): headless Chromium — used for website crawls only

**Does NOT call Next.js API routes.** Writes results directly to PostgreSQL; Next.js reads them.

### 3. PostgreSQL (Supabase)
Source of truth for all persistent data.

**Key tables:**
```
Workspace          id, name, planTier, stripeCustomerId, stripeSubscriptionId
User               id, clerkId, workspaceId, role (SUPER_ADMIN|AGENCY_OWNER|AGENCY_STAFF|CLIENT)
Client             id, workspaceId, name, mode (prospect|connected), websiteUrl
GBPProfile         id, clientId, gbpAccountId, categories[], services[], lastSyncedAt
GBPToken           id, clientId, encryptedAccessToken, encryptedRefreshToken, expiresAt
CategoryAuditResult id, clientId, keyword, city, frequencyTable (jsonb), createdAt
WebsiteCrawl       id, clientId, status, crawledAt, pagesJson (jsonb)
GapAnalysis        id, clientId, missingPages (jsonb), createdAt
ContentJob         id, clientId, pageType, keyword, city, landmark, status, passResults (jsonb)
GeneratedPage      id, contentJobId, finalContent, aiDetectionScore, assetStatus (jsonb)
PublishRecord      id, generatedPageId, wpSiteUrl, wpPostId, publishedAt, status
AIProviderKey      id, workspaceId, provider, encryptedKey
RankTracking       id, clientId, keyword, url, position, trackedAt
Report             id, clientId, generatedAt, r2Url
AuditLog           id, workspaceId, userId, action, entityType, entityId, createdAt
```

### 4. Redis (Upstash)
- BullMQ job queues: `crawl`, `generate`, `generate-pass-{1..8}`, `assets`, `publish`, `rank-track`
- Job results written to PostgreSQL on completion — never stored long-term in Redis
- TTL on completed/failed jobs: 24h

### 5. Cloudflare R2
- Generated images (Replicate output)
- Generated videos (Runway / Hyperframes output)
- Crawl artifacts (JSON dumps)
- Agency PDF reports
- All accessed via pre-signed URLs; bucket is never publicly listed

---

## Data Flows

### GBP Category Audit (DataForSEO — no scraping)
```
User clicks "Run Category Audit"
  → POST /api/crawl { clientId, keyword, city }
  → API enqueues BullMQ job "gbp:competitor-audit"
  → Worker: lib/dataforseo → Local Pack API call for [keyword] [city]
  → Extracts category frequency table from SERP results
  → Writes CategoryAuditResult to PostgreSQL
  → UI polls /api/crawl/[jobId]/status → renders frequency table when complete
```

### Website Crawl + Gap Analysis
```
User clicks "Crawl Website"
  → POST /api/crawl { clientId, websiteUrl }
  → Worker: Crawlee/Playwright crawls all pages → extracts URL, title, H1, meta
  → AI SDK single-pass: classify each page to GBP service/category
  → Gap engine: diff GBP services vs. classified pages → write GapAnalysis to DB
  → UI renders Core 30 checklist with pre-selected missing pages
```

### Eight-Pass Content Generation
```
User clicks "Generate" on Core 30 queue
  → POST /api/content/batch { pageIds[] }
  → API enqueues one ContentJob per page
  → Worker (generate-worker):
      For each ContentJob:
        Pass 1: streamText → research brief → write passResult[1] to DB
        Pass 2: streamText (context = passResult[1]) → outline → write passResult[2]
        ...
        Pass 8: streamText → QC → write passResult[8]; set status = "review"
        After Pass 8: Originality.ai API → aiDetectionScore → update GeneratedPage
      Parallel (concurrent with pass chain):
        Asset job → FAQ, meta, schema, image (Replicate → R2)
  → UI: SSE stream from job.updateProgress() shows pass progress in real time
  → On completion: Content Review editor (Tiptap) opens
```

### WordPress Publish
```
User clicks "Publish to WordPress"
  → POST /api/publish { generatedPageId, wpSiteUrl, wpUsername, wpAppPassword, postStatus }
  → Worker (publish-worker):
      1. Download image from R2
      2. Upload image to WP Media Library via REST → get attachmentId
      3. Generate video (Runway/Hyperframes) → upload to YouTube (googleapis) → get videoId
      4. Compose post body: content + YouTube iframe + JSON-LD <script>
      5. POST to /wp-json/wp/v2/posts with featured_media: attachmentId
      6. Write PublishRecord to DB with wpPostId and status
  → UI: status updates to "Published" with WP link
```

---

## Multi-Tenancy & Roles

```
Workspace (Agency)
  ├── SUPER_ADMIN    (platform-level; cross-workspace access; MyOrbisLocal staff only)
  ├── AGENCY_OWNER   (full workspace access; billing; add staff/clients; BYOK keys)
  ├── AGENCY_STAFF   (manage clients; run jobs; view content; no billing)
  └── CLIENT         (read-only: their own reports + rankings)
```

- Clerk org membership maps to internal `Role` enum
- Every DB query is scoped by `workspaceId` extracted from the Clerk JWT
- `lib/db` Prisma client middleware enforces `workspaceId` filter on every query — never bypassed
- Row-level security enforced at the application (Prisma) layer, not Postgres RLS

---

## BYOK (Bring Your Own Key)

- Agency Owner enters API keys per provider in workspace Settings
- Keys are AES-256 encrypted (`lib/crypto`) before storing in `AIProviderKey`
- Worker decrypts at job-start time; key lives in process memory only for the job's duration
- Fallback: platform-level key (metered via Stripe) if no workspace key is set

---

## No MCP Policy

All external service calls use thin HTTP wrappers or SDKs in `lib/` subdirectories:

| Service | Integration |
|---|---|
| GBP | `googleapis` SDK |
| DataForSEO | `lib/dataforseo` (REST) |
| Google Places | `lib/places` (REST) |
| BrightLocal | `lib/brightlocal` (REST) |
| Replicate | `lib/replicate` (REST) |
| Runway ML | `lib/runway` (REST) |
| Originality.ai | `lib/detection` (REST) |
| YouTube | `googleapis` SDK |
| WordPress | `lib/wordpress` (REST) |
| Stripe | `stripe` SDK |

No MCP servers are spawned at any point.

---

## Key Request / Response Shapes

### POST /api/content/batch
```json
{
  "clientId": "clt_xxx",
  "pages": [
    { "pageType": "service", "keyword": "emergency plumber", "city": "Boston", "state": "MA" },
    { "pageType": "geo", "keyword": "drain cleaning", "landmark": "Fenway Park", "city": "Boston" }
  ],
  "aiProvider": "anthropic",
  "modelOverride": null
}
```

### GET /api/content/[jobId]/status (SSE)
```json
{
  "jobId": "job_xxx",
  "status": "generating",
  "currentPass": 5,
  "totalPasses": 8,
  "passResults": [
    { "pass": 1, "completedAt": "2026-05-21T10:00:00Z", "wordCount": 420 }
  ],
  "assetStatus": {
    "faq": "done",
    "meta": "done",
    "schema": "pending",
    "image": "generating",
    "video": "queued"
  },
  "aiDetectionScore": null
}
```

### POST /api/publish
```json
{
  "generatedPageId": "gp_xxx",
  "wpSiteUrl": "https://clientsite.com",
  "wpUsername": "admin",
  "wpAppPassword": "xxxx xxxx xxxx xxxx",
  "postStatus": "publish"
}
```

---

# Project CLAUDE.md (draft)

_Source: `wiki/claude-md.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# CLAUDE.md — MyOrbisLocal

> Copy this file verbatim to the root of the project repo as `CLAUDE.md`.

---

## Project
**MyOrbisLocal** — Local SEO automation SaaS for agencies and local businesses. Automates Google Business Profile (GBP) auditing, content planning, AI content generation (eight-pass pipeline), and WordPress publishing.

## Stack (versions pinned in package.json)
- **Frontend:** Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3, shadcn/ui
- **Backend:** Next.js API Routes (Vercel) + Express 4 worker (Railway Docker)
- **Database:** PostgreSQL 16 via Prisma 5 (Supabase hosted; pgBouncer)
- **Cache / Queue:** Redis 7 via BullMQ 5 (Upstash in prod)
- **Auth:** Clerk 5 (multi-tenant orgs, JWT, role-based access)
- **AI:** Vercel AI SDK 3 — Anthropic claude-3-5-sonnet-20241022 / OpenAI gpt-4o / Gemini 1.5 Pro (BYOK)
- **Crawler:** Crawlee 3 + Playwright (Docker worker only)
- **Storage:** Cloudflare R2 (via @aws-sdk/client-s3)
- **Image gen:** Replicate API (lib/replicate)
- **Video gen:** Runway ML API (lib/runway)
- **YouTube:** Google Data API v3 (googleapis SDK)
- **Rank tracking:** DataForSEO REST API (lib/dataforseo)
- **Citations:** BrightLocal REST API (lib/brightlocal)
- **AI detection:** Originality.ai REST API (lib/detection)
- **Billing:** Stripe SDK 14
- **Logging:** pino 9
- **Errors:** Sentry

## How to Run (Development)

```bash
# Prerequisites: Docker Desktop, Node 20, pnpm
cp .env.example .env.local          # fill in secrets
docker compose up -d                 # starts PostgreSQL 16 + Redis 7
pnpm install
pnpm prisma migrate dev              # apply DB migrations
pnpm dev                             # Next.js on :3000

# In a second terminal:
pnpm worker:dev                      # Express + BullMQ worker on :3001
```

## Key File Locations

```
/app                     Next.js App Router pages and layouts
/app/api                 API route handlers
  /api/gbp               GBP OAuth callback, profile read
  /api/crawl             Enqueue crawl job, poll status
  /api/content           Enqueue generation jobs, SSE status
  /api/publish           Trigger WordPress publish job
  /api/webhooks/clerk    Clerk user/org sync
  /api/webhooks/stripe   Stripe billing events
/components              Shared React components (shadcn/ui wrappers)
/lib
  /ai                    Vercel AI SDK wrappers; eight-pass pipeline orchestration
  /bullmq                Queue definitions; job enqueue helpers
  /crawlee               Crawlee crawler configs
  /crypto                AES-256 encryption/decryption for keys
  /dataforseo            DataForSEO REST wrapper (rank tracking + category audit)
  /db                    Prisma client singleton with workspaceId middleware
  /detection             Originality.ai REST wrapper
  /gbp                   GBP API client (googleapis)
  /places                Google Places API HTTP wrapper
  /replicate             Replicate API HTTP wrapper
  /runway                Runway ML API HTTP wrapper
  /brightlocal           BrightLocal API HTTP wrapper
  /r2                    Cloudflare R2 upload/presign helpers
  /schema                JSON-LD schema builder
  /wordpress             WP REST API client
  /logger.ts             Pino logger (use this; never console.log in production)
/worker
  /index.ts              Express app + BullMQ consumer registration
  /processors            One file per job type (crawl, generate-passN, assets, publish, rank)
/prisma
  /schema.prisma         Database schema
  /migrations            All DB migrations
/public                  Static assets
CLAUDE.md                This file
.env.example             All required env vars (no secrets)
docker-compose.yml       Local dev: PostgreSQL + Redis
```

## Conventions

### General
- **TypeScript strict mode** is on. No `any` without a comment explaining why.
- All DB access goes through `lib/db` (the Prisma singleton). Never instantiate Prisma client elsewhere.
- **Every DB query MUST include a `workspaceId` filter.** The `lib/db` middleware enforces this but always write it explicitly too.
- Use `zod` for all input validation at every API route boundary.
- Use the `logger` from `lib/logger.ts` (pino) everywhere. Never use `console.log` in production code.

### API Routes
- Route handlers live in `/app/api/**`.
- Always call `auth()` from `@clerk/nextjs/server` at the top of every handler before any DB access.
- Return `NextResponse.json()` for all responses.
- Long-running work (>2s): enqueue a BullMQ job and return `{ jobId }` immediately. Never `await` it inline.

### BullMQ / Worker
- One processor file per job type in `/worker/processors/`.
- Processors write results to PostgreSQL on completion. Never rely on Redis job data for persistence.
- Use `job.updateProgress()` to emit progress events readable via SSE in the UI.
- Job names follow `[domain]:[action]` — e.g. `content:generate-pass-3`, `crawl:website`, `gbp:competitor-audit`.
- Playwright/Crawlee runs in the Docker worker only. Never import Crawlee into Next.js API routes.

### AI Pipeline
- All AI calls go through `lib/ai/client.ts` which resolves the workspace's BYOK key.
- Use `streamText` from Vercel AI SDK and stream output to a `passResult` DB record.
- Eight-pass pipeline: each pass reads prior pass output from DB. Never accumulate full article in memory across passes.
- **No MCP servers.** All external calls are HTTP wrappers or SDK calls in `lib/`.

### External Service Calls
- GBP competitor category data → DataForSEO Local Pack API (`lib/dataforseo`). Do NOT scrape Google Maps with Playwright.
- WordPress publishing → WP REST API with Application Password (`lib/wordpress`). Do NOT require WPGraphQL plugin.
- All other integrations → thin HTTP wrappers in `lib/` subdirectories.

### Naming
- Files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- DB table names: `PascalCase` (Prisma convention)
- Env vars: `SCREAMING_SNAKE_CASE`

## Environment Variables
See `.env.example` for the full list. Key groups:
```
DATABASE_URL                    Supabase PostgreSQL connection string
REDIS_URL                       Upstash Redis URL
CLERK_SECRET_KEY                Clerk backend secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL
NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENCRYPTION_SECRET               32-byte hex string — AES-256 key encryption
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
GOOGLE_CLIENT_ID                OAuth for GBP + YouTube
GOOGLE_CLIENT_SECRET
REPLICATE_API_TOKEN             Image generation
RUNWAY_API_KEY                  Video generation
ORIGINALITY_API_KEY             AI detection scoring
DATAFORSEO_LOGIN                Rank tracking + category audit
DATAFORSEO_PASSWORD
BRIGHTLOCAL_API_KEY             Citations audit
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SENTRY_DSN
```

## Hard Rules
- **Do not use MCP servers.** Use HTTP wrappers or SDKs.
- **Do not run Playwright inside Vercel serverless functions.** All crawl/scrape work runs in the Docker worker on Railway.
- **Do not store unencrypted API keys in the database.** Always go through `lib/crypto`.
- **Do not bypass the `workspaceId` filter** in any DB query.
- **Do not use `console.log` in production code.** Use `lib/logger.ts` (pino).
- **Do not scrape Google Maps with Playwright.** Use DataForSEO Local Pack API.
- **Do not require WPGraphQL plugin** on client WordPress sites. Use WP REST API only.

---

# Open questions

_Source: `wiki/questions.md` — edits made in this combined doc do not propagate back. Edit the source file, then re-export._

# Open Questions — MyOrbisLocal

Decisions the team needs to make before or during development. Ordered by how early they block work.

---

## 1. GBP API Access: Apply Now or Defer?
**Question:** The Google Business Profile API requires Google to approve third-party management tool access. This can take weeks. Should the team apply immediately (before writing a line of code) or defer and rely on manual GBP data entry + DataForSEO for the MVP?

**Why it matters:** GBP API access enables (a) OAuth-connected clients where the tool can read and write their live GBP data, and (b) the "Connected mode" vs. "Prospect mode" distinction central to the product. Without approval, all clients are effectively in prospect/manual mode.

**Trade-off:**
- Apply immediately: parallel path; API may be ready by Milestone 1 completion; enables full "Connected" mode.
- Defer: ship MVP faster with manual entry only; re-design GBP client interface later. Risk: re-work if API has different data shapes.

**Recommendation:** Apply on Day 1. Design the `lib/gbp` client with a swappable interface so the manual-entry fallback and the API path share the same data contract.

---

## 2. Eight-Pass Pipeline: Sequential or Selective Parallel?
**Question:** Run passes 1–8 strictly in sequence, or allow some passes (e.g. Pass 3 H2 section drafts) to run in parallel and merge?

**Why it matters:** Strict sequencing is simple to implement and QC but slow (~4–8 min per page at current LLM latencies). Parallel section drafting in Pass 3 could cut that to ~2–3 min but adds BullMQ flow-graph complexity and harder-to-debug merge logic.

**Trade-off:**
- Sequential: simpler, easier to QC output quality pass-by-pass, slower per page.
- Selective parallel: faster throughput, complex orchestration, harder to isolate quality regressions.

**Recommendation:** Ship sequential. Measure real pass times after first 100 pages. If median >8 min/page, add parallelism to Pass 3 section drafts only as a targeted optimisation.

---

## 3. AI Detection Score Provider
**Question:** Which AI detection API to use for the Pass 8 QC score — Originality.ai, GPTZero, Winston AI, or a local classifier?

**Why it matters:** Agencies use this score to decide whether to publish or request a human edit pass. Inaccurate scores erode trust in the pipeline. The score is baked into `GeneratedPage.aiDetectionScore` and surfaced in the content review UI.

**Options and current plan:**
- **Originality.ai** (default in stack.md): paid per-credit (~$0.01–0.05/page), reliable, widely used by SEO agencies
- **GPTZero API**: paid, similar accuracy
- **Winston AI**: paid
- **Local model**: free, lower accuracy, adds infrastructure complexity

**Decision needed:** Confirm Originality.ai as the default, or select an alternative before Milestone 3.

---

## 4. Video Generation: Runway ML or Hyperframes First?
**Question:** Runway ML (cinematic, per-second pricing) or Hyperframes (HTML-to-video, deterministic, cheaper) for the Milestone 4 video generation step?

**Why it matters:** Runway ML produces higher-quality video but costs more per page in a large content batch. Hyperframes renders structured HTML as video — well-suited for schema-card or FAQ-animation videos but not promotional cinematic content.

**Trade-off:**
- Runway first: best visual quality; higher cost; better for premium tier.
- Hyperframes first: low cost; programmatic; deterministic; sufficient for most local SEO videos.

**Recommendation:** Implement Hyperframes for MVP (Milestone 4). Add Runway ML as a premium plan option post-MVP. This mirrors Caleb Ulku's approach (video is supplementary, not the primary content driver).

---

## 5. Worker Hosting: Railway or Fly.io?
**Question:** Railway or Fly.io for the Docker-based worker (BullMQ + Playwright + long AI calls)?

**Why it matters:** Playwright's Chromium process consumes 512MB–1GB RAM. When many content jobs run simultaneously, the worker needs to scale horizontally. Both platforms support this but have different DX and pricing models.

**Trade-off:**
- Railway: simpler config, horizontal scaling via replica count, clear pricing, slightly less granular machine sizing.
- Fly.io: more control over machine size and region, slightly more complex Dockerfile + config, better for multi-region if needed.

**Recommendation:** Start on Railway. If Playwright OOM errors appear at scale, evaluate Fly.io with dedicated 2GB RAM machines per instance.

---

## 6. WordPress Integration: Application Password or OAuth?
**Question:** WP REST API with Application Passwords (already in plan) or WordPress.com OAuth for hosted WP.com sites?

**Why it matters:** The overwhelming majority of agency clients run self-hosted WordPress. Application Passwords work on every self-hosted WP install with zero plugin requirements. WordPress.com OAuth is only needed for WP.com-hosted blogs, which are a small fraction of agency clients.

**Decision needed:** Confirm Application Password as the only supported method for MVP, and explicitly state WP.com OAuth and WPGraphQL are out of scope until user demand warrants it.

---

## 7. Multi-Tenant Plan Tiers and Limits
**Question:** What exactly are the plan tiers, client limits, job limits, and feature gates?

**Why it matters:** This drives the Stripe metering setup, BullMQ job-limit middleware, and the client portal feature gate — all built in Milestone 6. Getting this wrong means re-architecting billing after launch.

**Key dimensions to decide before Milestone 6:**
- Max clients per workspace per tier
- Max content jobs per month (or per client)
- BYOK available on all paid tiers or only Agency tier?
- White-label / client portal available on which tiers?
- Overage model: hard block or soft limit with per-job charge?

**Suggested starting point:** Free Trial (1 client, 5 pages, no BYOK) / Starter ($99/mo, 10 clients, 100 pages/mo, BYOK) / Agency ($299/mo, unlimited clients, BYOK, white-label). Validate with 5 prospective agency users before committing.

---

## 8. DataForSEO Category Audit: Cost and Rate Limit Acceptance
**Question:** DataForSEO Local Pack API charges per call. Is the team aligned on this cost model and the per-workspace rate limiting strategy?

**Why it matters:** Each "Run Category Audit" click triggers a DataForSEO API call. If agencies run audits aggressively (e.g. 100 clients × 10 keywords = 1,000 calls/day), costs accumulate. The plan must define whether this is metered per workspace or absorbed as a platform cost.

**Estimated cost:** ~$0.002–$0.005 per call. At 1,000 calls/day = ~$2–5/day = ~$60–150/month. Manageable at MVP scale; needs a cap per plan tier at growth scale.

**Recommendation:** Meter DataForSEO calls per workspace (count in `AuditLog`); cap per plan tier; absorb cost at Free Trial level. Confirm with finance before Milestone 6 billing build.

---

## 9. Prospect Mode GBP Data Source
**Question:** For a prospect (no GBP OAuth), should the tool pull GBP data automatically via DataForSEO "Find Business" lookup, Google Places API, or require manual entry only?

**Why it matters:** A key agency workflow is auditing a prospect before signing them. The difference between manual entry and automated lookup is significant for UX — agencies may prospect 10–20 businesses per week.

**Options:**
- Manual entry only (lowest friction to implement; highest friction for user)
- DataForSEO Local Business lookup by name + address (automated; paid per call; ~$0.003)
- Google Places "Find Place From Text" (free tier up to 1,000/month; limited fields)

**Recommendation:** Use Google Places "Find Place" for initial prospect lookup (free tier sufficient for most agencies); supplement with DataForSEO if Places data is thin. Design the prospect form to accept manual overrides.

---

## 10. Eight-Pass Prompt Customisation: Hardcoded vs. Editable
**Question:** Should the eight-pass pipeline prompts live as static strings in the codebase, or should Agency owners be able to customise prompts per workspace (e.g. adjust the Human Bookends voice, the Conversion pass CTAs)?

**Why it matters:** Hardcoded prompts are simpler to maintain and produce consistent quality. Editable prompts are a significant product surface area — they add a prompt editor UI, per-workspace prompt storage, validation, and a support burden when agencies break their own quality with bad edits.

**Trade-off:**
- Hardcoded: simpler, consistent quality, no support overhead from user-modified prompts.
- Editable: more powerful for advanced agencies; required for white-label use cases where brand voice differs from defaults.

**Recommendation:** Hardcode all prompts in MVP. Post-MVP: add an "Advanced Prompts" panel (Agency tier only) with a warning that modifications affect output quality. Store custom prompts in the `AIProviderKey`-adjacent `WorkspaceConfig` table.