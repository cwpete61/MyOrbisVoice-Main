import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { getTwilioAuthToken } from './twilio.service.js'
import { getEnv } from '@voiceautomation/config'

async function getTwilioClient(tenantId: string) {
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO', status: 'CONNECTED' },
    include: { twilioDetail: true },
  })
  if (!conn?.twilioDetail?.accountSid) throw new Error('Twilio not connected for tenant')
  const authToken = await getTwilioAuthToken(tenantId)
  if (!authToken) throw new Error('Could not decrypt Twilio auth token')
  return { client: twilio(conn.twilioDetail.accountSid, authToken), accountSid: conn.twilioDetail.accountSid }
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

export async function buildOutboundTwiml(tenantId: string, campaignId: string): Promise<string> {
  const campaign = await prisma.outboundCampaign.findFirst({
    where: { id: campaignId, tenantId },
  })

  const agentName = 'Alex'
  const businessName = 'our team'

  // Try to get business profile for personalisation
  try {
    const profile = await prisma.businessProfile.findFirst({ where: { tenantId } })
    if (profile?.brandName) {
      return `<Response>
  <Say voice="Polly.Joanna">Hi, this is ${agentName} calling from ${profile.brandName}. ${campaign?.description ?? 'We are reaching out to connect with you.'} Please stay on the line.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Thank you for your time. We will follow up shortly. Goodbye.</Say>
  <Hangup/>
</Response>`
    }
  } catch { /* fall through */ }

  return `<Response>
  <Say voice="Polly.Joanna">Hi, this is ${agentName} calling from ${businessName}. We are reaching out to connect with you. Please stay on the line.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Thank you for your time. We will follow up shortly. Goodbye.</Say>
  <Hangup/>
</Response>`
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
