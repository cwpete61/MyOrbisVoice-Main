/**
 * Bulk Email sending-domain routes — partner-scoped. A partner provisions a
 * dedicated cold-email domain: check a name, pay, and the platform registers
 * it (Route 53), hosts DNS (Cloudflare), and verifies it for sending (SES).
 *
 * Mounted under /api, gated by requirePartnerContext (sets partnerAccountId).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import * as sendingDomain from '../services/sending-domain.service.js'
import {
  chargePartnerForSendingDomain,
  createPartnerSetupSession,
} from '../services/partner-billing.service.js'

const router: IRouter = Router()
router.use('/partner', authenticate, requirePartnerContext)

function partnerId(req: Request): string {
  return (req as Request & { partnerAccountId: string }).partnerAccountId
}

// Sending domains are locked to a fixed prefix + exactly 6 digits, for
// cross-partner continuity: no-reply-myorbisvoice-NNNNNN.com
const domainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^no-reply-myorbisvoice-\d{6}\.com$/, 'Domain must be no-reply-myorbisvoice-NNNNNN.com (exactly 6 digits)'),
})

/** Current sending domain for the partner (null if none). */
router.get('/partner/sending-domain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = await sendingDomain.getPartnerSendingDomain(partnerId(req))
    res.json({ data: { domain } })
  } catch (err) { next(err) }
})

/** Check whether a .com is available and what it costs. */
router.post('/partner/sending-domain/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = domainSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid domain', 422)
    }
    const result = await sendingDomain.checkAvailability(parsed.data.domain)
    res.json({ data: result })
  } catch (err) { next(err) }
})

/** Create the draft + charge the partner's card. Returns NEEDS_CARD when the
 *  partner has no card on file — the wizard then runs the card-setup flow. */
router.post('/partner/sending-domain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = domainSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid domain', 422)
    }
    const pid = partnerId(req)
    const { domain } = parsed.data

    const avail = await sendingDomain.checkAvailability(domain)
    if (!avail.available) throw new AppError('CONFLICT', 'That domain is not available to register', 409)
    if (avail.priceUsd == null) throw new AppError('INTERNAL_ERROR', 'Could not determine the domain price', 500)
    const amountCents = Math.ceil(avail.priceUsd * 100)

    const draft = await sendingDomain.createSendingDomainDraft(pid, domain)

    const charge = await chargePartnerForSendingDomain(pid, domain, amountCents)
    if ('needsCard' in charge) {
      res.json({ data: { status: 'NEEDS_CARD', domainId: draft.id, domain, priceUsd: avail.priceUsd } })
      return
    }
    const updated = await sendingDomain.markPaid(draft.id, charge.paymentIntentId, amountCents)
    res.json({ data: { status: updated.status, domain: updated } })
  } catch (err) { next(err) }
})

/** Retry the charge for an existing unpaid draft (after the partner adds a card). */
router.post('/partner/sending-domain/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const draft = await sendingDomain.getPartnerSendingDomain(pid)
    if (!draft || draft.status !== 'PENDING_PAYMENT') {
      throw new AppError('CONFLICT', 'No unpaid sending domain to pay for', 409)
    }
    const avail = await sendingDomain.checkAvailability(draft.domain)
    if (!avail.available) throw new AppError('CONFLICT', 'That domain is no longer available', 409)
    if (avail.priceUsd == null) throw new AppError('INTERNAL_ERROR', 'Could not determine the domain price', 500)
    const amountCents = Math.ceil(avail.priceUsd * 100)

    const charge = await chargePartnerForSendingDomain(pid, draft.domain, amountCents)
    if ('needsCard' in charge) {
      throw new AppError('PAYMENT_REQUIRED', 'No card on file — add a payment method first', 402)
    }
    const updated = await sendingDomain.markPaid(draft.id, charge.paymentIntentId, amountCents)
    res.json({ data: { status: updated.status, domain: updated } })
  } catch (err) { next(err) }
})

/** Stripe-hosted setup session so a partner with no card can add one. */
router.post('/partner/sending-domain/card-setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({ returnUrl: z.string().url(), cancelUrl: z.string().url() })
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const session = await createPartnerSetupSession(partnerId(req), parsed.data)
    res.json({ data: session })
  } catch (err) { next(err) }
})

/** Abandon an unpaid draft so the partner can start over with another name. */
router.delete('/partner/sending-domain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await sendingDomain.cancelSendingDomainDraft(partnerId(req))
    res.json({ data: { cancelled: true } })
  } catch (err) { next(err) }
})

export default router
