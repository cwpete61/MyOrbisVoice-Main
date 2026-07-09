/**
 * MyOrbisAgents — Listings (Step 3). Tenant-scoped property book.
 *   POST /listings/format  → AI-format pasted text into a Fair-Housing-safe draft
 *   POST /listings         → save a confirmed listing
 *   GET  /listings         → the agent's book
 *   PATCH/DELETE /listings/:id
 */
import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import * as svc from '../services/listing.service.js'
import { enrichListing } from '../services/listing-enrichment.service.js'
import { checkEntitlement } from '../services/entitlement.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root'
      fields[key] = [...(fields[key] ?? []), issue.message]
    }
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 422, fields)
  }
  return result.data
}

const STATUS = z.enum(['ACTIVE', 'COMING_SOON', 'PENDING', 'SOLD', 'RENTED', 'POCKET', 'OFF_MARKET'])

const listingBody = z.object({
  address:      z.string().trim().min(3).max(300),
  headline:     z.string().trim().max(200).nullish(),
  priceUsd:     z.number().int().nonnegative().nullish(),
  beds:         z.number().nonnegative().nullish(),
  baths:        z.number().nonnegative().nullish(),
  sqft:         z.number().int().nonnegative().nullish(),
  propertyType: z.string().trim().max(80).nullish(),
  description:  z.string().trim().max(4000).nullish(),
  highlights:   z.array(z.string().trim().max(300)).max(12).optional(),
  status:       STATUS.optional(),
  rawText:      z.string().max(8000).nullish(),
})

router.post('/listings/format', async (req, res, next) => {
  try {
    const { rawText } = validate(z.object({ rawText: z.string().trim().min(10).max(8000) }), req.body)
    const draft = await svc.formatListing(rawText)
    if (!draft) throw new AppError('NOT_CONFIGURED', 'AI formatting unavailable — add the listing manually.', 502)
    res.json({ data: draft })
  } catch (err) { next(err) }
})

router.post('/listings', async (req, res, next) => {
  try {
    const body = validate(listingBody, req.body)
    const created = await svc.createListing(req.user!.currentTenantId!, {
      ...body,
      headline: body.headline ?? null,
      priceUsd: body.priceUsd ?? null,
      beds: body.beds ?? null,
      baths: body.baths ?? null,
      sqft: body.sqft ?? null,
      propertyType: body.propertyType ?? null,
      description: body.description ?? null,
      highlights: body.highlights ?? [],
    })
    res.status(201).json({ data: created })
  } catch (err) { next(err) }
})

router.get('/listings', async (req, res, next) => {
  try {
    const items = await svc.listListings(req.user!.currentTenantId!)
    res.json({ data: { items } })
  } catch (err) { next(err) }
})

router.patch('/listings/:id', async (req, res, next) => {
  try {
    const body = validate(listingBody.partial().extend({ isActive: z.boolean().optional() }), req.body)
    const updated = await svc.updateListing(req.user!.currentTenantId!, req.params['id']!, body)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

router.delete('/listings/:id', async (req, res, next) => {
  try {
    await svc.deleteListing(req.user!.currentTenantId!, req.params['id']!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Per-listing tracking numbers (Solo Power feature) ──────────────────────
// Gated on the `listing_tracking_numbers` entitlement so it's a real tier
// differentiator. GET the assignable pool stays open so the UI can show the
// locked/upgrade state.
async function requireTrackingEntitlement(tenantId: string): Promise<boolean> {
  return (await checkEntitlement(tenantId, 'listing_tracking_numbers')) === true
}

router.get('/listings/available-numbers', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const [numbers, entitled] = await Promise.all([
      svc.listAvailableNumbers(tenantId),
      requireTrackingEntitlement(tenantId),
    ])
    res.json({ data: { numbers, entitled } })
  } catch (err) { next(err) }
})

router.post('/listings/:id/tracking-number', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    if (!(await requireTrackingEntitlement(tenantId))) {
      throw new AppError('FORBIDDEN', 'Per-listing tracking numbers are a Solo Power feature — upgrade to enable.', 403)
    }
    const { phoneNumberId } = validate(z.object({ phoneNumberId: z.string().min(1) }), req.body)
    const number = await svc.assignTrackingNumber(tenantId, req.params['id']!, phoneNumberId)
    res.json({ data: number })
  } catch (err) { next(err) }
})

router.delete('/listings/:id/tracking-number', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { phoneNumberId } = validate(z.object({ phoneNumberId: z.string().min(1) }), req.body)
    await svc.unassignTrackingNumber(tenantId, phoneNumberId)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Listing enrichment (backlog #24) — geocode + AVM/comps, gated on the
// listing_enrichment entitlement (Solo Power). Cached on the listing; `force`
// bypasses the TTL.
router.post('/listings/:id/enrich', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    if ((await checkEntitlement(tenantId, 'listing_enrichment')) !== true) {
      throw new AppError('FORBIDDEN', 'Listing enrichment is a Solo Power feature — upgrade to enable.', 403)
    }
    const force = (req.body as { force?: boolean } | undefined)?.force === true
    const data = await enrichListing(tenantId, req.params['id']!, force)
    res.json({ data })
  } catch (err) { next(err) }
})

export default router
