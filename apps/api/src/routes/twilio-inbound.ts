import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import {
  resolveInboundCall,
  buildInboundTwiml,
  logCallStart,
  logCallEnd,
  startCallRecording,
} from '../services/twilio-inbound.service.js'
import { logTwilioEvent } from '../lib/twilio-log.js'
import { handleRecordingReady, type TwilioRecordingPayload } from '../services/recording.service.js'
import { processInboundSms, updateDeliveryStatus, type InboundSmsPayload } from '../services/sms.service.js'
import { prisma } from '../lib/prisma.js'

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

    logCallStart({ tenantId: phone.tenantId, callSid: CallSid, fromNumber: From ?? '', toNumber: To }).catch(e => console.error('[twilio] logCallStart failed:', e))
    startCallRecording(CallSid, phone.tenantId, To).catch(e => console.error('[twilio] startCallRecording failed:', e))
    logTwilioEvent({ tenantId: phone.tenantId, callSid: CallSid, direction: 'INBOUND', eventType: 'inbound_received', fromNumber: From, toNumber: To, callStatus: 'ringing' }).catch(e => console.error('[twilio] logTwilioEvent failed:', e))

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
  } catch (err) {
    twiml = '<Response><Say voice="alice">We are unable to take your call right now. Please try again later.</Say><Hangup/></Response>'
    // Log error — resolve tenantId from phone number if possible
    try {
      const phone = await resolveInboundCall(To).catch(() => null)
      if (phone?.tenantId) {
        await logTwilioEvent({ tenantId: phone.tenantId, callSid: CallSid, direction: 'INBOUND', eventType: 'error', fromNumber: From, toNumber: To, errorMessage: String(err) })
      }
    } catch { /* non-fatal */ }
  }

  res.type('text/xml').send(twiml)
}))

// POST /api/webhooks/twilio/status — call status callbacks
router.post('/webhooks/twilio/status', asyncHandler(async (req, res) => {
  const { CallSid, CallStatus, CallDuration, To, From } = req.body as Record<string, string>
  if (CallSid) {
    await logCallEnd(CallSid, CallStatus ?? 'completed', CallDuration ? parseInt(CallDuration, 10) : undefined)
    // Resolve tenant from call log for event logging
    try {
      const { prisma } = await import('../lib/prisma.js')
      const log = await prisma.callLog.findFirst({ where: { providerCallId: CallSid }, select: { tenantId: true } })
      if (log) {
        await logTwilioEvent({
          tenantId: log.tenantId, callSid: CallSid, direction: 'INBOUND', eventType: 'status',
          callStatus: CallStatus, fromNumber: From, toNumber: To,
          durationSecs: CallDuration ? parseInt(CallDuration, 10) : undefined,
        })
      }
    } catch { /* non-fatal */ }
  }
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/recording — call recording ready
router.post('/webhooks/twilio/recording', asyncHandler(async (req, res) => {
  const payload = req.body as TwilioRecordingPayload
  if (payload.RecordingStatus === 'completed') {
    handleRecordingReady(payload).catch(err => console.error('[recording] upload failed:', err))
  }
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/transcription — voicemail transcription (future)
router.post('/webhooks/twilio/transcription', asyncHandler(async (_req, res) => {
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/sms — inbound SMS from any tenant number
router.post('/webhooks/twilio/sms', asyncHandler(async (req, res) => {
  const payload = req.body as InboundSmsPayload
  const { To } = payload

  // Resolve tenant from the receiving number
  if (To) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { e164Number: To },
      select: { tenantId: true },
    })
    if (phone?.tenantId) {
      processInboundSms(phone.tenantId, payload).catch(err =>
        console.error('[sms-inbound] processing failed:', err),
      )
    }
  }

  // Twilio expects a 200 TwiML response or 204 — 204 means no reply
  res.sendStatus(204)
}))

// POST /api/webhooks/twilio/sms-status — delivery status callbacks
router.post('/webhooks/twilio/sms-status', asyncHandler(async (req, res) => {
  const { MessageSid, MessageStatus, ErrorCode } = req.body as Record<string, string>
  if (MessageSid && MessageStatus) {
    updateDeliveryStatus(MessageSid, MessageStatus, ErrorCode).catch(e => console.error('[sms] updateDeliveryStatus failed:', e))
  }
  res.sendStatus(204)
}))

export { router as twilioInboundRouter }
