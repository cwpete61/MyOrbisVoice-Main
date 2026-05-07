import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as agentService from '../services/agent.service.js'
import * as roleTemplateService from '../services/role-template.service.js'
import { AppError } from '@voiceautomation/shared'

const router: IRouter = Router()

// Platform role templates — list is auth-only (any logged-in user can
// browse), apply requires tenant context. Templates are platform-owned
// and identical for every tenant, so the list endpoint is mounted
// BEFORE the tenant-context middleware below.
router.get('/platform/role-templates', authenticate, (_req, res, next) => {
  try {
    res.json({ data: roleTemplateService.listTemplates() })
  } catch (err) { next(err) }
})

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

router.get('/agents', async (req, res, next) => {
  try {
    const agents = await agentService.listAgents(req.user!.currentTenantId!)
    res.json({ data: agents })
  } catch (err) { next(err) }
})

router.patch('/agents/:roleType', async (req, res, next) => {
  try {
    const data = validate(agentService.updateAgentSchema, req.body)
    const agent = await agentService.updateAgent(
      req.user!.currentTenantId!,
      req.params['roleType']!.toUpperCase(),
      data,
    )
    res.json({ data: agent })
  } catch (err) { next(err) }
})

const seedSchema = z.object({ templateId: z.string().min(1).max(80) })

router.post('/agents/seed-from-template', async (req, res, next) => {
  try {
    const { templateId } = validate(seedSchema, req.body)
    const result = await roleTemplateService.applyTemplate(
      req.user!.currentTenantId!,
      templateId,
      req.user!.id,
    )
    res.json({ data: result })
  } catch (err) { next(err) }
})

export default router
