import type { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { getTwilioAuthToken } from '../services/twilio.service.js'

/**
 * Validate X-Twilio-Signature using the platform's master Twilio auth token.
 *
 * In the managed-Twilio model (2026-05-02 onward), all tenants share one
 * master Twilio account so signature validation needs only one auth token —
 * no per-tenant lookup required. Falls back to the TWILIO_AUTH_TOKEN env var
 * if SystemConfig isn't yet populated.
 *
 * Enforcement is ON by default. Set TWILIO_ENFORCE_SIG=false only in local dev.
 * Only runs on /webhooks/twilio/* paths — passes all other routes through.
 */
export async function validateTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/webhooks/twilio')) { next(); return }
  const enforce = process.env['TWILIO_ENFORCE_SIG'] !== 'false'

  const signature = req.headers['x-twilio-signature'] as string | undefined

  // No signature at all — only reject in enforce mode
  if (!signature) {
    if (enforce) {
      return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
    }
    console.warn('[twilio-sig] No X-Twilio-Signature header — passing through (not enforced)')
    return next()
  }

  // Platform master auth token — same for all tenants
  let authToken = await getTwilioAuthToken()
  if (!authToken) authToken = process.env['TWILIO_AUTH_TOKEN'] ?? null

  if (!authToken) {
    console.warn('[twilio-sig] No platform Twilio auth token configured — cannot validate signature')
    if (enforce) {
      return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
    }
    return next()
  }

  const protocol = req.headers['x-forwarded-proto'] ?? (req.secure ? 'https' : 'http')
  const host     = req.headers['host'] ?? ''
  const url      = `${protocol}://${host}${req.originalUrl}`

  const valid = twilio.validateRequest(authToken, signature, url, req.body ?? {})

  if (!valid) {
    console.warn('[twilio-sig] Invalid signature from', req.ip, 'url:', url)
    if (enforce) {
      return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
    }
  }

  next()
}
