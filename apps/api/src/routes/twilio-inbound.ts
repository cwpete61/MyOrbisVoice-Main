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

    // Partner-owned number routing. Partner numbers are answered by the
    // platform-controlled master "Orby" agent: the PhoneNumber row already
    // points tenantId at the platform tenant, so we log partner attribution
    // for usage tracking, then fall through to the standard agent path
    // below — which builds TwiML for that platform-tenant channel (Orby).
    if (phone.partnerId) {
      logTwilioEvent({
        tenantId: phone.tenantId,
        callSid:  CallSid,
        direction: 'INBOUND',
        eventType: 'inbound_received_partner',
        fromNumber: From,
        toNumber:   To,
        callStatus: 'ringing',
        // Stash partnerId in event metadata for usage attribution
        meta: { partnerId: phone.partnerId },
      } as never).catch(e => console.error('[twilio] partner logTwilioEvent failed:', e))
    }

    logCallStart({ tenantId: phone.tenantId, callSid: CallSid, fromNumber: From ?? '', toNumber: To, partnerId: phone.partnerId }).catch(e => console.error('[twilio] logCallStart failed:', e))
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
      hoursJson:       cfg['businessHours'] ?? profile?.businessHoursJson ?? null,
      callSid:         CallSid,
      fromNumber:      From || undefined,
      partnerId:       phone.partnerId,
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
  const { CallSid, CallStatus, CallDuration, To, From, Direction } = req.body as Record<string, string>
  if (CallSid) {
    await logCallEnd(CallSid, CallStatus ?? 'completed', CallDuration ? parseInt(CallDuration, 10) : undefined)
    // Resolve tenant from call log for event logging
    try {
      const log = await prisma.callLog.findFirst({ where: { providerCallId: CallSid }, select: { tenantId: true } })
      if (log) {
        await logTwilioEvent({
          tenantId: log.tenantId, callSid: CallSid, direction: 'INBOUND', eventType: 'status',
          callStatus: CallStatus, fromNumber: From, toNumber: To,
          durationSecs: CallDuration ? parseInt(CallDuration, 10) : undefined,
        })
      }
    } catch { /* non-fatal */ }

    // Phase G.3 — partner voice-usage meter. On a completed call involving a
    // partner-owned number, rate the minutes + bill them post-paid. Inbound:
    // the partner number is `To`. Outbound: the partner number is `From`.
    if (CallStatus === 'completed' && CallDuration) {
      try {
        const isOutbound = (Direction ?? '').startsWith('outbound')
        const partnerNumberE164 = isOutbound ? From : To
        if (partnerNumberE164) {
          const pn = await prisma.phoneNumber.findFirst({
            where:  { e164Number: partnerNumberE164, partnerId: { not: null } },
            select: { id: true, partnerId: true, e164Number: true, partnerCapabilityTier: true },
          })
          if (pn?.partnerId) {
            const { recordVoiceUsage } = await import('../services/partner-voice-usage.service.js')
            await recordVoiceUsage({
              callSid:         CallSid,
              partnerId:       pn.partnerId,
              phoneNumberId:   pn.id,
              e164Number:      pn.e164Number,
              partnerTier:     pn.partnerCapabilityTier,
              direction:       isOutbound ? 'OUTBOUND' : 'INBOUND',
              durationSeconds: parseInt(CallDuration, 10),
            })
          }
        }
      } catch (e) {
        console.error('[voice-usage] meter failed:', (e as Error).message)
      }
    }
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

// POST /api/webhooks/twilio/sms-status — delivery status callbacks.
//
// Twilio's status webhook fires multiple times per message (queued → sent →
// delivered). The final terminal status callback (delivered / failed /
// undelivered) carries a `Price` field (always negative in Twilio's API —
// e.g. "-0.0079") + a `PriceUnit` field. We capture that and persist it on
// the matching PartnerSmsCreditLedger CONSUME row so we can compute net
// pack profitability per partner.
router.post('/webhooks/twilio/sms-status', asyncHandler(async (req, res) => {
  const body = req.body as Record<string, string>
  const { MessageSid, MessageStatus, ErrorCode, Price, PriceUnit } = body
  if (MessageSid && MessageStatus) {
    updateDeliveryStatus(MessageSid, MessageStatus, ErrorCode).catch(e => console.error('[sms] updateDeliveryStatus failed:', e))

    // Capture actual Twilio cost when the message reaches a terminal status
    // that carries Price. Negative Price (e.g. "-0.0079") means it cost us;
    // the magnitude is what we record. PriceUnit is the currency code (USD).
    if (Price && (PriceUnit === 'USD' || !PriceUnit)) {
      const usd = Math.abs(parseFloat(Price))
      if (Number.isFinite(usd) && usd > 0) {
        const { recordTwilioCostForMessage } = await import('../services/partner-sms-credits.service.js')
        recordTwilioCostForMessage(MessageSid, usd).catch(e => console.error('[sms] recordTwilioCost failed:', e))
      }
    }
  }
  res.sendStatus(204)
}))

export { router as twilioInboundRouter }
