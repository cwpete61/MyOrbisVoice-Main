import 'dotenv/config'
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
import { bootStripeFromConfig } from './lib/stripe.js'
import { recoverStuckExtractions } from './services/knowledge-base.service.js'

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

// Serve uploaded files (logos, etc.) directly
app.use('/uploads', express.static(process.env['UPLOADS_DIR'] ?? '/app/uploads'))

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

  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`)
    console.log(`[api] env: ${env.NODE_ENV}`)
    startTokenCleanupJob()
    startCampaignScheduler()
    startOnboardingEmailsJob()
    startReminderRunner()
    // Reset any KB extraction jobs left in PROCESSING from a prior crash —
    // we can't resume the original buffer, so they get FAILED with a clear
    // message and the user can re-upload.
    recoverStuckExtractions().catch(e => console.error('[kb][recover] boot:', e))
  })
}

void start()

export default app
