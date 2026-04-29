import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { buildOutboundTwiml, handleOutboundStatus } from '../services/outbound.service.js'

const router: IRouter = Router()

// Twilio calls this when the outbound call connects — return TwiML script
router.post('/webhooks/twilio/outbound/twiml', asyncHandler(async (req, res) => {
  const { attemptId, tenantId } = req.query as Record<string, string>
  const { campaignId } = req.body as Record<string, string>

  let twiml: string
  try {
    // Try to get campaignId from body (Twilio passes it if set), fall back to DB
    let cId = campaignId
    if (!cId && attemptId) {
      const { prisma } = await import('../lib/prisma.js')
      const attempt = await prisma.outboundCallAttempt.findUnique({
        where: { id: attemptId },
        select: { campaignId: true },
      })
      cId = attempt?.campaignId ?? ''
    }
    twiml = await buildOutboundTwiml(tenantId ?? '', cId ?? '')
  } catch {
    twiml = '<Response><Say voice="Polly.Joanna">Hello, this is a call from our team. Thank you for your time. Goodbye.</Say><Hangup/></Response>'
  }

  res.type('text/xml').send(twiml)
}))

// Call status callbacks
router.post('/webhooks/twilio/outbound/status', asyncHandler(async (req, res) => {
  const { attemptId } = req.query as Record<string, string>
  const { CallStatus, CallDuration } = req.body as Record<string, string>

  if (attemptId && CallStatus) {
    await handleOutboundStatus(attemptId, CallStatus, CallDuration)
  }
  res.sendStatus(204)
}))

export { router as outboundWebhooksRouter }
