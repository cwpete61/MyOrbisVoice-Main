import { Router, type IRouter } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { buildOutboundTwiml, handleOutboundStatus } from '../services/outbound.service.js'
import { getTwilioAuthToken } from '../services/twilio.service.js'
import { startCallRecording } from '../services/twilio-inbound.service.js'
import { logTwilioEvent } from '../lib/twilio-log.js'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

// Twilio calls this when the outbound call connects — return TwiML script
router.post('/webhooks/twilio/outbound/twiml', asyncHandler(async (req, res) => {
  const { attemptId, tenantId } = req.query as Record<string, string>
  const { campaignId, CallSid, To, From } = req.body as Record<string, string>

  let twiml: string
  let resolvedTenantId = tenantId ?? ''
  try {
    let cId = campaignId
    if (!cId && attemptId) {
      const attempt = await prisma.outboundCallAttempt.findUnique({
        where: { id: attemptId },
        select: { campaignId: true, tenantId: true },
      })
      cId = attempt?.campaignId ?? ''
      resolvedTenantId = attempt?.tenantId ?? resolvedTenantId
    }
    twiml = await buildOutboundTwiml(resolvedTenantId, cId ?? '', attemptId ?? '')
    if (resolvedTenantId) {
      // Start recording immediately — same pattern as inbound
      if (CallSid) startCallRecording(CallSid, resolvedTenantId).catch(() => null)
      await logTwilioEvent({
        tenantId: resolvedTenantId, callSid: CallSid, direction: 'OUTBOUND',
        eventType: 'dispatch', callStatus: 'initiated', fromNumber: From, toNumber: To,
      })
    }
  } catch {
    twiml = '<Response><Say voice="Polly.Joanna">Hello, this is a call from our team. Thank you for your time. Goodbye.</Say><Hangup/></Response>'
  }

  res.type('text/xml').send(twiml)
}))

// Call status callbacks
router.post('/webhooks/twilio/outbound/status', asyncHandler(async (req, res) => {
  const { attemptId } = req.query as Record<string, string>
  const { CallStatus, CallDuration, CallSid, To, From } = req.body as Record<string, string>

  if (attemptId && CallStatus) {
    await handleOutboundStatus(attemptId, CallStatus, CallDuration)

    const attempt = await prisma.outboundCallAttempt.findUnique({
      where: { id: attemptId },
      select: { tenantId: true },
    })
    if (attempt) {
      await logTwilioEvent({
        tenantId: attempt.tenantId, callSid: CallSid, direction: 'OUTBOUND',
        eventType: 'status', callStatus: CallStatus,
        fromNumber: From, toNumber: To,
        durationSecs: CallDuration ? parseInt(CallDuration, 10) : undefined,
      })
    }
  }
  res.sendStatus(204)
}))

// Answering machine detection callback
router.post('/webhooks/twilio/outbound/amd', asyncHandler(async (req, res) => {
  const { attemptId } = req.query as Record<string, string>
  const { AnsweredBy, CallSid, To, From } = req.body as Record<string, string>

  const isVoicemail = AnsweredBy && AnsweredBy.startsWith('machine')

  let resolvedTenantId = ''
  try {
    const attempt = await prisma.outboundCallAttempt.findUnique({
      where: { id: attemptId },
      select: { tenantId: true },
    })
    resolvedTenantId = attempt?.tenantId ?? ''
  } catch { /* non-fatal */ }

  // Always log AMD result
  if (resolvedTenantId) {
    await logTwilioEvent({
      tenantId: resolvedTenantId, callSid: CallSid, direction: 'OUTBOUND',
      eventType: 'amd', answeredBy: AnsweredBy,
      fromNumber: From, toNumber: To,
      outcomeCode: isVoicemail ? 'voicemail' : 'human',
    })
  }
  console.log(`[outbound] AMD: ${AnsweredBy} | callSid=${CallSid} | attempt=${attemptId} | tenant=${resolvedTenantId}`)

  if (isVoicemail && CallSid && resolvedTenantId) {
    try {
      const conn = await prisma.integrationConnection.findFirst({
        where: { tenantId: resolvedTenantId, provider: 'TWILIO', status: 'CONNECTED' },
        include: { twilioDetail: true },
      })
      if (conn?.twilioDetail?.accountSid) {
        const authToken = await getTwilioAuthToken(resolvedTenantId)
        if (authToken) {
          const creds = Buffer.from(`${conn.twilioDetail.accountSid}:${authToken}`).toString('base64')
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${conn.twilioDetail.accountSid}/Calls/${CallSid}.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'Status=completed',
          })
        }
      }
      if (attemptId) {
        await prisma.outboundCallAttempt.update({
          where: { id: attemptId },
          data: { status: 'FAILED', outcomeCode: 'voicemail', endedAt: new Date() },
        })
      }
    } catch (err) {
      console.error('[outbound] AMD hangup error:', err)
      if (resolvedTenantId) {
        await logTwilioEvent({
          tenantId: resolvedTenantId, callSid: CallSid, direction: 'OUTBOUND',
          eventType: 'error', errorMessage: String(err),
          metaJson: { context: 'amd_hangup' },
        })
      }
    }
  }
  res.sendStatus(204)
}))

export { router as outboundWebhooksRouter }
