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

const STATUS = z.enum(['ACTIVE', 'COMING_SOON', 'PENDING', 'SOLD', 'POCKET', 'OFF_MARKET'])

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

export default router
