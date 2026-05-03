import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { getSubaccountClient } from './twilio-subaccount.service.js'
import { sendGmailEmail } from './google.service.js'
import { getEnv } from '@voiceautomation/config'

const GW_WS_BASE = process.env['GATEWAY_WS_URL'] ?? 'wss://gateway.myorbisvoice.com'

// Managed Twilio: every tenant has a subaccount under the platform master.
// Outbound calls dial from the subaccount so usage and recordings are
// isolated per tenant.
async function getTwilioClient(tenantId: string): Promise<{ client: ReturnType<typeof twilio>; accountSid: string }> {
  const client = await getSubaccountClient(tenantId)
  // getSubaccountClient already provisions the subaccount and returns a Twilio
  // instance bound to it. The accountSid is the subaccount sid; we look it up
  // for status callbacks and logging.
  const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { tenantId } })
  if (!sub) throw new Error('Twilio subaccount not provisioned for tenant')
  return { client, accountSid: sub.twilioSubaccountSid }
}

async function getFromNumber(tenantId: string): Promise<string | null> {
  const phone = await prisma.phoneNumber.findFirst({
    where: { tenantId, isOutboundEnabled: true },
  })
  return phone?.e164Number ?? null
}

export async function dispatchPendingCalls(tenantId: string, campaignId: string) {
  const env = getEnv()
  const pending = await prisma.outboundCallAttempt.findMany({
    where: { campaignId, tenantId, status: 'PENDING' },
    include: { contact: true },
    take: 20,
  })
  if (pending.length === 0) return

  const { client } = await getTwilioClient(tenantId)
  const fromNumber  = await getFromNumber(tenantId)
  if (!fromNumber) throw new Error('No outbound-enabled phone number configured')

  for (const attempt of pending) {
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
      await prisma.outboundCallAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', outcomeCode: 'dispatch_error', endedAt: new Date() },
      })
    }
  }
}

export async function buildOutboundTwiml(tenantId: string, campaignId: string, attemptId: string): Promise<string> {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response      = new VoiceResponse()

  const connect = response.connect()
  const stream  = connect.stream({ url: `${GW_WS_BASE}/ws/outbound` })
  stream.parameter({ name: 'tenantId',   value: tenantId })
  stream.parameter({ name: 'campaignId', value: campaignId })
  stream.parameter({ name: 'attemptId',  value: attemptId })

  return response.toString()
}

export async function handleOutboundStatus(attemptId: string, callStatus: string, callDuration?: string) {
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
  const attempt = await prisma.outboundCallAttempt.findUnique({ where: { id: attemptId } })
  if (!attempt) return

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
