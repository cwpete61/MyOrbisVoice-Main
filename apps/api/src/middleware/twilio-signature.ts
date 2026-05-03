import type { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { getTwilioAuthToken } from '../services/twilio.service.js'
import { getSubaccountAuthTokenBySid } from '../services/twilio-subaccount.service.js'

/**
 * Validate X-Twilio-Signature.
 *
 * In the managed-Twilio model every tenant has its own subaccount under the
 * platform master. Twilio signs each webhook with the auth token of the
 * account that owns the resource that triggered it — so a call to a
 * tenant-purchased number is signed with that tenant's SUBACCOUNT token,
 * not master's. We therefore validate in this order:
 *
 *   1. Try the master auth token (for webhooks that aren't subaccount-scoped,
 *      and for backwards compat).
 *   2. If that fails, look at the AccountSid form field in the webhook body
 *      to identify which subaccount sent it, decrypt that subaccount's token,
 *      and try again.
 *
 * Enforcement is ON by default. Set TWILIO_ENFORCE_SIG=false only in local dev.
 * Only runs on /webhooks/twilio/* paths.
 */
export async function validateTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/webhooks/twilio')) { next(); return }
  const enforce = process.env['TWILIO_ENFORCE_SIG'] !== 'false'

  const signature = req.headers['x-twilio-signature'] as string | undefined

  if (!signature) {
    if (enforce) {
      return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
    }
    console.warn('[twilio-sig] No X-Twilio-Signature header — passing through (not enforced)')
    return next()
  }

  let masterToken = await getTwilioAuthToken()
  if (!masterToken) masterToken = process.env['TWILIO_AUTH_TOKEN'] ?? null

  const protocol = req.headers['x-forwarded-proto'] ?? (req.secure ? 'https' : 'http')
  const host     = req.headers['host'] ?? ''
  const url      = `${protocol}://${host}${req.originalUrl}`
  const body     = (req.body ?? {}) as Record<string, string>

  // Step 1: try master token
  if (masterToken && twilio.validateRequest(masterToken, signature, url, body)) {
    return next()
  }

  // Step 2: try the subaccount token if the form body identifies a subaccount
  const accountSid = body['AccountSid']
  if (accountSid && accountSid.startsWith('AC')) {
    const subToken = await getSubaccountAuthTokenBySid(accountSid)
    if (subToken && twilio.validateRequest(subToken, signature, url, body)) {
      return next()
    }
  }

  console.warn('[twilio-sig] Invalid signature from', req.ip, 'url:', url, 'accountSid:', accountSid ?? '(none)')
  if (enforce) {
    return res.status(403).type('text/xml').send('<Response><Hangup/></Response>')
  }
  next()
}
