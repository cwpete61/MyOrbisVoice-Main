/**
 * Messaging service — SMS, MMS, and WhatsApp.
 *
 * Channel routing is automatic based on the `to` prefix and presence of
 * mediaUrls:
 *   - to starts with `whatsapp:` → WHATSAPP (from must also be `whatsapp:+...`)
 *   - mediaUrls non-empty       → MMS
 *   - default                   → SMS
 *
 * Under managed Twilio every tenant has its own subaccount, so we send
 * via getSubaccountClient(tenantId). That keeps usage, billing, and
 * compliance (10DLC brand/campaign) scoped to the tenant.
 */
import { prisma } from '../lib/prisma.js'
import { getSubaccountClient } from './twilio-subaccount.service.js'
import { getEnv } from '@voiceautomation/config'
import * as optOut from './opt-out.service.js'
import type { MessageChannel } from '@prisma/client'

const STOP_KEYWORDS  = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
const START_KEYWORDS = ['START', 'YES', 'UNSTOP']

function resolveChannel(to: string, mediaUrls?: string[]): MessageChannel {
  if (to.toLowerCase().startsWith('whatsapp:')) return 'WHATSAPP'
  if (mediaUrls && mediaUrls.length > 0) return 'MMS'
  return 'SMS'
}

function isOptedOut(contact: { optedOutSms: boolean; optedOutWhatsapp: boolean }, channel: MessageChannel): boolean {
  if (channel === 'WHATSAPP') return contact.optedOutWhatsapp
  // MMS opts-out follow SMS — STOP/UNSUBSCRIBE applies to both per US carrier rules
  return contact.optedOutSms
}

export interface SendMessageOptions {
  tenantId:        string
  contactId?:      string
  conversationId?: string
  from:            string          // E.164 (or whatsapp:+E.164 for WhatsApp)
  to:              string          // E.164 (or whatsapp:+E.164 for WhatsApp)
  body:            string
  mediaUrls?:      string[]        // optional — presence implies MMS (or WhatsApp media)
  enrollmentId?:   string
}

export async function sendMessage(opts: SendMessageOptions): Promise<{ success: boolean; sid?: string; error?: string; channel: MessageChannel }> {
  const channel = resolveChannel(opts.to, opts.mediaUrls)

  // Opt-out gate (per channel)
  if (opts.contactId) {
    const contact = await prisma.contact.findUnique({
      where:  { id: opts.contactId },
      select: { optedOutSms: true, optedOutWhatsapp: true },
    })
    if (contact && isOptedOut(contact, channel)) {
      return { success: false, error: `Contact has opted out of ${channel}`, channel }
    }
  }

  let client
  try {
    client = await getSubaccountClient(opts.tenantId)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Twilio not configured'
    return { success: false, error, channel }
  }

  const env = getEnv()

  const log = await prisma.messageLog.create({
    data: {
      tenantId:       opts.tenantId,
      contactId:      opts.contactId ?? null,
      conversationId: opts.conversationId ?? null,
      enrollmentId:   opts.enrollmentId ?? null,
      channel,
      direction:      'OUTBOUND',
      sender:         opts.from,
      recipient:      opts.to,
      bodyText:       opts.body,
      mediaCount:     opts.mediaUrls?.length ?? null,
      deliveryStatus: 'queued',
    },
  })

  try {
    const msg = await client.messages.create({
      from: opts.from,
      to:   opts.to,
      body: opts.body,
      ...(opts.mediaUrls && opts.mediaUrls.length > 0 ? { mediaUrl: opts.mediaUrls } : {}),
      ...(env.TWILIO_STATUS_CALLBACK_BASE_URL && {
        statusCallback: `${env.TWILIO_STATUS_CALLBACK_BASE_URL}/api/webhooks/twilio/sms-status`,
      }),
    })

    await prisma.messageLog.update({
      where: { id: log.id },
      data:  { providerMessageId: msg.sid, deliveryStatus: msg.status, sentAt: new Date() },
    })

    return { success: true, sid: msg.sid, channel }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    await prisma.messageLog.update({
      where: { id: log.id },
      data:  { deliveryStatus: 'failed', failedAt: new Date(), errorCode: error },
    })
    return { success: false, error, channel }
  }
}

// Backwards-compat alias — older code paths called sendSms directly.
// New code should call sendMessage and pass mediaUrls / whatsapp: prefix
// to route to MMS or WhatsApp.
export async function sendSms(opts: Omit<SendMessageOptions, 'mediaUrls'>): Promise<{ success: boolean; sid?: string; error?: string }> {
  const result = await sendMessage(opts)
  return { success: result.success, ...(result.sid ? { sid: result.sid } : {}), ...(result.error ? { error: result.error } : {}) }
}

export interface InboundMessagePayload {
  MessageSid: string
  From:       string
  To:         string
  Body:       string
  NumSegments?: string
  NumMedia?:  string
  AccountSid?: string
}

// Backwards-compat alias for callers still importing the old name.
export type InboundSmsPayload = InboundMessagePayload

// Backwards-compat name kept; handles SMS, MMS, and WhatsApp inbound
export async function processInboundSms(tenantId: string, payload: InboundMessagePayload) {
  return processInboundMessage(tenantId, payload)
}

export async function processInboundMessage(tenantId: string, payload: InboundMessagePayload) {
  const numMedia    = payload.NumMedia ? parseInt(payload.NumMedia) : 0
  const channel     = resolveChannel(payload.From, numMedia > 0 ? ['_'] /* dummy to flag MMS */ : undefined)
  const bodyNorm    = (payload.Body ?? '').trim().toUpperCase()
  const isStop      = STOP_KEYWORDS.includes(bodyNorm)
  const isStart     = START_KEYWORDS.includes(bodyNorm)

  // Match contact by phone number (strip whatsapp: prefix for matching)
  const phoneToMatch = payload.From.replace(/^whatsapp:/i, '')
  const contact = await optOut.findContactByPhone(tenantId, phoneToMatch)

  await prisma.messageLog.create({
    data: {
      tenantId,
      contactId:         contact?.id ?? null,
      channel,
      direction:         'INBOUND',
      sender:            payload.From,
      recipient:         payload.To,
      bodyText:          payload.Body ?? '',
      providerMessageId: payload.MessageSid,
      deliveryStatus:    'received',
      segmentCount:      payload.NumSegments ? parseInt(payload.NumSegments) : null,
      mediaCount:        numMedia || null,
      optOutDetected:    isStop,
      sentAt:            new Date(),
      deliveredAt:       new Date(),
    },
  })

  if (contact) {
    if (isStop) {
      await optOut.processOptOut(tenantId, contact.id, channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS', 'REPLY_STOP')
    } else if (isStart) {
      await optOut.processOptIn(tenantId, contact.id, channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS', 'REPLY_START')
    }
  }

  return { isStop, isStart, contactId: contact?.id ?? null, channel }
}

export async function updateDeliveryStatus(providerMessageId: string, status: string, errorCode?: string) {
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
