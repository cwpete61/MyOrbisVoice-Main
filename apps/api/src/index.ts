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

const env = getEnv()
const app: Express = express()
const PORT = 4000

// Security headers
app.use(helmet())

// CORS — allow configured origin(s)
const allowedOrigins = [env.APP_BASE_URL, 'https://app.myorbisvoice.com'].filter(Boolean)
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

// Body parsing for all other routes
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

const rateLimitResponse = { errors: [{ code: 'RATE_LIMITED', message: 'Too many requests, please slow down' }] }

// Strict limit on auth — prevent brute force and signup spam (relaxed in dev)
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'development' ? 300 : 30,
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

// Routes
app.use(routes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ errors: [{ code: 'NOT_FOUND', message: 'Route not found' }] })
})

// Error handler — must be last
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`)
  console.log(`[api] env: ${env.NODE_ENV}`)
  startTokenCleanupJob()
})

export default app
