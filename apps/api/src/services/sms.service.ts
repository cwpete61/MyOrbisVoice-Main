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
import { getSubaccountClient, getPartnerSubaccountClient } from './twilio-subaccount.service.js'
import { getTwilioClient } from './twilio.service.js'
import { getConfigValue } from './system-config.service.js'
import { writeAuditLog } from '../lib/audit.js'
import { getEnv } from '@voiceautomation/config'
import * as optOut from './opt-out.service.js'
import {
  deductCreditsForSend,
  refundCreditsForFailedSend,
  getPartnerFinancials,
  maybeNotifyPartnerLowCredits,
  type SmsChannel as PartnerSmsChannel,
} from './partner-sms-credits.service.js'
import { AppError } from '@voiceautomation/shared'
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
  /**
   * Phase G.2 — when set, route this send through the partner's Twilio
   * subaccount AND deduct credits from AffiliateAccount.smsCreditBalance.
   * Throws INSUFFICIENT_CREDITS (HTTP 402) if balance < channel cost.
   * If the provider send fails AFTER deduction, the deduction is refunded.
   */
  partnerId?:      string
}

/**
 * Pick a partner-credit channel from the SMS service's channel + a rough
 * segment count derived from body length (SMS body > 160 chars splits to
 * 2 segments → "SMS_LONG" at 2 credits). MMS is flat 2.5. WhatsApp reserved.
 */
function partnerChannelFor(channel: MessageChannel, body: string): PartnerSmsChannel {
  if (channel === 'WHATSAPP') return 'WHATSAPP'
  if (channel === 'MMS')      return 'MMS'
  // SMS: 1 segment = 1 credit, 2 segments = 2 credits. GSM-7 default 160 chars
  // per segment; unicode collapses to 70 — we approximate with 160 since most
  // partner SMS is plain ASCII.
  return body.length > 160 ? 'SMS_LONG' : 'SMS'
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
    client = opts.partnerId
      ? await getPartnerSubaccountClient(opts.partnerId)
      : await getSubaccountClient(opts.tenantId)
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

  // Partner-routed: deduct credits BEFORE hitting Twilio so we never send a
  // message the partner didn't pay for. If Twilio then fails, we refund.
  let partnerLedgerRowId: string | null = null
  if (opts.partnerId) {
    try {
      // Phase G.2.1 — net-budget guard. Even if the partner has credits, if
      // their lifetime real Twilio spend has consumed their lifetime pack
      // value (margin gone), block the send. Protects the platform from a
      // partner accidentally outrunning the pack's actual provider cost.
      const financials = await getPartnerFinancials(opts.partnerId)
      if (financials.status === 'OVER_BUDGET') {
        // Async — don't block the failure return on email send
        maybeNotifyPartnerLowCredits({ partnerId: opts.partnerId, reason: 'OVER_BUDGET' }).catch(() => null)
        await prisma.messageLog.update({
          where: { id: log.id },
          data:  { deliveryStatus: 'failed', failedAt: new Date(), errorCode: 'PARTNER_OVER_BUDGET' },
        })
        return {
          success: false,
          error:   'Partner SMS pack value exhausted. Top up to keep sending.',
          channel,
        }
      }

      const partnerChannel = partnerChannelFor(channel, opts.body)
      const deduction = await deductCreditsForSend({
        partnerId:    opts.partnerId,
        channel:      partnerChannel,
        messageLogId: log.id,
      })
      partnerLedgerRowId = deduction.ledgerRowId

      // After deduction succeeds, check whether THIS send dropped the partner
      // into the LOW zone and fire a (deduped) warning email.
      if (deduction.newBalance < 50 || financials.netCents < 200) {
        maybeNotifyPartnerLowCredits({
          partnerId: opts.partnerId,
          reason:    deduction.newBalance < 50 ? 'LOW_BALANCE' : 'LOW_NET',
        }).catch(() => null)
      }
    } catch (err) {
      const isInsufficient = err instanceof AppError && err.code === 'INSUFFICIENT_CREDITS'
      if (isInsufficient) {
        maybeNotifyPartnerLowCredits({ partnerId: opts.partnerId, reason: 'LOW_BALANCE' }).catch(() => null)
      }
      const error = isInsufficient ? 'Partner has no SMS credits remaining' : (err instanceof Error ? err.message : 'Credit deduction failed')
      await prisma.messageLog.update({
        where: { id: log.id },
        data:  { deliveryStatus: 'failed', failedAt: new Date(), errorCode: isInsufficient ? 'INSUFFICIENT_CREDITS' : 'CREDIT_ERROR' },
      })
      return { success: false, error, channel }
    }
  }

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
    // Refund the credit deduction since the send didn't actually go through.
    if (opts.partnerId && partnerLedgerRowId) {
      await refundCreditsForFailedSend({
        partnerId:    opts.partnerId,
        consumeRowId: partnerLedgerRowId,
        note:         `provider_send_failed: ${error}`.slice(0, 200),
      }).catch(() => null)
    }
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
  const numMedia    = payload.NumMedia ? parseInt(payload.NumMedia, 10) : 0
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
      segmentCount:      payload.NumSegments ? parseInt(payload.NumSegments, 10) : null,
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

/**
 * ── Admin-only ad-hoc test send ─────────────────────────────────────────────
 * Uses MASTER platform credentials (live or test) directly — bypasses tenant
 * subaccounts, opt-out checks, and MessageLog. Purpose: verify the code path
 * end-to-end while A2P 10DLC approval is pending.
 *
 * Mode 'test' uses Twilio Test Credentials and works with magic numbers:
 *   to=+15005550006 → success     to=+15005550001 → invalid number
 *   to=+15005550009 → cannot route to=+15005550008 → queue full
 * Reference: https://www.twilio.com/docs/iam/test-credentials
 */
export interface TestSendInput {
  to: string                        // E.164 (or whatsapp:+E.164)
  body: string
  from?: string                     // E.164 — defaults to platform phone from SystemConfig
  mode: 'live' | 'test'
  actorUserId?: string
}

export interface TestSendResult {
  ok: boolean
  mode: 'live' | 'test'
  to: string
  from: string
  messageSid: string | null
  status: string | null
  errorCode?: number | string
  errorMessage?: string
}

export async function sendTestMessage(input: TestSendInput): Promise<TestSendResult> {
  const to = input.to.trim()
  const body = input.body
  let from = input.from?.trim() ?? ''
  if (!from) {
    from = (await getConfigValue('twilio_phone_number')) ?? ''
  }

  if (!to)   return { ok: false, mode: input.mode, to, from, messageSid: null, status: 'failed', errorCode: 'INVALID_INPUT', errorMessage: 'to is required' }
  if (!body) return { ok: false, mode: input.mode, to, from, messageSid: null, status: 'failed', errorCode: 'INVALID_INPUT', errorMessage: 'body is required' }
  if (!from) return { ok: false, mode: input.mode, to, from, messageSid: null, status: 'failed', errorCode: 'INVALID_INPUT', errorMessage: 'from is required (or set platform phone in SystemConfig)' }

  try {
    const client = await getTwilioClient(input.mode)
    const msg = await client.messages.create({ to, from, body })

    await writeAuditLog({
      actorType: input.actorUserId ? 'USER' : 'SYSTEM',
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      action: 'sms.test_sent',
      targetType: 'TwilioMessage',
      targetId: msg.sid,
      metadataJson: { mode: input.mode, to, from, bodyLen: body.length, status: msg.status },
    })

    return { ok: true, mode: input.mode, to, from, messageSid: msg.sid, status: msg.status }
  } catch (err: unknown) {
    const e = err as { code?: number | string; message?: string }
    const errorCode = e.code ?? 'UNKNOWN'
    const errorMessage = e.message ?? 'Twilio send failed'

    await writeAuditLog({
      actorType: input.actorUserId ? 'USER' : 'SYSTEM',
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      action: 'sms.test_failed',
      targetType: 'TwilioMessage',
      metadataJson: { mode: input.mode, to, from, bodyLen: body.length, errorCode: String(errorCode), errorMessage },
    })

    return { ok: false, mode: input.mode, to, from, messageSid: null, status: 'failed', errorCode, errorMessage }
  }
}
