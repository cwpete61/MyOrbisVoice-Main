import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import {
  resolveInboundCall,
  buildInboundTwiml,
  logCallStart,
  logCallEnd,
} from '../services/twilio-inbound.service.js'

const router: IRouter = Router()

// POST /api/webhooks/twilio/voice — Twilio calls this when a call arrives
router.post('/webhooks/twilio/voice', asyncHandler(async (req, res) => {
  const { To, From, CallSid } = req.body as Record<string, string>

  if (!To || !CallSid) {
    res.status(400).send('<Response><Hangup/></Response>')
    return
  }

  let twiml: string
  try {
    const phone   = await resolveInboundCall(To)
    const channel = (phone as any).tenant?.channelConfigs?.[0] ?? null
    const profile = (phone as any).tenant?.businessProfile ?? null

    // Log call start (non-blocking errors)
    logCallStart({ tenantId: phone.tenantId, callSid: CallSid, fromNumber: From ?? '', toNumber: To }).catch(() => null)

    const cfg = (channel?.configJson ?? {}) as Record<string, any>
    twiml = buildInboundTwiml({
      tenantId:        phone.tenantId,
      channelConfigId: channel?.id ?? '',
      afterHoursMode:  channel?.afterHoursMode ?? null,
      greetingMode:    channel?.greetingMode ?? null,
      escalationMode:  channel?.escalationMode ?? null,
      forwardingTarget: cfg['forwardingNumber'] ?? null,
      hoursJson:       cfg['businessHours'] ?? profile?.hoursJson ?? null,
      callSid:         CallSid,
    })
  } catch {
    // Graceful fallback — never let an unhandled error leave Twilio waiting
    twiml = '<Response><Say voice="alice">We are unable to take your call right now. Please try again later.</Say><Hangup/></Response>'
  }

  res.type('text/xml').send(twiml)
}))

// POST /api/webhooks/twilio/status — call status callbacks
router.post('/webhooks/twilio/status', asyncHandler(async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body as Record<string, string>
  if (CallSid) {
    await logCallEnd(CallSid, CallStatus ?? 'completed', CallDuration ? parseInt(CallDuration) : undefined)
  }
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/recording — voicemail recording complete
router.post('/webhooks/twilio/recording', asyncHandler(async (_req, res) => {
  // TODO Phase 9: store RecordingUrl, trigger n8n voicemail workflow
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/transcription — voicemail transcription
router.post('/webhooks/twilio/transcription', asyncHandler(async (_req, res) => {
  res.sendStatus(204)
}))

export { router as twilioInboundRouter }
