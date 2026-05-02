import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as dnaService from '../services/business-dna.service.js'
import { AppError } from '@voiceautomation/shared'

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

router.get('/business-dna', async (req, res, next) => {
  try {
    const [active, versions] = await Promise.all([
      dnaService.getActiveDNA(req.user!.currentTenantId!),
      dnaService.getDNAList(req.user!.currentTenantId!),
    ])
    res.json({ data: { active, versions } })
  } catch (err) { next(err) }
})

router.get('/business-dna/:id', async (req, res, next) => {
  try {
    const dna = await dnaService.getDNA(req.user!.currentTenantId!, req.params['id']!)
    res.json({ data: dna })
  } catch (err) { next(err) }
})

const dnaBodySchema = z.object({}).passthrough()

router.post('/business-dna', async (req, res, next) => {
  try {
    const body = validate(dnaBodySchema, req.body)
    const dna = await dnaService.createDNADraft(req.user!.currentTenantId!, body)
    res.status(201).json({ data: dna })
  } catch (err) { next(err) }
})

router.patch('/business-dna/:id', async (req, res, next) => {
  try {
    const body = validate(dnaBodySchema, req.body)
    const dna = await dnaService.updateDNADraft(req.user!.currentTenantId!, req.params['id']!, body)
    res.json({ data: dna })
  } catch (err) { next(err) }
})

router.post('/business-dna/:id/publish', async (req, res, next) => {
  try {
    const dna = await dnaService.publishDNA(
      req.user!.currentTenantId!,
      req.params['id']!,
      req.user!.id,
    )
    res.json({ data: dna })
  } catch (err) { next(err) }
})

export default router
