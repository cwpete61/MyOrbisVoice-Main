import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as promptService from '../services/prompt.service.js'
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

router.get('/prompts', async (req, res, next) => {
  try {
    const filters = validate(promptService.promptFiltersSchema, req.query)
    const prompts = await promptService.listPrompts(req.user!.currentTenantId!, filters)
    res.json({ data: prompts })
  } catch (err) { next(err) }
})

router.get('/prompts/:id', async (req, res, next) => {
  try {
    const prompt = await promptService.getPrompt(req.user!.currentTenantId!, req.params['id']!)
    res.json({ data: prompt })
  } catch (err) { next(err) }
})

router.post('/prompts', async (req, res, next) => {
  try {
    const data = validate(promptService.createPromptSchema, req.body)
    const prompt = await promptService.createPrompt(req.user!.currentTenantId!, req.user!.id, data)
    res.status(201).json({ data: prompt })
  } catch (err) { next(err) }
})

router.patch('/prompts/:id', async (req, res, next) => {
  try {
    const data = validate(promptService.updatePromptSchema, req.body)
    const prompt = await promptService.updatePrompt(req.user!.currentTenantId!, req.params['id']!, data)
    res.json({ data: prompt })
  } catch (err) { next(err) }
})

router.post('/prompts/:id/publish', async (req, res, next) => {
  try {
    const prompt = await promptService.publishPrompt(
      req.user!.currentTenantId!,
      req.params['id']!,
      req.user!.id,
    )
    res.json({ data: prompt })
  } catch (err) { next(err) }
})

export default router
