import twilio from 'twilio'
import { prisma } from '../lib/prisma.js'
import { getEnv } from '@voiceautomation/config'
import * as optOut from './opt-out.service.js'

const STOP_KEYWORDS  = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
const START_KEYWORDS = ['START', 'YES', 'UNSTOP']

function getTwilioClient() {
  const env = getEnv()
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
}

export interface SendSmsOptions {
  tenantId: string
  contactId?: string
  conversationId?: string
  from: string          // E.164 tenant Twilio number
  to: string            // E.164 recipient number
  body: string
  enrollmentId?: string
}

export async function sendSms(opts: SendSmsOptions): Promise<{ success: boolean; sid?: string; error?: string }> {
  // Opt-out gate
  if (opts.contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: opts.contactId }, select: { optedOutSms: true } })
    if (contact?.optedOutSms) {
      return { success: false, error: 'Contact has opted out of SMS' }
    }
  }

  const client = getTwilioClient()
  if (!client) return { success: false, error: 'Twilio not configured' }

  const env = getEnv()

  // Create MessageLog record immediately (queued state)
  const log = await prisma.messageLog.create({
    data: {
      tenantId:      opts.tenantId,
      contactId:     opts.contactId ?? null,
      conversationId: opts.conversationId ?? null,
      enrollmentId:  opts.enrollmentId ?? null,
      channel:       'SMS',
      direction:     'OUTBOUND',
      sender:        opts.from,
      recipient:     opts.to,
      bodyText:      opts.body,
      deliveryStatus: 'queued',
    },
  })

  try {
    const msg = await client.messages.create({
      from: opts.from,
      to:   opts.to,
      body: opts.body,
      ...(env.TWILIO_STATUS_CALLBACK_BASE_URL && {
        statusCallback: `${env.TWILIO_STATUS_CALLBACK_BASE_URL}/api/webhooks/twilio/sms-status`,
      }),
    })

    await prisma.messageLog.update({
      where: { id: log.id },
      data:  { providerMessageId: msg.sid, deliveryStatus: msg.status, sentAt: new Date() },
    })

    return { success: true, sid: msg.sid }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    await prisma.messageLog.update({
      where: { id: log.id },
      data:  { deliveryStatus: 'failed', failedAt: new Date(), errorCode: error },
    })
    return { success: false, error }
  }
}

export interface InboundSmsPayload {
  MessageSid: string
  From: string
  To: string
  Body: string
  NumSegments?: string
  AccountSid?: string
}

export async function processInboundSms(
  tenantId: string,
  payload: InboundSmsPayload,
) {
  const bodyNorm = payload.Body.trim().toUpperCase()
  const isStop   = STOP_KEYWORDS.includes(bodyNorm)
  const isStart  = START_KEYWORDS.includes(bodyNorm)

  // Match contact by phone number
  const contact = await optOut.findContactByPhone(tenantId, payload.From)

  // Store the inbound message
  await prisma.messageLog.create({
    data: {
      tenantId,
      contactId:        contact?.id ?? null,
      channel:          'SMS',
      direction:        'INBOUND',
      sender:           payload.From,
      recipient:        payload.To,
      bodyText:         payload.Body,
      providerMessageId: payload.MessageSid,
      deliveryStatus:   'received',
      segmentCount:     payload.NumSegments ? parseInt(payload.NumSegments) : null,
      optOutDetected:   isStop,
      sentAt:           new Date(),
      deliveredAt:      new Date(),
    },
  })

  // Handle opt-out / opt-in
  if (contact) {
    if (isStop) {
      await optOut.processOptOut(tenantId, contact.id, 'SMS', 'REPLY_STOP')
    } else if (isStart) {
      await optOut.processOptIn(tenantId, contact.id, 'SMS', 'REPLY_START')
    }
  }

  return { isStop, isStart, contactId: contact?.id ?? null }
}

export async function updateDeliveryStatus(
  providerMessageId: string,
  status: string,
  errorCode?: string,
) {
  const log = await prisma.messageLog.findFirst({ where: { providerMessageId } })
  if (!log) return

  const data: Record<string, unknown> = { deliveryStatus: status }
  if (status === 'delivered') data['deliveredAt'] = new Date()
  if (status === 'failed' || status === 'undelivered') {
    data['failedAt']  = new Date()
    data['errorCode'] = errorCode ?? null
  }

  await prisma.messageLog.update({ where: { id: log.id }, data })
}
