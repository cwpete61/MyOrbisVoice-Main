import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as tenantService from '../services/tenant.service.js'
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

router.get('/tenants/current', async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenant(req.user!.currentTenantId!)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.patch('/tenants/current', async (req, res, next) => {
  try {
    const data = validate(tenantService.updateTenantSchema, req.body)
    const tenant = await tenantService.updateTenant(req.user!.currentTenantId!, data)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.get('/business-profile', async (req, res, next) => {
  try {
    const profile = await tenantService.getBusinessProfile(req.user!.currentTenantId!)
    res.json({ data: profile })
  } catch (err) { next(err) }
})

router.patch('/business-profile', async (req, res, next) => {
  try {
    const data = validate(tenantService.updateBusinessProfileSchema, req.body)
    const profile = await tenantService.upsertBusinessProfile(req.user!.currentTenantId!, data)
    res.json({ data: profile })
  } catch (err) { next(err) }
})

export default router
