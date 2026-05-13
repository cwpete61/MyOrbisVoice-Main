/**
 * ESP webhook handlers (Phase F.4).
 *
 * Normalizes Postmark + Resend webhook payloads into a single internal shape,
 * records the event on MessageLog, and pushes hard bounces / complaints onto
 * the suppression list automatically.
 *
 * Signature verification is provider-specific and lives at the route layer
 * (so the service is provider-agnostic and trivially unit-testable). The
 * routes pass already-verified payloads in here.
 *
 * Idempotency: webhooks can fire more than once. We look up the existing
 * MessageLog row by providerMessageId and update it; suppression adds are
 * idempotent by construction (addSuppression checks existing first).
 */
import { prisma } from '../lib/prisma.js'
import { addSuppression } from './email-suppression.service.js'
import { evaluatePartnerReputation } from './email-bulk-policy.service.js'

export type EmailEvent =
  | { kind: 'bounce';      bounceType: 'hard' | 'soft'; reason?: string }
  | { kind: 'complaint';   reason?: string }
  | { kind: 'unsubscribe'; reason?: string }
  | { kind: 'delivered' }

export type IngestOpts = {
  providerMessageId: string  // ESP's message id, e.g. Postmark MessageID, Resend id
  recipient:         string  // email address
  event:             EmailEvent
}

export async function ingestEmailEvent(opts: IngestOpts): Promise<{ ok: boolean; messageLogId?: string }> {
  const recipient = opts.recipient.trim().toLowerCase()
  if (!recipient || !opts.providerMessageId) return { ok: false }

  // Find the existing MessageLog row by providerMessageId so we can attach
  // bounce/complaint metadata to the original send and pick up tenant+partner
  // scope for the suppression entry.
  const log = await prisma.messageLog.findFirst({
    where:  { providerMessageId: opts.providerMessageId },
    select: { id: true, tenantId: true, partnerId: true, recipient: true },
  })

  // Update or fall through to event-only logging. Even if we can't find the
  // original send (maybe it predates ESP migration), we still suppress.
  if (log) {
    const data: Record<string, unknown> = {}
    if (opts.event.kind === 'bounce') {
      data['bouncedAt']      = new Date()
      data['bounceType']     = opts.event.bounceType
      data['bounceReason']   = opts.event.reason ?? null
      data['deliveryStatus'] = `bounced_${opts.event.bounceType}`
      data['failedAt']       = new Date()
    } else if (opts.event.kind === 'complaint') {
      data['complainedAt']   = new Date()
      data['deliveryStatus'] = 'complained'
    } else if (opts.event.kind === 'delivered') {
      data['deliveredAt']    = new Date()
      data['deliveryStatus'] = 'delivered'
    }
    if (Object.keys(data).length > 0) {
      await prisma.messageLog.update({ where: { id: log.id }, data })
    }
  }

  // Suppress + reputation evaluation on bounce/complaint/unsubscribe.
  if (opts.event.kind === 'unsubscribe') {
    // Unsubscribe is recoverable + recipient-specific to the partner whose
    // content they unsubscribed from. Scope partner if known, else tenant.
    await addSuppression({
      email:     recipient,
      reason:    'UNSUBSCRIBE',
      partnerId: log?.partnerId ?? null,
      tenantId:  log?.partnerId ? null : (log?.tenantId ?? null),
      note:      opts.event.reason ?? 'esp_unsubscribe',
    })
  } else if (opts.event.kind === 'bounce' && opts.event.bounceType === 'hard') {
    // Hard bounce: add to GLOBAL suppression (any partner/tenant retrying
    // this address would just re-bounce). The most conservative + cleanest
    // approach. Soft bounces stay scoped or are ignored until repeated.
    await addSuppression({
      email:    recipient,
      reason:   'HARD_BOUNCE',
      note:     opts.event.reason ?? 'esp_hard_bounce',
    })
  } else if (opts.event.kind === 'complaint') {
    // Complaint: add to PARTNER scope when we know the partner — different
    // partners have different value props, so a complaint about partner A's
    // content shouldn't block partner B from emailing the same address.
    // When we don't know the partner, fall back to tenant scope, else global.
    await addSuppression({
      email:     recipient,
      reason:    'COMPLAINT',
      partnerId: log?.partnerId ?? null,
      tenantId:  log?.partnerId ? null : (log?.tenantId ?? null),
      note:      opts.event.reason ?? 'esp_complaint',
    })
  }

  // Re-evaluate the partner's reputation rolling window — may trigger
  // auto-suspend or a warning notification.
  if (log?.partnerId && (opts.event.kind === 'bounce' || opts.event.kind === 'complaint')) {
    await evaluatePartnerReputation(log.partnerId).catch(err => {
      console.warn('[email-webhook] reputation check failed:', (err as Error).message)
    })
  }

  return { ok: true, messageLogId: log?.id }
}
