import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as adminService from '../services/admin.service.js'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'
import { prisma } from '../lib/prisma.js'
import * as systemConfig from '../services/system-config.service.js'
import * as storageTierSvc from '../services/storage-tier.service.js'
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
    res.json({ data: { items: result.tenants, total: result.total, limit: result.limit, offset: result.offset } })
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

// Admin grant-plan — bypasses Stripe entirely. Used for internal testing of
// tier-gated features without creating real Stripe subscriptions or processing
// payments. Audit-logged so it is never invisible.
router.post('/tenants/:tenantId/grant-plan', async (req, res, next) => {
  try {
    const tenantId = req.params['tenantId']!
    const { planCode } = req.body as { planCode?: string }
    if (!planCode) throw new AppError('VALIDATION_ERROR', 'planCode is required', 422)

    const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } })
    if (!plan) throw new AppError('NOT_FOUND', `Plan '${planCode}' not found or inactive`, 404)

    // Cancel any existing admin-granted subs (stripeSubscriptionId is null on those)
    await prisma.subscription.updateMany({
      where: { tenantId, stripeSubscriptionId: null, status: 'ACTIVE' },
      data: { status: 'CANCELED', canceledAt: new Date() },
    })

    // Create the new admin-granted subscription record
    const sub = await prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        stripeSubscriptionId: null,  // null = admin-granted (no Stripe involvement)
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,  // open-ended for admin grants
      },
    })

    // Sync entitlements from the granted plan
    const { syncEntitlementsFromPlan } = await import('../services/entitlement.service.js')
    await syncEntitlementsFromPlan(tenantId, plan.id)

    writeAuditLog({
      actorType: 'USER',
      actorUserId: req.user!.id,
      action: 'admin.plan_granted',
      tenantId,
      targetType: 'Subscription',
      targetId: sub.id,
      metadataJson: { planCode, planName: plan.name, granted_by: req.user!.email },
    }).catch(e => console.error('[audit]', e))

    res.json({ data: { subscription: sub, plan: { code: plan.code, name: plan.name } } })
  } catch (err) { next(err) }
})

// Admin revoke-plan — cancels admin-granted sub, resets entitlements to free tier.
// Does NOT touch real Stripe subscriptions (those have non-null stripeSubscriptionId).
router.post('/tenants/:tenantId/revoke-plan', async (req, res, next) => {
  try {
    const tenantId = req.params['tenantId']!

    // Cancel any active admin-granted subs (Stripe subs untouched)
    const canceled = await prisma.subscription.updateMany({
      where: { tenantId, stripeSubscriptionId: null, status: 'ACTIVE' },
      data: { status: 'CANCELED', canceledAt: new Date() },
    })

    // Reset entitlements back to free tier
    const freePlan = await prisma.plan.findFirst({ where: { code: 'free', isActive: true } })
    if (freePlan) {
      const { syncEntitlementsFromPlan } = await import('../services/entitlement.service.js')
      await syncEntitlementsFromPlan(tenantId, freePlan.id)
    }

    writeAuditLog({
      actorType: 'USER',
      actorUserId: req.user!.id,
      action: 'admin.plan_revoked',
      tenantId,
      metadataJson: { canceledCount: canceled.count, reset_to: 'free', revoked_by: req.user!.email },
    }).catch(e => console.error('[audit]', e))

    res.json({ data: { canceled: canceled.count, reset_to: 'free' } })
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
  publishableKey: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional(),
  webhookSecretConnect: z.string().min(1).optional(),
})

router.patch('/system-settings/stripe', async (req, res, next) => {
  try {
    const parsed = stripeSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { secretKey, publishableKey, webhookSecret, webhookSecretConnect } = parsed.data
    const userId = req.user!.id

    if (secretKey) await systemConfig.setConfigValue('stripe_secret_key', secretKey, true, userId)
    if (publishableKey) await systemConfig.setConfigValue('stripe_publishable_key', publishableKey, false, userId)
    if (webhookSecret) await systemConfig.setConfigValue('stripe_webhook_secret', webhookSecret, true, userId)
    if (webhookSecretConnect) await systemConfig.setConfigValue('stripe_webhook_secret_connect', webhookSecretConnect, true, userId)

    // Reload the Stripe client so the swap takes effect immediately, no restart
    const { bootStripeFromConfig } = await import('../lib/stripe.js')
    await bootStripeFromConfig().catch(() => null)

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

const twilioTestSettingsSchema = z.object({
  accountSid: z.string().min(1).optional(),
  authToken:  z.string().min(1).optional(),
})

router.patch('/system-settings/twilio-test', async (req, res, next) => {
  try {
    const parsed = twilioTestSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { accountSid, authToken } = parsed.data
    const userId = req.user!.id

    if (accountSid) await systemConfig.setConfigValue('twilio_test_account_sid', accountSid, false, userId)
    if (authToken)  await systemConfig.setConfigValue('twilio_test_auth_token', authToken, true, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.twilio_test.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const testSmsSchema = z.object({
  to:   z.string().min(3).max(40),
  body: z.string().min(1).max(1600),
  from: z.string().min(3).max(40).optional(),
  mode: z.enum(['live', 'test']).default('test'),
})

router.post('/test-sms', async (req, res, next) => {
  try {
    const parsed = testSmsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { sendTestMessage } = await import('../services/sms.service.js')
    const result = await sendTestMessage({
      to:   parsed.data.to,
      body: parsed.data.body,
      ...(parsed.data.from ? { from: parsed.data.from } : {}),
      mode: parsed.data.mode,
      actorUserId: req.user!.id,
    })
    res.json({ data: result })
  } catch (err) { next(err) }
})

const reoonSettingsSchema = z.object({
  apiKey: z.string().min(1).optional(),
  mode: z.enum(['quick', 'power']).optional(),
})

router.patch('/system-settings/reoon', async (req, res, next) => {
  try {
    const parsed = reoonSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, mode } = parsed.data
    const userId = req.user!.id

    if (apiKey) await systemConfig.setConfigValue('reoon_api_key', apiKey, true, userId)
    if (mode)   await systemConfig.setConfigValue('reoon_mode', mode, false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.reoon.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const openaiSettingsSchema = z.object({
  apiKey: z.string().min(1).optional(),
  model:  z.string().min(1).optional(),
})

router.patch('/system-settings/openai', async (req, res, next) => {
  try {
    const parsed = openaiSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, model } = parsed.data
    const userId = req.user!.id

    if (apiKey) await systemConfig.setConfigValue('openai_api_key', apiKey, true, userId)
    if (model)  await systemConfig.setConfigValue('openai_model', model, false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.openai.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const bunnySettingsSchema = z.object({
  apiKey:          z.string().min(1).optional(),
  storageZone:     z.string().min(1).optional(),
  storagePassword: z.string().min(1).optional(),
  cdnHostname:     z.string().min(1).optional(),
  storageRegion:   z.string().min(1).optional(),
})

router.patch('/system-settings/bunny', async (req, res, next) => {
  try {
    const parsed = bunnySettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, storageZone, storagePassword, cdnHostname, storageRegion } = parsed.data
    const userId = req.user!.id

    if (apiKey)          await systemConfig.setConfigValue('bunny_api_key',          apiKey,          true,  userId)
    if (storageZone)     await systemConfig.setConfigValue('bunny_storage_zone',      storageZone,     false, userId)
    if (storagePassword) await systemConfig.setConfigValue('bunny_storage_password',  storagePassword, true,  userId)
    if (cdnHostname)     await systemConfig.setConfigValue('bunny_cdn_hostname',      cdnHostname,     false, userId)
    if (storageRegion)   await systemConfig.setConfigValue('bunny_storage_region',    storageRegion,   false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.bunny.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const storageSettingsSchema = z.object({
  defaultQuotaGb:      z.number().int().min(1).optional(),
  warningThresholdPct: z.number().int().min(50).max(99).optional(),
  retentionDays:       z.number().int().min(1).nullable().optional(),
})

router.patch('/system-settings/storage', async (req, res, next) => {
  try {
    const parsed = storageSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { defaultQuotaGb, warningThresholdPct, retentionDays } = parsed.data
    const userId = req.user!.id

    if (defaultQuotaGb      !== undefined) await systemConfig.setConfigValue('storage_default_quota_gb',       String(defaultQuotaGb),      false, userId)
    if (warningThresholdPct !== undefined) await systemConfig.setConfigValue('storage_warning_threshold_pct',  String(warningThresholdPct), false, userId)
    if (retentionDays       !== undefined) await systemConfig.setConfigValue('storage_retention_days',         retentionDays ? String(retentionDays) : '', false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.storage.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

// Per-tenant storage quota override
router.patch('/tenants/:tenantId/storage-quota', async (req, res, next) => {
  try {
    const { tenantId } = req.params
    const { quotaGb } = z.object({ quotaGb: z.number().int().min(0).nullable() }).parse(req.body)
    const userId = req.user!.id

    await prisma.tenant.update({
      where: { id: tenantId },
      data:  { storageQuotaBytes: quotaGb !== null ? BigInt(quotaGb) * BigInt(1024 * 1024 * 1024) : null },
    })

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'admin.tenant.storage_quota_override',
      targetType: 'Tenant', targetId: tenantId,
      metadataJson: { quotaGb },
    })

    res.json({ data: { tenantId, quotaGb } })
  } catch (err) { next(err) }
})

// ── Storage tier config ────────────────────────────────────────────────────────
router.get('/storage-tiers', async (_req, res, next) => {
  try {
    const tiers = await storageTierSvc.getTierConfigs()
    res.json({ data: tiers.map(t => ({ ...t, quotaBytes: String(t.quotaBytes) })) })
  } catch (err) { next(err) }
})

const updateTierSchema = z.object({
  quotaGb:         z.number().positive().optional(),
  retentionDays:   z.number().int().min(1).nullable().optional(),
  gracePeriodDays: z.number().int().min(1).max(365).optional(),
})

router.patch('/storage-tiers/:tier', async (req, res, next) => {
  try {
    const tier   = req.params['tier']!.toUpperCase() as storageTierSvc.StorageTier
    if (!storageTierSvc.TIERS.includes(tier)) throw new AppError('NOT_FOUND', 'Unknown tier', 404)
    const parsed = updateTierSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id
    await storageTierSvc.updateTierConfig(tier, parsed.data, userId)
    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'admin.storage_tier.updated',
      targetType: 'StorageTierConfig', targetId: tier,
      metadataJson: parsed.data,
    })
    const tiers = await storageTierSvc.getTierConfigs()
    res.json({ data: tiers.map(t => ({ ...t, quotaBytes: String(t.quotaBytes) })) })
  } catch (err) { next(err) }
})

// Assign a storage tier to a tenant
router.post('/tenants/:tenantId/storage-tier', async (req, res, next) => {
  try {
    const { tenantId } = req.params
    const { tier }     = z.object({ tier: z.enum(storageTierSvc.TIERS) }).parse(req.body)
    const userId       = req.user!.id
    const result       = await storageTierSvc.applyTierToTenant(tenantId!, tier)
    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'admin.tenant.storage_tier_assigned',
      targetType: 'Tenant', targetId: tenantId,
      metadataJson: { tier, gracePeriod: result.gracePeriod },
    })
    res.json({ data: { ...result, quotaBytes: String(result.quotaBytes) } })
  } catch (err) { next(err) }
})

// ── Plan management ────────────────────────────────────────────────────────────

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      include: { entitlements: { orderBy: { key: 'asc' } } },
      orderBy: { name: 'asc' },
    })
    res.json({ data: plans })
  } catch (err) { next(err) }
})

const updateEntitlementSchema = z.object({
  updates: z.array(z.object({
    key:          z.string(),
    booleanValue: z.boolean().nullable().optional(),
    integerValue: z.number().int().nullable().optional(),
    stringValue:  z.string().nullable().optional(),
  })),
})

router.patch('/plans/:planId/entitlements', async (req, res, next) => {
  try {
    const { planId } = req.params as { planId: string }
    const { updates } = validate(updateEntitlementSchema, req.body)
    const userId = req.user!.id

    for (const u of updates) {
      await prisma.planEntitlement.updateMany({
        where: { planId, key: u.key },
        data: {
          ...(u.booleanValue !== undefined ? { booleanValue: u.booleanValue } : {}),
          ...(u.integerValue !== undefined ? { integerValue: u.integerValue } : {}),
          ...(u.stringValue  !== undefined ? { stringValue:  u.stringValue  } : {}),
        },
      })
    }

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'admin.plan.entitlements_updated',
      targetType: 'Plan', targetId: planId,
      metadataJson: { keys: updates.map(u => u.key) },
    })

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { entitlements: { orderBy: { key: 'asc' } } },
    })
    res.json({ data: plan })
  } catch (err) { next(err) }
})

// ── SMTP / Email settings ──────────────────────────────────────────────────────
const smtpSettingsSchema = z.object({
  host:     z.string().min(1).optional(),
  port:     z.union([z.number(), z.string()]).transform(v => parseInt(String(v), 10)).pipe(z.number().int().min(1).max(65535)).optional(),
  user:     z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  from:     z.string().min(1).optional(),
})

router.patch('/system-settings/smtp', async (req, res, next) => {
  try {
    const parsed = smtpSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { host, port, user, password, from } = parsed.data
    const userId = req.user!.id

    if (host)     await systemConfig.setConfigValue('smtp_host',     host,           false, userId)
    if (port)     await systemConfig.setConfigValue('smtp_port',     String(port),   false, userId)
    if (user)     await systemConfig.setConfigValue('smtp_user',     user,           false, userId)
    if (password) await systemConfig.setConfigValue('smtp_password', password,       true,  userId)
    if (from)     await systemConfig.setConfigValue('smtp_from',     from,           false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.smtp.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const geminiSettingsSchema = z.object({
  apiKey: z.string().min(1).optional(),
  model:  z.string().min(1).optional(),
})

router.patch('/system-settings/gemini', async (req, res, next) => {
  try {
    const parsed = geminiSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id

    if (parsed.data.apiKey) await systemConfig.setConfigValue('gemini_api_key', parsed.data.apiKey, true,  userId)
    if (parsed.data.model)  await systemConfig.setConfigValue('gemini_model',   parsed.data.model,  false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.gemini.updated',
      targetType: 'SystemConfig',
      metadataJson: { fields: Object.keys(parsed.data) },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

const pricingSettingsSchema = z.object({
  overageMarkupPct: z.coerce.number().min(0).max(1000),
})

router.patch('/system-settings/pricing', async (req, res, next) => {
  try {
    const parsed = pricingSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id

    await systemConfig.setConfigValue('overage_markup_percent', String(parsed.data.overageMarkupPct), false, userId)

    await writeAuditLog({
      actorType: 'USER', actorUserId: userId,
      action: 'system_settings.pricing.updated',
      targetType: 'SystemConfig',
      metadataJson: { overageMarkupPct: parsed.data.overageMarkupPct },
    })

    const settings = await systemConfig.getSystemSettings()
    res.json({ data: settings })
  } catch (err) { next(err) }
})

// ── Impersonation ──────────────────────────────────────────────────────────────

router.post('/tenants/:tenantId/impersonate', async (req, res, next) => {
  try {
    const { tenantId } = req.params as { tenantId: string }
    const adminUserId = req.user!.id

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { members: { where: { isOwner: true }, include: { user: true }, take: 1 } },
    })
    if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)

    const session = await prisma.impersonationSession.create({
      data: { adminUserId, tenantId, assumedRoleKey: 'tenant_owner' },
    })

    await writeAuditLog({
      actorType: 'ADMIN',
      actorUserId: adminUserId,
      action: 'impersonation.started',
      targetType: 'Tenant',
      targetId: tenantId,
      metadataJson: { impersonationSessionId: session.id },
    })

    // Issue a short-lived impersonation token (15 min)
    const ownerUser = tenant.members[0]?.user
    const { signAccessToken } = await import('../lib/jwt.js')
    const token = signAccessToken({
      sub: ownerUser?.id ?? adminUserId,
      email: ownerUser?.email ?? req.user!.email,
      tenantId,
      roleKey: 'tenant_owner',
      isPlatformRole: false,
      impersonatedBy: adminUserId,
      impersonationSessionId: session.id,
    })

    res.json({ data: { token, sessionId: session.id, tenantName: tenant.displayName } })
  } catch (err) { next(err) }
})

router.post('/impersonation/:sessionId/end', async (req, res, next) => {
  try {
    const { sessionId } = req.params as { sessionId: string }
    const adminUserId = req.user!.id

    const session = await prisma.impersonationSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new AppError('NOT_FOUND', 'Session not found', 404)

    await prisma.impersonationSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    })

    await writeAuditLog({
      actorType: 'ADMIN',
      actorUserId: adminUserId,
      action: 'impersonation.ended',
      targetType: 'Tenant',
      targetId: session.tenantId,
      metadataJson: { impersonationSessionId: sessionId },
    })

    res.json({ data: { ended: true } })
  } catch (err) { next(err) }
})

// ── Twilio event logs — all tenants or filtered by tenantId
router.get('/twilio-logs', async (req, res, next) => {
  try {
    const { tenantId, direction, eventType, limit = '50', offset = '0' } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (tenantId)  where['tenantId']  = tenantId
    if (direction) where['direction'] = direction
    if (eventType) where['eventType'] = eventType

    const [total, events] = await Promise.all([
      prisma.twilioEventLog.count({ where }),
      prisma.twilioEventLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take:    Math.min(parseInt(limit, 10), 200),
        skip:    parseInt(offset, 10),
        include: { tenant: { select: { displayName: true } } },
      }),
    ])

    res.json({ data: { items: events, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) } })
  } catch (err) { next(err) }
})

// GET /api/admin/errors — recent unhandled errors captured by the global
// error handler. Sourced from AuditLog rows where action starts with
// 'system.error.'. Newest first, capped at 200.
router.get('/errors', async (_req, res, next) => {
  try {
    const errors = await prisma.auditLog.findMany({
      where:   { action: { startsWith: 'system.error.' } },
      orderBy: { createdAt: 'desc' },
      take:    200,
    })
    res.json({ data: { items: errors, total: errors.length } })
  } catch (err) { next(err) }
})

export default router
