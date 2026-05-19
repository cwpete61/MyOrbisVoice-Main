/**
 * Amazon SES event webhook — public, no auth (called by Amazon SNS).
 *
 * The cold-email configuration set publishes bounce/complaint events to an SNS
 * topic, which POSTs them here. Every message is signature-verified against
 * AWS's signing certificate before it is trusted (the endpoint is public, so
 * an unverified POST must never be able to suppress addresses or pause a
 * partner). Handles the SNS subscription handshake and forwards real events
 * to recordSesEvent.
 */
import express from 'express'
import { Router, type IRouter, type Request, type Response } from 'express'
import MessageValidator from 'sns-validator'
import { recordSesEvent } from '../services/cold-email.service.js'

const router: IRouter = Router()
const validator = new MessageValidator()

function validateSns(msg: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(msg, err => (err ? reject(err) : resolve()))
  })
}

// SNS posts its JSON with Content-Type: text/plain — parse the raw body here
// rather than relying on the global JSON parser, which skips non-JSON types.
router.post(
  '/webhooks/ses',
  express.text({ type: () => true, limit: '512kb' }),
  async (req: Request, res: Response) => {
    let msg: Record<string, unknown>
    try {
      msg = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      res.status(400).send('bad body')
      return
    }
    if (!msg || typeof msg !== 'object') {
      res.status(400).send('bad body')
      return
    }

    // Reject anything not genuinely signed by AWS SNS.
    try {
      await validateSns(msg)
    } catch {
      res.status(403).send('invalid signature')
      return
    }

    const type = String(msg['Type'] ?? '')

    if (type === 'SubscriptionConfirmation') {
      // Signature is verified, so SubscribeURL is authentic; visiting it
      // confirms the subscription. Host-check anyway as defense in depth.
      const subscribeUrl = String(msg['SubscribeURL'] ?? '')
      if (/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//.test(subscribeUrl)) {
        try { await fetch(subscribeUrl) } catch { /* SNS will retry */ }
      }
      res.sendStatus(200)
      return
    }

    if (type === 'Notification') {
      try {
        const event = JSON.parse(String(msg['Message'] ?? '{}'))
        await recordSesEvent(event)
      } catch (err) {
        // Don't make SNS retry forever over one malformed event.
        console.error('[webhooks-ses] event processing failed:', err)
      }
      res.sendStatus(200)
      return
    }

    // UnsubscribeConfirmation and anything else — acknowledge.
    res.sendStatus(200)
  },
)

export default router
