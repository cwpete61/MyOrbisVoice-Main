/**
 * Twilio A2P 10DLC status callbacks.
 *
 * Trust Hub / BrandRegistration / UsAppToPerson resources fire a status
 * callback as their review state changes. This route ingests those and
 * advances the matching TenantA2PApplication through its state machine.
 *
 * Mounted at /api with validateTwilioWebhook — the middleware runs on the
 * /webhooks/twilio/* path prefix and validates X-Twilio-Signature.
 *
 * Live callbacks only fire once live A2P submission is enabled; until then
 * this route is correct-shaped scaffolding (mock submissions never call it).
 */
import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { applyTwilioStatusCallback } from '../services/a2p.service.js'

const router: IRouter = Router()

// POST /api/webhooks/twilio/a2p — Trust Hub / Brand / Campaign status callback.
router.post('/webhooks/twilio/a2p', asyncHandler(async (req, res) => {
  const body = (req.body ?? {}) as Record<string, string>

  // Twilio uses different field names per resource — accept any of them.
  const resourceSid =
    body['BrandSid'] || body['CampaignSid'] || body['CustomerProfileSid'] ||
    body['TrustProductSid'] || body['ResourceSid'] || body['Sid']
  const status =
    body['Status'] || body['BrandStatus'] || body['CampaignStatus'] ||
    body['CustomerProfileStatus'] || body['EvaluationStatus']
  const failureReason = body['FailureReason'] || body['Errors'] || body['StatusCallbackError']

  await applyTwilioStatusCallback({ resourceSid, status, failureReason })

  // Always 200 — Twilio retries on non-2xx; an unknown SID is a no-op, not an error.
  res.status(200).json({ received: true })
}))

export default router
