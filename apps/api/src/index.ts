import 'dotenv/config'
import { initSentry } from './lib/sentry.js'
import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { getEnv } from '@voiceautomation/config'
import routes from './routes/index.js'
import { webhooksRouter } from './routes/webhooks.js'
import { errorHandler } from './middleware/error-handler.js'
import { startTokenCleanupJob } from './jobs/token-cleanup.js'
import { startCampaignScheduler } from './jobs/campaign-scheduler.js'
import { startOnboardingEmailsJob } from './jobs/onboarding-emails.js'
import { startReminderRunner } from './jobs/reminder-runner.js'
import { startSendingDomainRunner } from './jobs/sending-domain-runner.js'
import { startColdEmailSequencer } from './jobs/cold-email-sequencer.js'
import { bootStripeFromConfig } from './lib/stripe.js'
import { recoverStuckExtractions } from './services/knowledge-base.service.js'
import { ensureSeed as seedMarketingKit } from './services/marketing-kit.service.js'

// Error monitoring — first thing in the module body so it's armed before
// the server starts. No-ops when SENTRY_DSN_API is unset.
initSentry()

const env = getEnv()
const app: Express = express()
const PORT = 4000

// Trust reverse proxy (Caddy) so rate-limit sees real client IP from X-Forwarded-For
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS — allow configured origin(s).
// Marketing site (myorbisvoice.com + /es/) is allow-listed alongside the
// app subdomain because the marketing footer fetches /api/public/social-links
// cross-origin to render social icons. The /api/public/* paths are public by
// design — auth-gated routes still require a session token regardless of CORS.
const allowedOrigins = [
  env.APP_BASE_URL,
  'https://app.myorbisvoice.com',
  'https://myorbisvoice.com',
  'https://www.myorbisvoice.com',
  'https://myorbisresults.com',
  'https://www.myorbisresults.com',
  // Local development — Python http.server preview at :8765 (preview PWA
  // + partner pages) needs to be able to mint widget sessions against prod.
  'http://localhost:8765',
  'http://127.0.0.1:8765',
].filter(Boolean)
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  }),
)

// Stripe webhook — must receive raw body for signature verification, mounted before express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhooksRouter)

// Mail ingestion — must receive raw RFC 5322 email body, mounted before express.json().
// Auth + routing handled by /api/internal/mail/ingest (see routes/internal-mail.ts).
app.use(
  '/api/internal/mail',
  express.raw({ type: ['message/rfc822', 'application/octet-stream', 'text/plain'], limit: '25mb' }),
)

// Serve uploaded files (avatars, logos, etc.) directly. These are embedded as
// <img> on the web app at app.myorbisvoice.com — a different subdomain — so
// the helmet() default `Cross-Origin-Resource-Policy: same-origin` blocks
// them with the browser-side ERR_BLOCKED_BY_RESPONSE.NotSameOrigin error.
// Override CORP to `cross-origin` for this route only; the rest of the API
// keeps the stricter default.
app.use(
  '/uploads',
  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  express.static(process.env['UPLOADS_DIR'] ?? '/app/uploads'),
)

// Body parsing for all other routes. The `verify` callback stashes the raw
// body buffer on req.rawBody — required by Svix/Resend webhook signature
// verification (Phase F.4). Cheap: same buffer the parser already used.
app.use(express.json({
  limit: '4mb',
  verify: (req, _res, buf) => { (req as any).rawBody = buf },
}))
app.use(express.urlencoded({ extended: true }))

const rateLimitResponse = { errors: [{ code: 'RATE_LIMITED', message: 'Too many requests, please slow down' }] }

// Strict limit on auth — prevent brute force and signup spam (relaxed in dev)
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'development' ? 300 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse,
  }),
)

// Generous global limit on all other API routes
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse,
    skip: (req) => req.path.startsWith('/auth'), // auth has its own stricter limit
  }),
)

// Strict limit on webhooks — reject replay floods
app.use(
  '/api/webhooks',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse,
  }),
)

// Routes (Twilio webhooks are mounted inside routes/index.ts before auth-gated routers)
app.use(routes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'Route not found' }] })
})

// Error handler — must be last
app.use(errorHandler)

// Start server
async function start() {
  // Hydrate Stripe keys from SystemConfig (admin UI) before any handler reads
  // them. Falls through to env-var defaults if no DB row exists.
  await bootStripeFromConfig().catch(err => {
    console.error('[api] bootStripeFromConfig failed, falling back to env vars:', err?.message ?? err)
  })

  // One-time seed of the Marketing Kit table from the legacy hardcoded list,
  // plus a default settings row. Idempotent: only inserts if the table is empty.
  await seedMarketingKit()
    .then((r) => { if (r.seededVideos > 0) console.log(`[api] marketing-kit: seeded ${r.seededVideos} videos`) })
    .catch((e) => console.error('[api] marketing-kit seed failed:', e?.message ?? e))

  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`)
    console.log(`[api] env: ${env.NODE_ENV}`)
    startTokenCleanupJob()
    startCampaignScheduler()
    startOnboardingEmailsJob()
    startReminderRunner()
    startSendingDomainRunner()
    startColdEmailSequencer()
    // Reset any KB extraction jobs left in PROCESSING from a prior crash —
    // we can't resume the original buffer, so they get FAILED with a clear
    // message and the user can re-upload.
    recoverStuckExtractions().catch(e => console.error('[kb][recover] boot:', e))
    // F.4 — bulk email campaign worker. Ticks every 15s; respects per-partner
    // daily cap, send window, and drip interval. Safe to no-op when no
    // RUNNING campaigns exist.
    void import('./services/email-campaign-worker.service.js').then(m => m.startCampaignWorker())
    // Webinar Marketing worker — partner-scoped lead-discovery pipeline.
    // Phase 1: tick is a no-op. Phase 2+ stages discovery/crawl/verify.
    void import('./services/webinar-marketing/worker.service.js').then(m => m.startWebinarMarketingWorker())
    // Twilio reconcile worker — detects DB↔Twilio drift every 30 min.
    void import('./services/twilio-reconcile.service.js').then(m => m.startTwilioReconcileWorker())
  })
}

void start()

export default app
