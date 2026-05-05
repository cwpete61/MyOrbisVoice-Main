import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { asyncHandler } from '../lib/async-handler.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { checkEntitlement } from '../services/entitlement.service.js'
import { ensureTenantSubaccount, getSubaccountClient } from '../services/twilio-subaccount.service.js'
import { getPlatformTwilioClient } from '../services/twilio.service.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

// ──────────────────────────────────────────────────────────────────────────────
// Webhook URLs to set on each provisioned number
// ──────────────────────────────────────────────────────────────────────────────
const API_BASE = process.env['API_BASE_URL'] ?? 'https://api.myorbisvoice.com'
const VOICE_WEBHOOK_URL  = `${API_BASE}/api/webhooks/twilio/voice`
const STATUS_WEBHOOK_URL = `${API_BASE}/api/webhooks/twilio/status`
const SMS_WEBHOOK_URL    = `${API_BASE}/api/webhooks/twilio/sms`

// ──────────────────────────────────────────────────────────────────────────────
// Tier → number-search filter map.
// Returns whether the tenant's tier permits "vanity" / premium numbers
// (those with one-time setup fees > $0). Standard $1.15/mo numbers are
// available to every tier.
// ──────────────────────────────────────────────────────────────────────────────
const VANITY_ALLOWED_PLANS = new Set(['pro_monthly', 'premier_monthly', 'enterprise_monthly', 'ltd'])

async function tenantAllowsVanity(tenantId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    include: { plan: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!sub) return false
  return VANITY_ALLOWED_PLANS.has(sub.plan.code)
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/phone-numbers — list this tenant's numbers
// ──────────────────────────────────────────────────────────────────────────────
router.get('/phone-numbers', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const [numbers, maxAllowed] = await Promise.all([
    prisma.phoneNumber.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
    checkEntitlement(tenantId, 'max_phone_numbers'),
  ])
  res.json({ data: numbers, meta: { used: numbers.length, max: typeof maxAllowed === 'number' ? maxAllowed : 0 } })
}))

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/twilio/numbers/search — search Twilio's inventory
//   Query params: areaCode (3-digit), pattern (optional contains-string),
//                 country (default US), capabilities (csv: voice,sms,mms)
//   Tier-based filtering: vanity numbers (with setupFee > 0) hidden for tiers
//   that don't include them.
// ──────────────────────────────────────────────────────────────────────────────
const searchSchema = z.object({
  areaCode:     z.string().regex(/^\d{3}$/).optional(),
  pattern:      z.string().max(20).optional(),
  country:      z.string().length(2).optional().default('US'),
  capabilities: z.string().optional(),  // csv "voice,sms,mms"
  limit:        z.coerce.number().int().min(1).max(50).optional().default(20),
})

router.get('/twilio/numbers/search', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { areaCode, pattern, country, capabilities, limit } = searchSchema.parse(req.query)

  // Enforce plan cap before searching (avoids letting tenants see numbers they can't buy)
  const maxAllowed = await checkEntitlement(tenantId, 'max_phone_numbers')
  const max = typeof maxAllowed === 'number' ? maxAllowed : 0
  if (max === 0) {
    throw new AppError('FORBIDDEN', 'Your plan does not include phone numbers. Upgrade to request a number.', 403)
  }
  const currentCount = await prisma.phoneNumber.count({ where: { tenantId } })
  if (currentCount >= max) {
    throw new AppError('FORBIDDEN', `Plan limit reached: ${currentCount} of ${max} numbers used. Upgrade or release one to request another.`, 403)
  }

  // Search Twilio's master-account inventory
  const masterClient = await getPlatformTwilioClient()
  const caps = (capabilities ?? 'voice,sms').split(',').map(s => s.trim().toLowerCase())
  const searchOpts: Record<string, unknown> = { limit }
  if (areaCode) searchOpts.areaCode = parseInt(areaCode, 10)
  if (pattern)  searchOpts.contains = pattern
  if (caps.includes('voice')) searchOpts.voiceEnabled = true
  if (caps.includes('sms'))   searchOpts.smsEnabled   = true
  if (caps.includes('mms'))   searchOpts.mmsEnabled   = true

  const list = await masterClient.availablePhoneNumbers(country).local.list(searchOpts as never)

  // Filter vanity numbers if tenant tier doesn't permit them. Twilio doesn't
  // expose a setup-fee field on availablePhoneNumbers, but vanity / premium
  // numbers tend to have specific patterns (repeated digits, sequences, etc.)
  // For V1 we use Twilio's own classification: numbers in the "Local" pool
  // are standard $1.15/mo. Premium pools (TollFree, Mobile-N1) can be priced
  // higher. We're searching Local only above, so all results should be
  // standard — just preserving the hook for future when we add toll-free
  // search.
  const vanityAllowed = await tenantAllowsVanity(tenantId)
  void vanityAllowed  // unused for now; placeholder for tier-based filtering

  const results = list.map(n => ({
    phoneNumber:    n.phoneNumber,
    friendlyName:   n.friendlyName,
    locality:       n.locality ?? null,
    region:         n.region ?? null,
    capabilities:   {
      voice: n.capabilities?.voice ?? false,
      sms:   n.capabilities?.sms ?? false,
      mms:   n.capabilities?.mms ?? false,
    },
    monthlyPriceCents: 115,  // Twilio standard local: $1.15/mo
  }))

  res.json({ data: results, meta: { count: results.length } })
}))

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/twilio/numbers/purchase — buy a number + assign to subaccount
//   Body: { phoneNumber: "+16105551234", displayLabel?: "Main line" }
// ──────────────────────────────────────────────────────────────────────────────
const purchaseSchema = z.object({
  phoneNumber:  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  displayLabel: z.string().max(80).optional(),
})

router.post('/twilio/numbers/purchase', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { phoneNumber, displayLabel } = purchaseSchema.parse(req.body)

  // Enforce cap
  const maxAllowed = await checkEntitlement(tenantId, 'max_phone_numbers')
  const max = typeof maxAllowed === 'number' ? maxAllowed : 0
  const currentCount = await prisma.phoneNumber.count({ where: { tenantId } })
  if (currentCount >= max) {
    throw new AppError('FORBIDDEN', `Plan limit reached: ${currentCount} of ${max} used.`, 403)
  }

  // Conflict check (someone else's tenant already has this number — should
  // never happen but the unique constraint will catch it anyway)
  const existing = await prisma.phoneNumber.findUnique({ where: { e164Number: phoneNumber } })
  if (existing) throw new AppError('CONFLICT', 'Number already registered to another tenant', 409)

  // Provision (or fetch) the tenant's subaccount
  const sub = await ensureTenantSubaccount(tenantId)

  // Buy the number ON the master account. Twilio doesn't support direct
  // purchase-to-subaccount in one call — we buy on master, then transfer.
  const masterClient = await getPlatformTwilioClient()
  let purchased
  try {
    purchased = await masterClient.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl:        VOICE_WEBHOOK_URL,
      voiceMethod:     'POST',
      statusCallback:  STATUS_WEBHOOK_URL,
      statusCallbackMethod: 'POST',
      smsUrl:          SMS_WEBHOOK_URL,
      smsMethod:       'POST',
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('21422') || msg.includes('not available')) {
      throw new AppError('NOT_FOUND', 'That number is no longer available — search again and pick another.', 404)
    }
    throw new AppError('INTERNAL_ERROR', `Twilio purchase failed: ${msg}`, 500)
  }

  // Transfer the number from the master account to the tenant's subaccount.
  // Twilio API: update the IncomingPhoneNumber with accountSid set to the
  // subaccount SID. This moves ownership; billing follows the new owner.
  try {
    await masterClient.incomingPhoneNumbers(purchased.sid).update({
      accountSid: sub.subaccountSid,
    })
  } catch (e) {
    // If transfer fails, release the number on master so we don't bleed money.
    try { await masterClient.incomingPhoneNumbers(purchased.sid).remove() } catch {}
    throw new AppError('INTERNAL_ERROR', `Failed to transfer number to subaccount: ${(e as Error).message}`, 500)
  }

  // Record in our DB
  const dbRecord = await prisma.phoneNumber.create({
    data: {
      tenantId,
      twilioNumberSid:     purchased.sid,
      twilioSubaccountSid: sub.subaccountSid,
      e164Number:          phoneNumber,
      displayLabel:        displayLabel ?? null,
      monthlyPriceCents:   115,
      isInboundEnabled:    true,
      isOutboundEnabled:   true,
      isSmsEnabled:        true,
    },
  })

  writeAuditLogFromRequest(req, {
    actorType: 'USER',
    actorUserId: req.user!.id,
    action: 'phone_number.purchased',
    tenantId,
    targetType: 'PhoneNumber',
    targetId: dbRecord.id,
    metadataJson: { phoneNumber, twilioSid: purchased.sid, subaccountSid: sub.subaccountSid },
  }).catch(e => console.error('[audit]', e))

  res.status(201).json({ data: dbRecord })
}))

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/phone-numbers/:id — update label / forwarding / capability flags
// ──────────────────────────────────────────────────────────────────────────────
const patchSchema = z.object({
  displayLabel:      z.string().max(80).optional().nullable(),
  forwardingTarget:  z.string().max(30).optional().nullable(),
  isInboundEnabled:  z.boolean().optional(),
  isOutboundEnabled: z.boolean().optional(),
  isSmsEnabled:      z.boolean().optional(),
})

router.patch('/phone-numbers/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { id }   = req.params
  const body     = patchSchema.parse(req.body)

  const existing = await prisma.phoneNumber.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Phone number not found', 404)

  const updated = await prisma.phoneNumber.update({ where: { id }, data: body })
  res.json({ data: updated })
}))

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/phone-numbers/:id — release back to Twilio AND delete DB row
//   Real release on Twilio's side, freeing the number back to the inventory.
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/phone-numbers/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.currentTenantId!
  const { id }   = req.params

  const existing = await prisma.phoneNumber.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Phone number not found', 404)

  // Release on Twilio first. If Twilio fails we DO NOT delete the DB row —
  // better to keep state in sync so the next cleanup attempt works.
  if (existing.twilioNumberSid) {
    try {
      const subClient = await getSubaccountClient(tenantId)
      await subClient.incomingPhoneNumbers(existing.twilioNumberSid).remove()
    } catch (e) {
      const msg = (e as Error).message
      // 20404 = number not found on Twilio (already released). That's fine —
      // proceed with DB delete.
      if (!msg.includes('20404') && !msg.includes('not found')) {
        throw new AppError('INTERNAL_ERROR', `Twilio release failed: ${msg}`, 500)
      }
    }
  }

  await prisma.phoneNumber.delete({ where: { id } })

  writeAuditLogFromRequest(req, {
    actorType: 'USER',
    actorUserId: req.user!.id,
    action: 'phone_number.released',
    tenantId,
    targetType: 'PhoneNumber',
    targetId: id,
    metadataJson: { phoneNumber: existing.e164Number, twilioSid: existing.twilioNumberSid },
  }).catch(e => console.error('[audit]', e))

  res.sendStatus(204)
}))

export { router as phoneNumbersRouter }
