/**
 * User-scoped Twilio routes (`/api/me/twilio/*`).
 *
 * These are NOT tenant-scoped or partner-scoped — they answer questions
 * about ALL Twilio subaccounts the current user owns. Used by the "My
 * Twilio Numbers" page that shows a combined view of tenant + partner
 * inventories when the same person holds both.
 *
 * Phase 1 surface: read-only inventory. Phase 2 adds preflight + transfer.
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import crypto from 'node:crypto'
import { authenticate } from '../middleware/authenticate.js'
import { AppError } from '@voiceautomation/shared'
import { listMyTwilioInventory } from '../services/twilio-inventory.service.js'
import {
  previewNumberTransfer,
  transferNumber,
  type TransferTarget,
} from '../services/twilio-transfer.service.js'
import { adoptTwilioNumber } from '../services/twilio-adopt.service.js'
import { linkExistingSubaccount, type LinkTarget } from '../services/twilio-link-subaccount.service.js'

const router: IRouter = Router()
router.use('/me/twilio', authenticate)

router.get('/me/twilio/inventory', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const data = await listMyTwilioInventory(userId)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

const transferTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tenant'),  tenantId:  z.string().min(1) }),
  z.object({ kind: z.literal('partner'), partnerId: z.string().min(1) }),
])

const previewBodySchema = z.object({
  numberId: z.string().min(1),
  target:   transferTargetSchema,
})

router.post('/me/twilio/transfer/preflight', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const parsed = previewBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    }
    const data = await previewNumberTransfer(
      userId,
      parsed.data.numberId,
      parsed.data.target as TransferTarget,
    )
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

router.post('/me/twilio/transfer', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const parsed = previewBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    }
    const ipHash = hashIp(req.ip)
    const data = await transferNumber(
      userId,
      parsed.data.numberId,
      parsed.data.target as TransferTarget,
      ipHash,
    )
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

const adoptBodySchema = z.object({
  subaccountRecordId: z.string().min(1),
  twilioPhoneSid:     z.string().min(1),
})

router.post('/me/twilio/adopt-number', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const parsed = adoptBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    }
    const data = await adoptTwilioNumber(userId, parsed.data.subaccountRecordId, parsed.data.twilioPhoneSid)
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

const linkTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tenant'),  tenantId:  z.string().min(1) }),
  z.object({ kind: z.literal('partner'), partnerId: z.string().min(1) }),
])

const linkBodySchema = z.object({
  twilioSubaccountSid: z.string().min(1),
  authToken:           z.string().min(1),
  target:              linkTargetSchema,
})

router.post('/me/twilio/link-subaccount', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const parsed = linkBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 422)
    }
    const data = await linkExistingSubaccount(
      userId,
      parsed.data.twilioSubaccountSid,
      parsed.data.authToken,
      parsed.data.target as LinkTarget,
    )
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export default router
