import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { getSubaccountClient } from './twilio-subaccount.service.js'
import { getPlatformTwilioClient } from './twilio.service.js'
import { sendGmailEmail } from './google.service.js'
import { streamAuthParams } from './twilio-inbound.service.js'
import { getEnv } from '@voiceautomation/config'

const GW_WS_BASE = process.env['GATEWAY_WS_URL'] ?? 'wss://gateway.myorbisvoice.com'

// Phone numbers can live on either the master Twilio account (twilioSubaccountSid
// null) or on the tenant's subaccount. Outbound calls must be initiated by
// whichever account owns the number — Twilio rejects with error 21210 otherwise.
// This helper picks the right client based on the number's ownership.
async function getTwilioClientForPhone(phone: { tenantId: string; twilioSubaccountSid: string | null }): Promise<ReturnType<typeof twilio>> {
  if (phone.twilioSubaccountSid) {
    return getSubaccountClient(phone.tenantId)
  }
  return getPlatformTwilioClient()
}

async function getOutboundPhoneRecord(tenantId: string) {
  return prisma.phoneNumber.findFirst({
    where: { tenantId, isOutboundEnabled: true },
    select: { id: true, e164Number: true, tenantId: true, twilioSubaccountSid: true },
  })
}

export async function dispatchPendingCalls(tenantId: string, campaignId: string) {
  const env = getEnv()
  const pending = await prisma.outboundCallAttempt.findMany({
    where: { campaignId, tenantId, status: 'PENDING' },
    include: { contact: true },
    take: 20,
  })
  if (pending.length === 0) return

  const phoneRecord = await getOutboundPhoneRecord(tenantId)
  if (!phoneRecord) throw new Error('No outbound-enabled phone number configured')
  const fromNumber = phoneRecord.e164Number
  const client = await getTwilioClientForPhone(phoneRecord)

  for (const attempt of pending) {
    // Compliance gate — never auto-dial a contact who has opted out of voice.
    // This is the single chokepoint for every outbound call the platform
    // places, so the check here covers all voice campaigns. Set true when a
    // customer says STOP on a prior call, and on every scraped lead promoted
    // into the CRM (born voice-opted-out — cold email only).
    if (attempt.contact.optedOutVoice) {
      await prisma.outboundCallAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', outcomeCode: 'opted_out_voice', startedAt: new Date(), endedAt: new Date() },
      })
      continue
    }

    const toNumber = attempt.contact.phoneE164
    if (!toNumber) {
      await prisma.outboundCallAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', outcomeCode: 'no_phone', startedAt: new Date(), endedAt: new Date() },
      })
      continue
    }

    try {
      const call = await client.calls.create({
        to:             toNumber,
        from:           fromNumber,
        url:            `${env.API_BASE_URL}/api/webhooks/twilio/outbound/twiml?attemptId=${attempt.id}&tenantId=${tenantId}`,
        statusCallback: `${env.API_BASE_URL}/api/webhooks/twilio/outbound/status?attemptId=${attempt.id}`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent:  ['initiated', 'ringing', 'answered', 'completed'],
        machineDetection:     'DetectMessageEnd',
        asyncAmd:             'true',
        asyncAmdStatusCallback: `${env.API_BASE_URL}/api/webhooks/twilio/outbound/amd?attemptId=${attempt.id}`,
        timeLimit:            300, // 5 minute hard cap
      })

      await prisma.outboundCallAttempt.update({
        where: { id: attempt.id },
        data: { status: 'DIALING', providerCallId: call.sid, startedAt: new Date() },
      })
    } catch (err) {
      const e = err as { code?: number | string; message?: string; moreInfo?: string }
      const errMsg = `${e.code ?? 'UNKNOWN'}: ${e.message ?? 'unknown error'}`
      console.error(`[outbound] dispatch failed for attempt=${attempt.id}: ${errMsg}`)
      await prisma.outboundCallAttempt.update({
        where: { id: attempt.id },
        data:  { status: 'FAILED', outcomeCode: `dispatch_error: ${errMsg}`.slice(0, 200), endedAt: new Date() },
      })
    }
  }
}

export async function buildOutboundTwiml(
  tenantId: string,
  campaignId: string,
  attemptId: string,
  partnerId?: string | null,
): Promise<string> {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response      = new VoiceResponse()

  const connect = response.connect()
  const stream  = connect.stream({ url: `${GW_WS_BASE}/ws/outbound` })
  stream.parameter({ name: 'tenantId',   value: tenantId })
  const auth = streamAuthParams(tenantId)
  if (auth) {
    stream.parameter({ name: 'authExp', value: auth.authExp })
    stream.parameter({ name: 'authSig', value: auth.authSig })
  }
  stream.parameter({ name: 'campaignId', value: campaignId })
  stream.parameter({ name: 'attemptId',  value: attemptId })
  // Partner-owned from-number → thread partnerId so the gateway tags the
  // conversation to the partner (mirrors the inbound path). Empty when the
  // call rides a tenant/platform number.
  if (partnerId) stream.parameter({ name: 'partnerId', value: partnerId })

  return response.toString()
}

export async function handleOutboundStatus(attemptId: string, callStatus: string, _callDuration?: string) {
  const outcomeMap: Record<string, string> = {
    completed:  'answered',
    busy:       'busy',
    'no-answer': 'no_answer',
    failed:     'failed',
    canceled:   'canceled',
  }

  const isFinal = ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)
  if (!isFinal) return

  const outcomeCode = outcomeMap[callStatus] ?? callStatus
  await prisma.outboundCallAttempt.updateMany({
    where: { id: attemptId },
    data: {
      status:      outcomeCode === 'answered' ? 'COMPLETED' : 'FAILED',
      outcomeCode,
      endedAt:     new Date(),
    },
  })

  // Check if campaign is now fully complete
  const attempt = await prisma.outboundCallAttempt.findUnique({
    where: { id: attemptId },
    include: { enrollment: { include: { campaign: true } } },
  })
  if (!attempt) return

  // Propagate the call outcome back to the tag-driven CampaignEnrollment
  // (if this attempt was created by the campaign scheduler's voice bridge).
  if (attempt.enrollmentId && attempt.enrollment) {
    await propagateAttemptOutcomeToEnrollment(attempt.enrollment, outcomeCode)
  }

  // Best-effort: when an outbound call doesn't connect, send a "we tried
  // to reach you" follow-up email from the tenant's Gmail. Skip if the
  // contact has no email or has opted out.
  if (['busy', 'no_answer', 'failed'].includes(outcomeCode)) {
    sendMissedCallEmail(attempt.tenantId, attempt.contactId, attempt.campaignId)
      .catch(err => console.warn('[outbound] missed-call email failed:', (err as Error).message))
  }

  const remaining = await prisma.outboundCallAttempt.count({
    where: { campaignId: attempt.campaignId, status: { in: ['PENDING', 'DIALING'] } },
  })
  if (remaining === 0) {
    await prisma.outboundCampaign.updateMany({
      where: { id: attempt.campaignId, status: 'RUNNING' },
      data:  { status: 'COMPLETED' },
    })
  }
}

async function sendMissedCallEmail(tenantId: string, contactId: string | null, campaignId: string) {
  if (!contactId) return
  const [contact, tenant, profile, campaign] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: contactId },
      select: { firstName: true, lastName: true, email: true, optedOutEmail: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { displayName: true } }),
    prisma.businessProfile.findUnique({ where: { tenantId }, select: { brandName: true, fallbackNotificationEmail: true } }),
    prisma.outboundCampaign.findUnique({ where: { id: campaignId }, select: { name: true, description: true } }),
  ])
  if (!contact?.email)        return
  if (contact.optedOutEmail)  return

  const businessName = profile?.brandName || tenant?.displayName || 'our team'
  const name         = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  const greeting     = name ? `Hi ${name},` : 'Hi,'
  const reason       = campaign?.description ? campaign.description.split(/[.!?]/)[0] : 'follow up'

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#222">
      <p style="margin:0 0 12px">${greeting}</p>
      <p style="margin:0 0 16px">We tried to reach you by phone today to ${reason} but didn't catch you. No worries — here's how to connect when it's a good time:</p>
      ${profile?.fallbackNotificationEmail ? `<p style="margin:0 0 16px"><strong>Or reply here:</strong> ${profile.fallbackNotificationEmail}</p>` : ''}
      <p style="margin:16px 0 0;color:#666;font-size:14px">Looking forward to chatting,<br>${businessName}</p>
    </div>
  `.trim()

  await sendGmailEmail(tenantId, {
    to:      contact.email,
    subject: `We tried to reach you — ${businessName}`,
    body:    html,
    isHtml:  true,
  })
}

/**
 * Bridges an outbound-call outcome back to the tag-driven CampaignEnrollment
 * that triggered the call. Honours the source Campaign's maxRetries — if the
 * call didn't connect and retries remain, the enrollment goes back to PENDING
 * with scheduledCallAt set to now + retryIntervalHours.
 */
async function propagateAttemptOutcomeToEnrollment(
  enrollment: {
    id: string
    attemptCount: number
    campaign: { maxRetries: number; retryIntervalHours: number }
  },
  outcomeCode: string,
): Promise<void> {
  const isAnswered = outcomeCode === 'answered'

  if (isAnswered) {
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
    return
  }

  // Failure path — retry if attempts remain, else FAILED.
  // attemptCount was already incremented by the scheduler at claim time.
  if (enrollment.attemptCount >= enrollment.campaign.maxRetries) {
    await prisma.campaignEnrollment.update({
      where: { id: enrollment.id },
      data:  {
        status:     'FAILED',
        exitReason: `voice call ${outcomeCode}; max retries reached`,
        completedAt: new Date(),
      },
    })
    return
  }

  const retryAt = new Date(Date.now() + enrollment.campaign.retryIntervalHours * 60 * 60 * 1000)
  await prisma.campaignEnrollment.update({
    where: { id: enrollment.id },
    data:  { status: 'PENDING', scheduledCallAt: retryAt },
  })
}

// ── Inbound Evaluation: bridged test call ───────────────────────────────────
// Rings the partner's phone, then bridges to the business number so the partner
// hears the business's REAL inbound handling (speed to answer, greeting, lead
// capture, after-hours) exactly as a customer would — then scores it on the eval
// scorecard. Caller ID is a platform outbound number. Partner-initiated; the
// business has consented to the evaluation (see the Instructions tab). Returns
// the parent (partner-leg) call SID.
function normalizeEvalE164(s: string): string | null {
  const d = (s ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return (s ?? '').startsWith('+') ? s : '+' + d
}

export async function placeEvalTestCall(opts: {
  partnerId: string; businessPhone: string; callbackPhone: string
}): Promise<{ callSid: string; from: string; to: string; business: string }> {
  const env = getEnv()
  const biz = normalizeEvalE164(opts.businessPhone)
  const cb  = normalizeEvalE164(opts.callbackPhone)
  if (!biz) throw new Error('Invalid business phone number')
  if (!cb)  throw new Error('Invalid callback phone number')

  const fromRecord = await prisma.phoneNumber.findFirst({
    where:  { isOutboundEnabled: true, twilioSubaccountSid: null },
    select: { e164Number: true },
  })
  if (!fromRecord) throw new Error('No platform outbound number configured for test calls')
  const from = fromRecord.e164Number
  const client = await getPlatformTwilioClient()

  const call = await client.calls.create({
    to:        cb,
    from,
    url:       `${env.API_BASE_URL}/api/webhooks/twilio/eval-testcall/twiml?biz=${encodeURIComponent(biz)}`,
    timeLimit: 600, // 10-minute hard cap
  })
  return { callSid: call.sid, from, to: cb, business: biz }
}
