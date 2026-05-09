# Build Log

> Historical record of phases and dated milestones. Append to this when shipping a meaningful chunk of work; reference here from CLAUDE.md only as a link.

### Phase 1 — Foundation

- [x] Monorepo root (package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json) — 2026-04-29
- [x] packages/types — shared TypeScript types and role constants — 2026-04-29
- [x] packages/config — env schema validation with Zod — 2026-04-29
- [x] packages/shared — crypto utilities, Result type, AppError — 2026-04-29
- [x] prisma/schema.prisma — RefreshToken model added, CampaignStatus enum added, OutboundCallAttempt back-relation fixed — 2026-04-29
- [x] prisma/seed.ts — 6 RoleDefinitions and 3 Plans seeded (idempotent upserts) — 2026-04-29
- [x] apps/api — Express server, auth endpoints, RBAC middleware, health endpoint — 2026-04-29
- [x] apps/web — Next.js scaffold, login/signup pages, dashboard shell — 2026-04-29
- [x] Prisma migration applied (20260429061353_voiceautomation_init) — 2026-04-29
- [x] Health endpoint confirmed green: GET /health → {status: "ok", checks: {database: "ok", redis: "ok"}} — 2026-04-29
- [x] Signup works end to end — tenant created, tokens issued — 2026-04-29
- [x] Login works end to end — token returned, /me returns user + memberships — 2026-04-29
- [x] Tenant isolation primitives exist (RBAC middleware: requireRole, requirePlatformAdmin, requireTenantContext, requireTenantMatch) — 2026-04-29

### Phase 2 — Tenant Configuration Core — 2026-04-29

**Backend services and routes:**
- [x] `GET/PATCH /api/tenants/current` — workspace settings
- [x] `GET/PATCH /api/business-profile` — brand, address, hours, notification email
- [x] `GET/POST/PATCH/:id/publish /api/business-dna` — versioned Business DNA (draft → publish → active)
- [x] `GET/POST/PATCH/:id/publish /api/prompts` — prompt versioning (DRAFT → PUBLISHED), all 5 scopes
- [x] `GET/PATCH /api/agents/:roleType` — 7 agent roles, auto-provisioned on first access
- [x] `GET/PATCH /api/channels/:channelType` — 3 channels, auto-provisioned on first access
- [x] `GET/PATCH/POST:suspend/POST:restore /api/admin/tenants` — admin tenant list + detail + actions

**Frontend pages:**
- [x] `/settings` — workspace + business profile editor
- [x] `/business-dna` — versioned DNA editor with section tabs, draft/publish flow
- [x] `/prompts` — prompt library, create/edit/publish
- [x] `/agents` — 7 agent role configuration panels
- [x] `/channels` — 3 channel cards with enable/config
- [x] `/admin/tenants` — searchable tenant list
- [x] `/admin/tenants/[tenantId]` — tenant detail, suspend/restore, member list, integration status

**Exit gate verified:**
- Workspace settings save (email, timezone) ✅
- Business DNA draft published → active ✅
- Prompt created, published ✅
- Widget channel enabled ✅
- Admin route blocked for tenant_owner (FORBIDDEN) ✅
- Type-check clean ✅

### Phase 3 — Billing and Entitlements — 2026-04-29

**Backend services and routes:**
- [x] `stripe` package installed (v22, API version 2026-04-22.dahlia)
- [x] `getOrCreateStripeCustomer` — creates Stripe customer on first checkout, stores in `StripeCustomerRef`
- [x] `GET /api/billing/plans` — public endpoint, returns all active plans with entitlements
- [x] `GET /api/billing/subscription` — current tenant subscription with plan + entitlements
- [x] `POST /api/billing/checkout-session` — creates Stripe checkout session for a plan
- [x] `POST /api/billing/portal-session` — opens Stripe customer portal
- [x] `GET /api/entitlements` — returns effective entitlements for the tenant
- [x] `POST /api/webhooks/stripe` — raw-body handler, verifies Stripe signature, handles 4 events
- [x] Webhook events handled: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
- [x] Entitlement sync (`syncEntitlementsFromPlan`) — upserts `TenantEntitlement` rows from plan on subscription activate
- [x] Signup flow seeds starter plan entitlements immediately (non-fatal if Stripe key absent)
- [x] Seed updated to pull `STRIPE_PRICE_*` from env vars on `pnpm db:seed`

**Frontend pages:**
- [x] `/billing` — current subscription status, entitlement breakdown, plan selection cards, Stripe portal button

**Architecture fixes:**
- [x] Stripe webhook route mounted before `express.json()` with `express.raw()` for signature integrity
- [x] `billingRouter` mounted before auth-gated routers so public `/billing/plans` is reachable unauthenticated
- [x] Prisma `Without<>` discriminant union conflicts resolved via explicit `Prisma.AgentProfileUpdateInput` build
- [x] JSON null fields use `Prisma.JsonNull` sentinel instead of bare `null`
- [x] `tsconfig.base.json` and `packages/config` both include `"types": ["node"]`
- [x] All route files annotated `const router: IRouter = Router()` to fix TS2742

**Exit gate verified:**
- `GET /api/billing/plans` returns 3 plans with 7 entitlements each (no auth required) ✅
- Signup auto-seeds starter entitlements; `GET /api/entitlements` returns `{max_channels:1, widget_enabled:true, ...}` ✅
- `POST /api/billing/checkout-session` returns BAD_REQUEST when plan has no Stripe price ID ✅
- `POST /api/billing/portal-session` returns BAD_REQUEST when no Stripe customer exists ✅
- Stripe webhook endpoint reached (INTERNAL_ERROR expected without configured webhook secret in dev) ✅
- Type-check clean (API + web) ✅

### Pre-Phase 2 gap closures — 2026-04-29

- [x] `WidgetSession` model added — short-lived token, prompt/DNA snapshot, status lifecycle, migrated
- [x] n8n now uses `DB_POSTGRESDB_SCHEMA=n8n` — fully isolated from app `public` schema in docker-compose and env
- [x] Rate limiting applied at three tiers: auth (30 req/15min), general API (300 req/min), webhooks (60 req/min)
- [x] Refresh token cleanup job — runs at startup + every 6 hours, prunes expired/revoked tokens older than 7 days

### E2E Test Suite — 2026-04-29

- [x] `apps/e2e` package created with Puppeteer + tsx
- [x] 4 suites: `api` (12 tests), `auth` (6 tests), `billing` (5 tests), `config` (8 tests)
- [x] All 31 tests passing: `pnpm --filter @voiceautomation/e2e test`
- [x] Fixed bugs found by tests:
  - `/dashboard/page.tsx` was self-redirecting → fixed to redirect to `/settings`
  - Dashboard layout had no auth guard → added `AuthGuard` client component
  - Test localStorage key was `accessToken`, should be `va_access_token`
- [x] To run: `pnpm --filter @voiceautomation/e2e test` (all suites) or `test:api / test:auth / test:billing / test:config`

### Phase 4 — Google OAuth + Calendar Booking — 2026-04-29

**Backend services and routes:**
- [x] `googleapis` package installed in `apps/api`
- [x] `apps/api/src/lib/audit.ts` — reusable `writeAuditLog()` helper (non-fatal, Prisma.InputJsonValue typed)
- [x] `apps/api/src/services/google.service.ts` — full OAuth flow:
  - `startGoogleOAuth` — stores state token in DB, returns Google consent URL
  - `handleGoogleCallback` — exchanges code, fetches userinfo + calendar list, encrypts tokens (AES-256-GCM using AUTH_SECRET), stores in `SecretRef` + `GoogleConnectionDetail`
  - `getGoogleConnection` — returns status + email + calendar count
  - `disconnectGoogle` — revokes token, clears detail and secret refs, audit logged
  - `getAuthenticatedGoogleClient` — decrypts stored credentials, auto-refreshes if near expiry, returns ready `OAuth2Client`
- [x] `apps/api/src/services/appointment.service.ts`:
  - `searchAvailability` — queries Google Calendar freebusy, returns open 30-min slots
  - `createAppointment` — conflict-checks, creates Google Calendar event, stores Appointment record
  - `rescheduleAppointment` — patches Google event + DB record
  - `cancelAppointment` — deletes Google event + marks DB record CANCELED
  - `listAppointments` — paginated list with status/date filters
- [x] `apps/api/src/routes/integrations.ts` — `GET /api/integrations`, `POST /api/integrations/google/start`, `GET /api/integrations/google/callback` (browser redirect), `POST /api/integrations/google/reconnect`, `DELETE /api/integrations/google`
- [x] `apps/api/src/routes/appointments.ts` — `POST /api/appointments/availability/search`, `POST /api/appointments`, `PATCH /api/appointments/:id/reschedule`, `PATCH /api/appointments/:id/cancel`, `GET /api/appointments`
- [x] Routes mounted in `apps/api/src/routes/index.ts`
- [x] `apiFetchRaw` helper added to `useApi.ts` — returns raw `Response` for mutation calls

**Frontend pages:**
- [x] `/integrations` — Google connection panel: status badge, connect/reconnect/disconnect buttons, OAuth redirect handling, calendar count, last verified timestamp
- [x] `/appointments` — Appointment list with status badges, timezone display, cancel action
- [x] Sidebar updated with "Operations" section containing Integrations + Appointments links

**Architecture notes:**
- OAuth tokens encrypted at rest with AES-256-GCM (key derived from AUTH_SECRET)
- Token values never returned in API responses
- State token stored in `IntegrationConnection.metadataJson.oauthState` for callback verification
- All connection events audit-logged: `integration.google.oauth_started`, `integration.google.connected`, `integration.google.oauth_failed`, `integration.google.disconnected`
- Google client auto-refreshes tokens within 5 minutes of expiry

**Exit gate (manual verification required):**
- [ ] `GET /api/integrations` returns `{ google: { status: "NOT_CONNECTED", ... } }` for new tenant
- [ ] `POST /api/integrations/google/start` returns redirect URL (requires GOOGLE_CLIENT_ID/SECRET in .env)
- [ ] OAuth callback redirects to `/integrations?google=success&email=...` on success
- [ ] `/integrations` page shows CONNECTED status with email and calendar count
- [ ] Disconnect clears connection and shows NOT_CONNECTED
- [ ] `POST /api/appointments/availability/search` returns slots when Google connected
- [ ] `POST /api/appointments` creates appointment in Google Calendar + DB

### Phase 5 & 6 — Voice Gateway + Inbound Receptionist — 2026-04-30 / 2026-05-01

**Voice gateway (inbound calls):**
- [x] Gemini Live session management via `apps/voice-gateway/src/services/gemini.service.ts`
- [x] Inbound Twilio Media Stream handler at `apps/voice-gateway/src/inbound.ts`
- [x] Transcript delta accumulation with per-speaker buffers — flushed on turn complete or speaker switch
- [x] `cleanTranscript()` in `summary.service.ts` — GPT-4o-mini post-processes raw ASR output to fix mid-word spacing artifacts before storing
- [x] `generateSummary()` — 2-3 sentence call summary stored in `Conversation.summaryText`
- [x] `persistConversation()` — updates existing Conversation (matched by `externalCallId`) for inbound; creates new for widget
- [x] `onClose` fix — removed `closed = true` from `close()` so the WebSocket close event fires `finalize()`
- [x] Voice name selector — `voiceName` stored in `ChannelConfig.configJson`, passed to Gemini `speech_config.voice_config.prebuilt_voice_config`
- [x] Gateway reads OpenAI key from DB via `lib/config.ts` (AES-256-GCM decrypt) — not raw env var

**Curated agent voices (7 options presented to tenants in channel config):**
| Voice | Gender | Style |
|---|---|---|
| Zephyr | Female | Bright & clear |
| Despina | Female | Smooth & polished |
| Aoede | Female | Warm & breezy |
| Charon | Male | Deep & authoritative |
| Fenrir | Male | Warm & approachable (default) |
| Puck | Male | Upbeat & conversational |
| Sulafat | Neutral | Warm & even |

**Twilio recording pipeline:**
- [x] `startCallRecording()` — triggers Twilio REST API to start recording on call connect
- [x] Twilio sends webhook to `POST /api/webhooks/twilio/recording` when recording is ready
- [x] `handleRecordingReady()` — decrypts Twilio auth token from `TwilioConnectionDetail`, fetches MP3, uploads to Bunny storage zone
- [x] `Conversation.recordingStatus` lifecycle: `null → processing → stored` (or `failed` / `twilio_hosted`)
- [x] `GET /api/conversations/:id/recording` — proxies audio blob from Bunny storage via API (bypasses CDN auth requirement)
- [x] Conversations page — audio player, transcript (word-for-word, speaker-labeled), and summary

**Key bug fixes logged here to avoid repeating:**
- Frankfurt (DE) Bunny region uses `storage.bunnycdn.com` — NOT `de.storage.bunnycdn.com`
- Twilio Media Stream `<Connect><Stream>` cannot coexist with `<Record>` — recording must use REST API separately
- `persistConversation` must `updateMany` by `externalCallId` for inbound calls, not create a new record
- `scryptSync` dot separator (`.`) for Twilio tokens; colon separator (`:`) for systemConfig AES secrets — do not mix

### Phase 9 — Hardening — 2026-05-01

- [x] `TWILIO_ENFORCE_SIG=true` set in `/opt/myorbisvoice/.env.prod` — spoofed Twilio webhooks now hard-rejected with 403
- [x] Audit logging added: `auth.signup`, `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`
- [x] Audit logging added: `billing.checkout_completed`, `billing.invoice_paid`, `billing.subscription_updated`, `billing.subscription_canceled`
- [x] `db-backup` Docker service added to `docker-compose.prod.yml` — runs `pg_dump` every 24h, retains 30 days, volume `myorbisvoice_db_backups`
- [x] n8n double-locked: Caddy `basic_auth` layer added to `Caddyfile` + n8n's own auth (both required)
- [x] Disaster backup taken: `backups/disaster-20260501/` — local DB, prod DB, env.prod, n8n exports, manifest
- [x] Git tag: `disaster-backup-20260501` — aligns with snapshot `db_20260501_044937_hardening-complete.dump`
- [x] Stale files removed: `client_secret_*.json`, `plan.md`, `WORKING_STATE.md`, `docker-compose.yml` (root), `infrustructure/` (typo duplicate)

**⚠️ PENDING — Do this next session:**
- [ ] Re-download the Google OAuth client secret JSON from Google Cloud Console and store it securely off-repo (1Password / Bitwarden). The file `client_secret_548023119687-734aljh9786uh1k85kv0506coob25rje.apps.googleusercontent.com.json` was deleted from the repo root as a security cleanup. The credentials are still live and stored in the DB — but the raw JSON file should be kept in a secure offline location in case the Google OAuth connection ever needs to be re-established from scratch. Get it from: Google Cloud Console → project `myorbisvoice` → APIs & Services → Credentials → OAuth 2.0 Client IDs → Download JSON.

**Known Deploy Pitfalls (additions):**
| Pitfall | What Happens | Fix |
|---|---|---|
| Bunny DE region wrong hostname | `ENOTFOUND de.storage.bunnycdn.com` | Frankfurt uses `storage.bunnycdn.com` (same as NY) |
| CDN URL without linked pull zone | Audio player shows 0:00/0:00 | Proxy audio via API storage endpoint instead |
| `closed=true` in `close()` before ws.close() | `onClose` never fires, summaries never generated | Remove `closed=true` from `close()` — let the ws event set it |
| Caddy bcrypt hash with `$` in .env.prod | Docker Compose expands `$2a` as variable | Hardcode hash directly in Caddyfile, don't use env var |

### Multi-channel campaign automation — 2026-05-04

Tag-driven campaigns now fire across multiple channels independently. Email is fully live; SMS routes through master Twilio creds (testing only until A2P / toll-free); voice and WhatsApp are wired but parked behind documented backlog items (#15, #18).

**Schema:**
- [x] `Campaign.enableVoice / enableSms / enableEmail / enableWhatsapp` toggles
- [x] `Campaign.smsBody / whatsappBody / emailSubject / emailBody` content fields
- [x] `CampaignEnrollment.channel` (enum VOICE/SMS/EMAIL/WHATSAPP) + uniqueness `(campaignId, contactId, channel)` so each channel is its own enrollment row
- [x] Migration applied to prod after manually dropping the legacy `(campaignId, contactId)` unique constraint

**API:**
- [x] [`applyTag()`](apps/api/src/services/campaign.service.ts) fans out one enrollment per enabled channel on the matched campaign — failure of one channel doesn't block the others
- [x] [`apps/api/src/jobs/campaign-scheduler.ts`](apps/api/src/jobs/campaign-scheduler.ts) — 60-second poll, optimistic claim (PENDING → IN_PROGRESS guarded by `updateMany` count), per-channel dispatch, retry honouring `maxRetries` and `retryIntervalHours`, exit on success → COMPLETED
- [x] Template substitution: `{firstName}`, `{lastName}`, `{fullName}`, `{email}`, `{phone}`, `{businessName}`, `{businessPhone}`, `{appointmentDate}`, `{appointmentTime}`. Unknown tokens left in place to surface missing-context bugs
- [x] `dispatchEmail()` uses existing `sendGmailEmail()` (Google OAuth on the connected tenant mailbox)
- [x] `dispatchSms()` uses `sendTestMessage()` with master creds (temporary — see backlog #16)
- [x] `dispatchVoice()` is a stub returning FAILED with a clear note (see backlog #15)
- [x] Auto-tag hook in [`/internal/gateway/tools/record-disposition`](apps/api/src/routes/internal-gateway.ts): outcome → tag map (`BOOKED`→`booked`, `CALLBACK_REQUESTED`→`callback-requested`, `INFO_REQUEST`→`info-requested`, `QUALIFIED_LEAD`→`qualified-lead`, `MISSED_CALL`→`missed-call`)
- [x] Appointment-reminder hook in [`createAppointment()`](apps/api/src/services/appointment.service.ts): auto-enrolls into the `appointment-scheduled` campaign with `scheduledCallAt = startAt - 24h`. Skips reminders for appointments already <24h away.

**Frontend:**
- [x] Campaign form: 4 channel toggle cards (Voice / SMS / Email / WhatsApp), WhatsApp disabled with "Coming soon" badge
- [x] Conditional content fields appear when their channel is enabled (voice prompt, SMS body, email subject + body, WhatsApp body)
- [x] Save validation enforces "at least one channel" + required content per enabled channel

**Default campaigns seeded for the test tenant** (all email-only at launch):
- Booking Confirmation — tag `booked`, 0h delay
- Day-Before Reminder — `appointment-scheduled` (auto-enrolled by `createAppointment`), 24h before
- Callback Follow-Up — tag `callback-requested`, 4h delay
- Missed-Call Follow-Up — tag `missed-call`, 0h delay

**Verification:**
- [x] Fired `applyTag('booked')` on a real test contact → enrollment created (channel=EMAIL, status=PENDING) → scheduler ticked at +60s → `sendGmailEmail()` succeeded → MessageLog row written (deliveryStatus=sent, providerMessageId=`19df25b3c0a42cb4`) → enrollment marked COMPLETED at 09:39:18 UTC
- [x] Email landed in `crawford.peterson.sr@gmail.com` from connected mailbox `onbrandcopywriter@gmail.com`

**Twilio Test Credentials infrastructure (also shipped today):**
- [x] `Twilio Test Credentials` card in `Admin → System Settings` (encrypted storage)
- [x] `Send Test SMS` panel below it — Mode=Live/Test, From, To, body, magic-number reference card
- [x] `sendTestMessage()` in [sms.service.ts](apps/api/src/services/sms.service.ts) — bypasses tenant subaccounts, uses master live or test creds
- [x] Code path verified end-to-end via direct service invocation against the prod container (returns `{ok:false, errorCode:UNKNOWN, errorMessage:"Twilio Test credentials not configured…"}` until creds are pasted)
- [x] Toll-free verification submission package drafted at [docs/twilio-toll-free-verification.md](docs/twilio-toll-free-verification.md)

### Partner program completion + hardening sweep — 2026-05-05

Long session. Eight feature commits, four backlog items closed, full repo cleanup. Tagged `partner-program-complete-20260505` as the known-good checkpoint.

**Stripe Connect Express partner onboarding (Phase 8 close-out):**
- [x] `AffiliateAccount.stripeConnectAccountId` field added (unique, indexed)
- [x] `createConnectOnboardingLink` / `getConnectStatus` / `refreshConnectStatus` services
- [x] Three API routes: `POST /api/affiliate/connect/onboard`, `GET /connect/status`, `POST /connect/refresh`
- [x] Partner-portal Payouts page Connect Now button + status display + return-URL refresh effect
- [x] Dashboard checklist Connect step wired to live status
- [x] EN+ES i18n strings for the full Connect flow
- [x] Verified end-to-end: bob@test.com completed real Stripe Express onboarding in test mode, returned with `payoutsEnabled: true`, `detailsSubmitted: true`, `chargesEnabled: true`

**Three commission-lifecycle webhook handlers:**
- [x] `charge.refunded` → reverses PENDING/APPROVED affiliate commissions, decrements `totalEarnedCents` for previously-credited APPROVED ones, flags PAID ones for manual claw-back via audit log
- [x] `charge.dispute.created` → puts PENDING/APPROVED commissions on HOLD (not REVERSED — disputes can still be won)
- [x] `account.updated` (Connect-scoped) → syncs `payoutMethodJson` snapshot when partner Connect account changes
- [x] `findConversionForCharge` walks invoice→subscription chain OR matches `payment_intent` for one-time/LTD
- [x] Audit actions: `affiliate.commission_reversed_refund`, `affiliate.commission_held_dispute`, `affiliate.connect_status_synced`

**Stripe key infrastructure:**
- [x] `bootStripeFromConfig()` — reads `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`, `stripe_webhook_secret_connect` from SystemConfig at API boot, hydrates `process.env`. Called from `index.ts` before `listen()` AND from the admin "save Stripe settings" endpoint so changes take effect with no container restart.
- [x] Dual webhook signing secret support — Stripe Workbench locks "Events from" scope at destination creation, so we run two destinations (`elegant-wonder` for platform events, `empowering-dream` for Connect events) each with its own secret. `getWebhookSecrets()` returns both; `handleStripeWebhook` iterates and accepts the first that verifies. Forged signatures fail every secret and return 400.
- [x] Admin UI exposes both webhook-secret fields with status indicators

**Audit-log impersonation attribution:**
- [x] `writeAuditLog` extended with `impersonationSessionId`
- [x] New helper `writeAuditLogFromRequest(req, entry)` auto-attaches the session ID from `req.user`
- [x] Swept 6 user-facing route files (admin, auth, conversations, a2p, phone-numbers, ai-assist) — 37 call sites migrated. Service-layer + webhook + voice-gateway audit calls intentionally NOT migrated (those run in system context, never under impersonation).
- [x] Verified end-to-end: real ImpersonationSession + writeAuditLogFromRequest writes a row with the session ID attached

**Per-turn agent latency telemetry (#3 from backlog):**
- [x] T_userLastAudio + T_firstAgentAudio captured per turn on inbound calls
- [x] Persisted to `Conversation.metadataJson.latency` as `{ turns, count, min, max, median, p95 }`
- [x] Logged inline (`[inbound] turnaround: <N>ms`) and summarized at finalize
- [x] Foundation for data-driven VAD tuning — no more blind silence_duration_ms changes

**Channel-by-tier gating (#5 from backlog):**
- [x] `/channels` page reads `/api/entitlements`, locks any channel card whose entitlement is false
- [x] Locked card: muted styling, "Locked" badge, "Upgrade plan to unlock →" link to `/billing`
- [x] EN+ES i18n strings

**Tooltips on billing entitlements (#6 priority surfaces):**
- [x] Each entitlement key on `/billing` now shows a hover tooltip with a 1-2 sentence plain-language explanation
- [x] Covers all 7 current entitlement keys, EN+ES

**Backlog audit + status reconciliation:**
- [x] CLAUDE.md backlog rewritten with status legend (✅ DONE / 🟡 PARTIAL / ❌ TODO / 🔵 DEFERRED) and a snapshot table at the top
- [x] Marked: 1 (impersonation), 2 (agent speaks first), 4 (conversations bulk), 5 (channel-by-tier), 7 (help), 8 (usage), 9 (Google integration), 10 (calendar placeholders), 11 (logo upload), 12 (notifications), 13 (admin help text) as ✅ DONE; 3 (latency) and 6 (tooltips) as 🟡 PARTIAL with documented next steps; 14 (Playwright screenshots) as 🔵 DEFERRED-BY-DESIGN per its own dependency on a feature-testing sprint

**Repo cleanup + checkpoint:**
- [x] Committed 71 files / 7,245 lines of accumulated work in 8 logical chunks: tooling (i18n scanner + knip), i18n surface-area pass, marketing site Spanish + chart overhaul, Stripe Connect onboarding, preferredLocale backend, lint cleanups (parseInt radix / Number.isNaN / unused vars / dead helpers), Stripe webhook + key infrastructure, CLAUDE.md policy additions
- [x] Tag: `partner-program-complete-20260505` → `af5dab1d`
- [x] Local DB dump (203K), prod DB dump (361K), DR snapshot (compose + env + caddy)
- [x] DR restore test against PG16 sandbox: 14/15 tables matched exactly; AuditLog had 7 expected new rows from continuing prod traffic
- [x] Knip dead-code pass — removed unused `@biomejs/biome` devDependency; flagged 36 unused exports + 35 unused types as service-layer surface intentionally exposed for future use, deferred individual deletion
- [x] [docs/stripe-config.md](docs/stripe-config.md) — reconstruction-grade reference for the Stripe account (account ID, branding values, both webhook destinations, plan price mapping, ~1-hour worst-case rebuild checklist)
- [x] i18n full-app scan — wrapped partner-portal signup, login, and profile pages (highest-impact customer-facing entry surfaces); EN+ES parity verified

**External wait queues (no action — just tracking):**
- Twilio A2P 10DLC approval (1-4 weeks queue)
- Twilio toll-free verification (drafted, ready to submit, 2-5 business days post-submission)
- Outbound voice carrier reputation (deferred to v1.1 per backlog #19)

**End-of-session state:** prod healthy, working tree clean, no remaining TODO items the team can close without external signal. Ready for first paying customers.

### Phase 1 notes
- Existing ports 5432 and 6379 are occupied by other projects (umoja-postgres, umoja-redis). Phase 1 reuses these services. The voiceautomation DB was created on umoja-postgres with its own user/role.
- Docker compose is set up for full-stack mode but dev workflow runs API/web natively via pnpm dev.
- To run the API: `pnpm --filter @voiceautomation/api dev` (from repo root)
- To run the web: `pnpm --filter @voiceautomation/web dev` (from repo root)
- AUTH_SECRET is in .env (generated, not committed)
