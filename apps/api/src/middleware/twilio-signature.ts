import type { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { getTwilioAuthToken } from '../services/twilio.service.js'
import { prisma } from '../lib/prisma.js'

// Validate X-Twilio-Signature using the per-tenant auth token.
// Signature enforcement is OFF by default — set TWILIO_ENFORCE_SIG=true to hard-reject invalid signatures.
// Without enforcement, invalid signatures are logged as warnings but the call proceeds.
// This allows the call flow to be verified before locking down security.
export async function validateTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  const enforce = process.env['TWILIO_ENFORCE_SIG'] === 'true'

  const signature = req.headers['x-twilio-signature'] as string | undefined

  // No signature at all — only reject in enforce mode (likely a non-Twilio request)
  if (!signature) {
    if (enforce) {
      return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
    }
    console.warn('[twilio-sig] No X-Twilio-Signature header — passing through (not enforced)')
    return next()
  }

  // Determine which auth token to use for validation
  let authToken: string | null = null

  const toNumber = req.body?.To as string | undefined
  if (toNumber) {
    try {
      const phone = await prisma.phoneNumber.findFirst({
        where: { e164Number: toNumber },
        select: { tenantId: true },
      })
      if (phone) {
        authToken = await getTwilioAuthToken(phone.tenantId)
      }
    } catch { /* fall through to platform key */ }
  }

  if (!authToken) {
    authToken = process.env['TWILIO_AUTH_TOKEN'] ?? null
  }

  if (!authToken) {
    console.warn('[twilio-sig] No auth token available for signature validation — passing through')
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
    // Log the mismatch but don't block — helps diagnose URL config issues
  }

  next()
}
