import { Router, type IRouter } from 'express'
import type { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as channelService from '../services/channel.service.js'
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

router.get('/channels', async (req, res, next) => {
  try {
    const channels = await channelService.listChannels(req.user!.currentTenantId!)
    res.json({ data: channels })
  } catch (err) { next(err) }
})

router.patch('/channels/:channelType', async (req, res, next) => {
  try {
    const data = validate(channelService.updateChannelSchema, req.body)
    const channel = await channelService.updateChannel(
      req.user!.currentTenantId!,
      req.params['channelType']!.toUpperCase(),
      data,
    )
    res.json({ data: channel })
  } catch (err) { next(err) }
})

export default router
