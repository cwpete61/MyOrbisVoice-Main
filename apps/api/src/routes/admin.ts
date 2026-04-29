import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as adminService from '../services/admin.service.js'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'
import { prisma } from '../lib/prisma.js'
import * as systemConfig from '../services/system-config.service.js'
import { writeAuditLog } from '../lib/audit.js'

const router: IRouter = Router()
router.use(authenticate, requirePlatformAdmin)

router.get('/platform/status', async (_req, res, next) => {
  try {
    const env = getEnv()
    const [tenantCount, activeCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    ])
    res.json({
      data: {
        google: {
          configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
          redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI ?? `${env.APP_BASE_URL?.replace('3000', '4000') ?? 'http://localhost:4000'}/api/integrations/google/callback`,
        },
        stripe: {
          configured: !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
        },
        twilio: {
          configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
        },
        tenantCount,
        activeCount,
      },
    })
  } catch (err) { next(err) }
})

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

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

router.get('/tenants', async (req, res, next) => {
  try {
    const params = validate(listQuerySchema, req.query)
    const result = await adminService.listTenants(params)
    res.json({ data: result.tenants, meta: { total: result.total, limit: result.limit, offset: result.offset } })
  } catch (err) { next(err) }
})

router.get('/tenants/:tenantId', async (req, res, next) => {
  try {
    const tenant = await adminService.getTenantDetail(req.params['tenantId']!)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.patch('/tenants/:tenantId', async (req, res, next) => {
  try {
    const data = validate(adminService.adminUpdateTenantSchema, req.body)
    const tenant = await adminService.adminUpdateTenant(req.params['tenantId']!, req.user!.id, data)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.post('/tenants/:tenantId/suspend', async (req, res, next) => {
  try {
    const tenant = await adminService.suspendTenant(req.params['tenantId']!, req.user!.id)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.post('/tenants/:tenantId/restore', async (req, res, next) => {
  try {
    const tenant = await adminService.restoreTenant(req.params['tenantId']!, req.user!.id)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

// System Settings
router.get('/system-settings', async (_req, res, next) => {
  try {
    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const googleSettingsSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  redirectUri: z.string().url().optional(),
})

router.patch('/system-settings/google', async (req, res, next) => {
  try {
    const parsed = googleSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { clientId, clientSecret, redirectUri } = parsed.data
    const userId = req.user!.id

    if (clientId) await systemConfig.setConfigValue('google_client_id', clientId, false, userId)
    if (clientSecret) await systemConfig.setConfigValue('google_client_secret', clientSecret, true, userId)
    if (redirectUri) await systemConfig.setConfigValue('google_oauth_redirect_uri', redirectUri, false, userId)

    await writeAuditLog({
      actorType: 'USER',
      actorUserId: userId,
      action: 'system_settings.google.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const stripeSettingsSchema = z.object({
  secretKey: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional(),
})

router.patch('/system-settings/stripe', async (req, res, next) => {
  try {
    const parsed = stripeSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { secretKey, webhookSecret } = parsed.data
    const userId = req.user!.id

    if (secretKey) await systemConfig.setConfigValue('stripe_secret_key', secretKey, true, userId)
    if (webhookSecret) await systemConfig.setConfigValue('stripe_webhook_secret', webhookSecret, true, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.stripe.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const twilioSettingsSchema = z.object({
  accountSid: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
})

router.patch('/system-settings/twilio', async (req, res, next) => {
  try {
    const parsed = twilioSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { accountSid, authToken, phoneNumber } = parsed.data
    const userId = req.user!.id

    if (accountSid) await systemConfig.setConfigValue('twilio_account_sid', accountSid, false, userId)
    if (authToken) await systemConfig.setConfigValue('twilio_auth_token', authToken, true, userId)
    if (phoneNumber) await systemConfig.setConfigValue('twilio_phone_number', phoneNumber, false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.twilio.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

export default router
