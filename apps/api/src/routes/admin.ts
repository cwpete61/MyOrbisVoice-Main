import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin, requirePlatformSuperAdmin, requirePlatformSupport } from '../middleware/rbac.js'
import * as adminService from '../services/admin.service.js'
import * as compCodeService from '../services/comp-code.service.js'
import { AppError } from '@voiceautomation/shared'
import { getEnv } from '@voiceautomation/config'
import { prisma } from '../lib/prisma.js'
import * as systemConfig from '../services/system-config.service.js'
import * as storageTierSvc from '../services/storage-tier.service.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'

const router: IRouter = Router()
// File-level guard is the WEAKEST platform-staff role (Support). Read-only
// routes inherit this guard and need nothing more. Routes that perform
// privileged writes get an extra `requirePlatformAdmin` middleware in
// their definition below; credential-edit routes get an even stricter
// `requirePlatformSuperAdmin`. Three tiers, enforced server-side.
router.use(authenticate, requirePlatformSupport)

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

router.patch('/tenants/:tenantId', requirePlatformAdmin, async (req, res, next) => {
  try {
    const data = validate(adminService.adminUpdateTenantSchema, req.body)
    const tenant = await adminService.adminUpdateTenant(req.params['tenantId']!, req.user!.id, data)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.post('/tenants/:tenantId/suspend', requirePlatformAdmin, async (req, res, next) => {
  try {
    const tenant = await adminService.suspendTenant(req.params['tenantId']!, req.user!.id)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

router.post('/tenants/:tenantId/restore', requirePlatformAdmin, async (req, res, next) => {
  try {
    const tenant = await adminService.restoreTenant(req.params['tenantId']!, req.user!.id)
    res.json({ data: tenant })
  } catch (err) { next(err) }
})

// Admin grant-plan — bypasses Stripe entirely. Used for internal testing of
// tier-gated features without creating real Stripe subscriptions or processing
// payments. Audit-logged so it is never invisible.
router.post('/tenants/:tenantId/grant-plan', requirePlatformAdmin, async (req, res, next) => {
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

    writeAuditLogFromRequest(req, {
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
router.post('/tenants/:tenantId/revoke-plan', requirePlatformAdmin, async (req, res, next) => {
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

    writeAuditLogFromRequest(req, {
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
router.get('/system-settings', async (req, res, next) => {
  try {
    const settings = await systemConfig.getSystemSettings()
    // Account-email associations are Super-Admin-only — they reveal which
    // login owns each API key. Lesser admins never see them, both because
    // the field is omitted here and because the PATCH routes that write
    // them are gated by requirePlatformSuperAdmin.
    const isSuper = req.user?.roleKey === 'platform_super_admin'
    const accountEmails = isSuper ? await systemConfig.getAccountEmails() : null
    res.json({ data: { ...settings, accountEmails } })
  } catch (err) { next(err) }
})

/** Optional account-email field accepted by every credential PATCH.
 *  Empty string clears, undefined leaves the existing value alone. */
const accountEmailField = z.string().email().optional().or(z.literal(''))

const googleSettingsSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  redirectUri: z.string().url().optional(),
  accountEmail: accountEmailField,
})

router.patch('/system-settings/google', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = googleSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { clientId, clientSecret, redirectUri, accountEmail } = parsed.data
    const userId = req.user!.id

    if (clientId) await systemConfig.setConfigValue('google_client_id', clientId, false, userId)
    if (clientSecret) await systemConfig.setConfigValue('google_client_secret', clientSecret, true, userId)
    if (redirectUri) await systemConfig.setConfigValue('google_oauth_redirect_uri', redirectUri, false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('google', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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

// Format-aware validators — catch paste-target mismatches at the API gate
// instead of silently corrupting SystemConfig (which we hit twice during the
// 2026-05-05 launch hardening session — pasting a whsec_… into secretKey
// produced hours of 502s with no obvious cause).
const stripeSecretKey      = z.string().regex(/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/,
  'Stripe secret keys start with sk_live_, sk_test_, rk_live_, or rk_test_. Got something else — did you paste a publishable key (pk_…) or a webhook signing secret (whsec_…) instead?')
const stripePublishableKey = z.string().regex(/^pk_(live|test)_[A-Za-z0-9]+$/,
  'Stripe publishable keys start with pk_live_ or pk_test_.')
const stripeWebhookSecret  = z.string().regex(/^whsec_[A-Za-z0-9_-]+$/,
  'Stripe webhook signing secrets start with whsec_.')

const stripeSettingsSchema = z.object({
  secretKey:            stripeSecretKey.optional(),
  publishableKey:       stripePublishableKey.optional(),
  webhookSecret:        stripeWebhookSecret.optional(),
  webhookSecretConnect: stripeWebhookSecret.optional(),
  accountEmail:         accountEmailField,
})

router.patch('/system-settings/stripe', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = stripeSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      // Surface field-specific errors so the form can show them inline
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'root'
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
      throw new AppError('VALIDATION_ERROR', 'Invalid Stripe key format', 422, fieldErrors)
    }
    const { secretKey, publishableKey, webhookSecret, webhookSecretConnect, accountEmail } = parsed.data
    const userId = req.user!.id

    if (secretKey) await systemConfig.setConfigValue('stripe_secret_key', secretKey, true, userId)
    if (publishableKey) await systemConfig.setConfigValue('stripe_publishable_key', publishableKey, false, userId)
    if (webhookSecret) await systemConfig.setConfigValue('stripe_webhook_secret', webhookSecret, true, userId)
    if (webhookSecretConnect) await systemConfig.setConfigValue('stripe_webhook_secret_connect', webhookSecretConnect, true, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('stripe', accountEmail, userId)

    // Reload the Stripe client so the swap takes effect immediately, no restart
    const { bootStripeFromConfig } = await import('../lib/stripe.js')
    await bootStripeFromConfig().catch(() => null)

    await writeAuditLogFromRequest(req, {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/twilio', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = twilioSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { accountSid, authToken, phoneNumber, accountEmail } = parsed.data
    const userId = req.user!.id

    if (accountSid) await systemConfig.setConfigValue('twilio_account_sid', accountSid, false, userId)
    if (authToken) await systemConfig.setConfigValue('twilio_auth_token', authToken, true, userId)
    if (phoneNumber) await systemConfig.setConfigValue('twilio_phone_number', phoneNumber, false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('twilio', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/twilio-test', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = twilioTestSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { accountSid, authToken, accountEmail } = parsed.data
    const userId = req.user!.id

    if (accountSid) await systemConfig.setConfigValue('twilio_test_account_sid', accountSid, false, userId)
    if (authToken)  await systemConfig.setConfigValue('twilio_test_auth_token', authToken, true, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('twilioTest', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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

router.post('/test-sms', requirePlatformAdmin, async (req, res, next) => {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/reoon', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = reoonSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, mode, accountEmail } = parsed.data
    const userId = req.user!.id

    if (apiKey) await systemConfig.setConfigValue('reoon_api_key', apiKey, true, userId)
    if (mode)   await systemConfig.setConfigValue('reoon_mode', mode, false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('reoon', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/openai', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = openaiSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, model, accountEmail } = parsed.data
    const userId = req.user!.id

    if (apiKey) await systemConfig.setConfigValue('openai_api_key', apiKey, true, userId)
    if (model)  await systemConfig.setConfigValue('openai_model', model, false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('openai', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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
  accountEmail:    accountEmailField,
})

router.patch('/system-settings/bunny', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = bunnySettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { apiKey, storageZone, storagePassword, cdnHostname, storageRegion, accountEmail } = parsed.data
    const userId = req.user!.id

    if (apiKey)          await systemConfig.setConfigValue('bunny_api_key',          apiKey,          true,  userId)
    if (storageZone)     await systemConfig.setConfigValue('bunny_storage_zone',      storageZone,     false, userId)
    if (storagePassword) await systemConfig.setConfigValue('bunny_storage_password',  storagePassword, true,  userId)
    if (cdnHostname)     await systemConfig.setConfigValue('bunny_cdn_hostname',      cdnHostname,     false, userId)
    if (storageRegion)   await systemConfig.setConfigValue('bunny_storage_region',    storageRegion,   false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('bunny', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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

router.patch('/system-settings/storage', requirePlatformAdmin, async (req, res, next) => {
  try {
    const parsed = storageSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { defaultQuotaGb, warningThresholdPct, retentionDays } = parsed.data
    const userId = req.user!.id

    if (defaultQuotaGb      !== undefined) await systemConfig.setConfigValue('storage_default_quota_gb',       String(defaultQuotaGb),      false, userId)
    if (warningThresholdPct !== undefined) await systemConfig.setConfigValue('storage_warning_threshold_pct',  String(warningThresholdPct), false, userId)
    if (retentionDays       !== undefined) await systemConfig.setConfigValue('storage_retention_days',         retentionDays ? String(retentionDays) : '', false, userId)

    await writeAuditLogFromRequest(req, {
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
router.patch('/tenants/:tenantId/storage-quota', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { tenantId } = req.params
    const { quotaGb } = z.object({ quotaGb: z.number().int().min(0).nullable() }).parse(req.body)
    const userId = req.user!.id

    await prisma.tenant.update({
      where: { id: tenantId },
      data:  { storageQuotaBytes: quotaGb !== null ? BigInt(quotaGb) * BigInt(1024 * 1024 * 1024) : null },
    })

    await writeAuditLogFromRequest(req, {
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

router.patch('/storage-tiers/:tier', requirePlatformAdmin, async (req, res, next) => {
  try {
    const tier   = req.params['tier']!.toUpperCase() as storageTierSvc.StorageTier
    if (!storageTierSvc.TIERS.includes(tier)) throw new AppError('NOT_FOUND', 'Unknown tier', 404)
    const parsed = updateTierSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id
    await storageTierSvc.updateTierConfig(tier, parsed.data, userId)
    await writeAuditLogFromRequest(req, {
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
router.post('/tenants/:tenantId/storage-tier', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { tenantId } = req.params
    const { tier }     = z.object({ tier: z.enum(storageTierSvc.TIERS) }).parse(req.body)
    const userId       = req.user!.id
    const result       = await storageTierSvc.applyTierToTenant(tenantId!, tier)
    await writeAuditLogFromRequest(req, {
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

router.patch('/plans/:planId/entitlements', requirePlatformAdmin, async (req, res, next) => {
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

    await writeAuditLogFromRequest(req, {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/smtp', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = smtpSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const { host, port, user, password, from, accountEmail } = parsed.data
    const userId = req.user!.id

    if (host)     await systemConfig.setConfigValue('smtp_host',     host,           false, userId)
    if (port)     await systemConfig.setConfigValue('smtp_port',     String(port),   false, userId)
    if (user)     await systemConfig.setConfigValue('smtp_user',     user,           false, userId)
    if (password) await systemConfig.setConfigValue('smtp_password', password,       true,  userId)
    if (from)     await systemConfig.setConfigValue('smtp_from',     from,           false, userId)
    if (accountEmail !== undefined) await systemConfig.setAccountEmail('smtp', accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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
  accountEmail: accountEmailField,
})

router.patch('/system-settings/gemini', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = geminiSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id

    if (parsed.data.apiKey) await systemConfig.setConfigValue('gemini_api_key', parsed.data.apiKey, true,  userId)
    if (parsed.data.model)  await systemConfig.setConfigValue('gemini_model',   parsed.data.model,  false, userId)
    if (parsed.data.accountEmail !== undefined) await systemConfig.setAccountEmail('gemini', parsed.data.accountEmail, userId)

    await writeAuditLogFromRequest(req, {
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

router.patch('/system-settings/pricing', requirePlatformAdmin, async (req, res, next) => {
  try {
    const parsed = pricingSettingsSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)
    const userId = req.user!.id

    await systemConfig.setConfigValue('overage_markup_percent', String(parsed.data.overageMarkupPct), false, userId)

    await writeAuditLogFromRequest(req, {
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

    await writeAuditLogFromRequest(req, {
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

    await writeAuditLogFromRequest(req, {
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

// ── Disposable test-tenant cleanup ─────────────────────────────────────────
// The smoke-test (scripts/smoke-test.ts) creates a fresh tenant on every run
// using a @orbisvoice.test email. Without cleanup these accumulate. This
// endpoint deletes every tenant whose registration email ends in that
// reserved test-only domain. Cascade-deletes wipe TenantMember, BusinessProfile,
// ChannelConfig, AgentProfile, etc. — Prisma's onDelete: Cascade rules cover
// the full graph. Audit-logs the count.
router.delete('/test-tenants', requirePlatformAdmin, async (req, res, next) => {
  try {
    const before = await prisma.tenant.findMany({
      where: { registrationEmail: { endsWith: '@orbisvoice.test' } },
      select: { id: true, registrationEmail: true },
    })
    const result = await prisma.tenant.deleteMany({
      where: { registrationEmail: { endsWith: '@orbisvoice.test' } },
    })
    // Also clean up the user accounts created with these tenants — they're
    // disposable too. Tenant cascade handles TenantMember; Users created
    // exclusively for these tenants are easy to spot via the same domain.
    const userResult = await prisma.user.deleteMany({
      where: { email: { endsWith: '@orbisvoice.test' } },
    })

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.test_tenants_cleaned',
      metadataJson: {
        deletedTenantCount: result.count,
        deletedUserCount:   userResult.count,
        tenantEmails:       before.map(t => t.registrationEmail),
      },
    })

    res.json({ data: { deletedTenantCount: result.count, deletedUserCount: userResult.count } })
  } catch (err) { next(err) }
})

// ── A2P 10DLC admin surface ────────────────────────────────────────────────
//
// Lists every A2P application across the platform (tenant-scope + the single
// platform-scope row) and lets the admin edit + submit MyOrbisVoice's own
// platform-level application. The platform application is identified by
// tenantId IS NULL — the schema allows exactly one such row.

const a2pAdminSchema = z.object({
  legalName:         z.string().min(2).max(120),
  ein:               z.string().regex(/^\d{2}-?\d{7}$/, 'EIN must be in XX-XXXXXXX format').optional().or(z.literal('')),
  businessType:      z.enum(['SOLE_PROP', 'LLC', 'CORP', 'NON_PROFIT', 'PARTNERSHIP']),
  vertical:          z.string().min(2).max(60),
  websiteUrl:        z.string().url().optional().or(z.literal('')),
  addressLine1:      z.string().min(2).max(120),
  addressLine2:      z.string().max(120).optional().or(z.literal('')),
  city:              z.string().min(1).max(60),
  region:            z.string().min(2).max(60),
  postalCode:        z.string().min(3).max(20),
  country:           z.string().length(2).default('US'),
  contactFirstName:  z.string().min(1).max(60),
  contactLastName:   z.string().min(1).max(60),
  contactEmail:      z.string().email(),
  contactPhone:      z.string().min(7).max(20),
  useCase:           z.enum(['marketing', 'mixed', 'customer_care', '2fa', 'utility']),
  sampleMessages:    z.array(z.string().min(10).max(1600)).min(1).max(10),
})

// GET /api/admin/a2p — list every A2P application across the platform
router.get('/a2p', async (_req, res, next) => {
  try {
    const apps = await prisma.tenantA2PApplication.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        tenant: { select: { id: true, displayName: true } },
      },
    })
    const platformApp = apps.find(a => a.tenantId === null) ?? null
    const tenantApps  = apps.filter(a => a.tenantId !== null)
    res.json({ data: { platform: platformApp, tenants: tenantApps } })
  } catch (err) { next(err) }
})

// GET /api/admin/a2p/:tenantId — view a specific tenant's application
// (read-only — admins inspect, tenants edit). Use 'platform' as the special
// id for the platform-scope application.
router.get('/a2p/:tenantId', async (req, res, next) => {
  try {
    const { tenantId } = req.params as { tenantId: string }
    const app = tenantId === 'platform'
      ? await prisma.tenantA2PApplication.findFirst({
          where: { tenantId: null },
          include: { tenant: { select: { id: true, displayName: true } } },
        })
      : await prisma.tenantA2PApplication.findUnique({
          where: { tenantId },
          include: { tenant: { select: { id: true, displayName: true } } },
        })
    if (!app) throw new AppError('NOT_FOUND', 'A2P application not found', 404)
    res.json({ data: app })
  } catch (err) { next(err) }
})

// PUT /api/admin/a2p/platform — upsert the platform-scope (MyOrbisVoice's own)
// A2P application. Status starts as DRAFT; submit endpoint flips it.
router.put('/a2p/platform', requirePlatformAdmin, async (req, res, next) => {
  try {
    const data = a2pAdminSchema.parse(req.body)
    const userId = req.user!.id

    const existing = await prisma.tenantA2PApplication.findFirst({ where: { tenantId: null } })
    if (existing && existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      throw new AppError('CONFLICT', `Platform application is in ${existing.status} status — cannot edit`, 409)
    }

    const upserted = existing
      ? await prisma.tenantA2PApplication.update({
          where: { id: existing.id },
          data: { ...buildA2PData(data), status: 'DRAFT', rejectionReason: null },
        })
      : await prisma.tenantA2PApplication.create({
          data: { tenantId: null, ...buildA2PData(data), status: 'DRAFT' },
        })

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  userId,
      action:       'admin.a2p.platform.updated',
      targetType:   'TenantA2PApplication',
      targetId:     upserted.id,
      metadataJson: { useCase: upserted.useCase, vertical: upserted.vertical },
    })

    res.json({ data: upserted })
  } catch (err) { next(err) }
})

// POST /api/admin/a2p/platform/submit — flip platform application DRAFT → SUBMITTED.
// Until Trust Hub automation lands, this is a status-only flip; admin then
// posts the captured data to Twilio Trust Hub Console manually.
router.post('/a2p/platform/submit', requirePlatformAdmin, async (req, res, next) => {
  try {
    const userId = req.user!.id
    const app = await prisma.tenantA2PApplication.findFirst({ where: { tenantId: null } })
    if (!app) throw new AppError('NOT_FOUND', 'Fill out the platform application first', 404)
    if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
      throw new AppError('CONFLICT', `Platform application is in ${app.status} status — cannot submit`, 409)
    }
    const updated = await prisma.tenantA2PApplication.update({
      where: { id: app.id },
      data:  { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
    })
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  userId,
      action:       'admin.a2p.platform.submitted',
      targetType:   'TenantA2PApplication',
      targetId:     updated.id,
      metadataJson: { useCase: updated.useCase, vertical: updated.vertical },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// POST /api/admin/a2p/:applicationId/mark-approved — admin manually flips
// status to APPROVED after they've posted the data to Twilio Trust Hub
// Console and Twilio approved the brand + campaign. Records the Twilio SIDs
// so we know which Brand/Campaign goes with which application.
//
// Guard: application must be SUBMITTED or REJECTED (i.e. the tenant filled
// + submitted the form first). Blocks the DRAFT → APPROVED shortcut.
router.post('/a2p/:applicationId/mark-approved', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { applicationId } = req.params as { applicationId: string }
    const { brandSid, campaignSid, customerProfileSid } = req.body as {
      brandSid?: string
      campaignSid?: string
      customerProfileSid?: string
    }
    const existing = await prisma.tenantA2PApplication.findUnique({ where: { id: applicationId } })
    if (!existing) throw new AppError('NOT_FOUND', 'A2P application not found', 404)
    if (existing.status === 'DRAFT') {
      throw new AppError('CONFLICT', 'Application must be submitted (form completed) before it can be marked approved. Have the tenant fill and submit the /a2p form first, or use impersonation to fill it on their behalf.', 409)
    }
    const updated = await prisma.tenantA2PApplication.update({
      where: { id: applicationId },
      data:  {
        status:                   'APPROVED',
        approvedAt:               new Date(),
        rejectionReason:          null,
        twilioBrandSid:           brandSid           ?? null,
        twilioCampaignSid:        campaignSid        ?? null,
        twilioCustomerProfileSid: customerProfileSid ?? null,
      },
    })
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.a2p.marked_approved',
      targetType:   'TenantA2PApplication',
      targetId:     applicationId,
      metadataJson: { brandSid, campaignSid, customerProfileSid, fromStatus: existing.status },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// POST /api/admin/a2p/:applicationId/mark-rejected — admin manually flips
// status to REJECTED with a reason after Twilio rejected the application.
// Tenant sees the reason and can edit + resubmit.
//
// Guard: application must NOT be DRAFT — same form-first principle.
router.post('/a2p/:applicationId/mark-rejected', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { applicationId } = req.params as { applicationId: string }
    const { reason } = req.body as { reason: string }
    if (!reason) throw new AppError('VALIDATION_ERROR', 'Reason is required', 422)
    const existing = await prisma.tenantA2PApplication.findUnique({ where: { id: applicationId } })
    if (!existing) throw new AppError('NOT_FOUND', 'A2P application not found', 404)
    if (existing.status === 'DRAFT') {
      throw new AppError('CONFLICT', 'Application must be submitted before it can be marked rejected. There is nothing to reject — it has not been submitted yet.', 409)
    }
    const updated = await prisma.tenantA2PApplication.update({
      where: { id: applicationId },
      data:  { status: 'REJECTED', rejectionReason: reason },
    })
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.a2p.marked_rejected',
      targetType:   'TenantA2PApplication',
      targetId:     applicationId,
      metadataJson: { reason, fromStatus: existing.status },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ── A2P operator notes ─────────────────────────────────────────────────────
//
// Append-only friction log. Every time an operator processing a manual A2P
// submission has to email a tenant for clarification, finds a missing field,
// flags a likely Twilio rejection, etc., they capture it here. After ~20
// submissions this becomes the data-driven design input for the future
// self-service A2P wizard (backlog #20).

const a2pNoteSchema = z.object({
  category: z.enum(['CLARIFICATION_NEEDED', 'DATA_GAP', 'FORMAT_ERROR', 'USE_CASE_MISMATCH', 'COMPLIANCE_CONCERN', 'OTHER']),
  note:     z.string().min(1).max(2000),
})

function validateA2PNote(data: unknown): z.infer<typeof a2pNoteSchema> {
  const result = a2pNoteSchema.safeParse(data)
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

// POST /api/admin/a2p/:applicationId/notes — append a note
router.post('/a2p/:applicationId/notes', async (req, res, next) => {
  try {
    const { applicationId } = req.params as { applicationId: string }
    const { category, note } = validateA2PNote(req.body)

    const application = await prisma.tenantA2PApplication.findUnique({ where: { id: applicationId } })
    if (!application) throw new AppError('NOT_FOUND', 'A2P application not found', 404)

    const created = await prisma.a2POperatorNote.create({
      data: { applicationId, byUserId: req.user!.id, category, note },
      include: { byUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
    })
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.a2p.note_added',
      targetType:   'TenantA2PApplication',
      targetId:     applicationId,
      metadataJson: { category, noteId: created.id },
    })
    res.status(201).json({ data: created })
  } catch (err) { next(err) }
})

// GET /api/admin/a2p/:applicationId/notes — list notes for an application
router.get('/a2p/:applicationId/notes', async (req, res, next) => {
  try {
    const { applicationId } = req.params as { applicationId: string }
    const application = await prisma.tenantA2PApplication.findUnique({ where: { id: applicationId } })
    if (!application) throw new AppError('NOT_FOUND', 'A2P application not found', 404)
    const notes = await prisma.a2POperatorNote.findMany({
      where:   { applicationId },
      orderBy: { createdAt: 'desc' },
      include: { byUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
    })
    res.json({ data: notes })
  } catch (err) { next(err) }
})

// ── Phone numbers admin surface ────────────────────────────────────────────
//
// Two sources of truth:
//   - Twilio master-account `incomingPhoneNumbers` list = platform-owned
//     numbers (not transferred to any subaccount). Used for ops, A2P
//     testing, support lines.
//   - Our DB's PhoneNumber table = tenant-assigned numbers (already on
//     a subaccount). Cross-referenced to show which tenant owns each.
//
// Admin can: search Twilio inventory, purchase new platform numbers
// (stays on master), release platform numbers, and SEE which tenant owns
// every assigned number.

// GET /api/admin/phone-numbers — full platform-wide inventory
router.get('/phone-numbers', async (_req, res, next) => {
  try {
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()

    // Source 1: Twilio master-account numbers (platform-owned, not transferred)
    const masterNumbers = await masterClient.incomingPhoneNumbers.list({ limit: 200 })

    // Source 2: tenant-assigned numbers from our DB
    const tenantNumbers = await prisma.phoneNumber.findMany({
      include: { tenant: { select: { id: true, displayName: true } } },
      orderBy: { e164Number: 'asc' },
    })

    res.json({
      data: {
        platform: masterNumbers.map(n => ({
          sid:                n.sid,
          phoneNumber:        n.phoneNumber,
          friendlyName:       n.friendlyName,
          capabilities: {
            voice: n.capabilities?.voice ?? false,
            sms:   n.capabilities?.sms ?? false,
            mms:   n.capabilities?.mms ?? false,
          },
          dateCreated:        n.dateCreated?.toISOString() ?? null,
          accountSid:         n.accountSid,
          voiceUrl:           n.voiceUrl,
          smsUrl:             n.smsUrl,
        })),
        tenants: tenantNumbers.map(n => ({
          id:                  n.id,
          phoneNumber:         n.e164Number,
          twilioNumberSid:     n.twilioNumberSid,
          twilioSubaccountSid: n.twilioSubaccountSid,
          tenantId:            n.tenantId,
          tenantName:          n.tenant?.displayName ?? null,
          displayLabel:        n.displayLabel,
          monthlyPriceCents:   n.monthlyPriceCents,
          isInboundEnabled:    n.isInboundEnabled,
          isOutboundEnabled:   n.isOutboundEnabled,
          isSmsEnabled:        n.isSmsEnabled,
          forwardingTarget:    n.forwardingTarget,
        })),
      },
    })
  } catch (err) { next(err) }
})

// POST /api/admin/phone-numbers/search — search Twilio inventory for new numbers
const adminSearchSchema = z.object({
  areaCode:    z.string().regex(/^\d{3}$/).optional(),
  pattern:     z.string().max(20).optional(),
  country:     z.string().length(2).default('US'),
  limit:       z.number().int().min(1).max(50).default(20),
})

router.post('/phone-numbers/search', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { areaCode, pattern, country, limit } = adminSearchSchema.parse(req.body)
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()

    const searchOpts: Record<string, unknown> = { limit, voiceEnabled: true, smsEnabled: true }
    if (areaCode) searchOpts.areaCode = parseInt(areaCode, 10)
    if (pattern)  searchOpts.contains = pattern

    const list = await masterClient.availablePhoneNumbers(country).local.list(searchOpts as never)
    res.json({
      data: list.map(n => ({
        phoneNumber:    n.phoneNumber,
        friendlyName:   n.friendlyName,
        locality:       n.locality ?? null,
        region:         n.region ?? null,
        capabilities: {
          voice: n.capabilities?.voice ?? false,
          sms:   n.capabilities?.sms ?? false,
          mms:   n.capabilities?.mms ?? false,
        },
        monthlyPriceCents: 115,  // Twilio standard local: $1.15/mo
      })),
    })
  } catch (err) { next(err) }
})

// POST /api/admin/phone-numbers/purchase — buy a number for the platform (stays on master)
const adminPurchaseSchema = z.object({
  phoneNumber:  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  friendlyName: z.string().max(120).optional(),
})

router.post('/phone-numbers/purchase', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { phoneNumber, friendlyName } = adminPurchaseSchema.parse(req.body)
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()

    let purchased
    try {
      purchased = await masterClient.incomingPhoneNumbers.create({
        phoneNumber,
        friendlyName: friendlyName ?? `Platform — ${phoneNumber}`,
        // Webhook URLs intentionally NOT set — admin can configure later via
        // Twilio Console if needed. Most platform-owned numbers won't receive
        // calls (they're for outbound A2P testing / ops).
      })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('21422') || msg.includes('not available')) {
        throw new AppError('NOT_FOUND', 'That number is no longer available — search again and pick another.', 404)
      }
      throw new AppError('INTERNAL_ERROR', `Twilio purchase failed: ${msg}`, 500)
    }

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.phone_number.purchased_platform',
      targetType:   'TwilioIncomingPhoneNumber',
      targetId:     purchased.sid,
      metadataJson: { phoneNumber, sid: purchased.sid, monthlyPriceCents: 115 },
    })

    res.status(201).json({
      data: {
        sid:          purchased.sid,
        phoneNumber:  purchased.phoneNumber,
        friendlyName: purchased.friendlyName,
        accountSid:   purchased.accountSid,
      },
    })
  } catch (err) { next(err) }
})

// GET /api/admin/phone-numbers/destinations — list of valid reassign targets:
// the master account + every tenant subaccount with its display name. Used by
// the reassign modal to populate the destination dropdown.
router.get('/phone-numbers/destinations', async (_req, res, next) => {
  try {
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()

    // Master account SID (the account this API key authenticates against)
    const master = await masterClient.api.v2010.accounts(masterClient.accountSid!).fetch()

    // All tenant subaccounts in our DB
    const subaccounts = await prisma.tenantTwilioSubaccount.findMany({
      where:   { status: 'ACTIVE' },
      include: { tenant: { select: { id: true, displayName: true } } },
      orderBy: { tenant: { displayName: 'asc' } },
    })

    res.json({
      data: {
        master: {
          accountSid: master.sid,
          label:      `${master.friendlyName ?? 'Platform'} (master)`,
        },
        subaccounts: subaccounts.map(s => ({
          accountSid:  s.twilioSubaccountSid,
          tenantId:    s.tenantId,
          label:       s.tenant.displayName,
        })),
      },
    })
  } catch (err) { next(err) }
})

// POST /api/admin/phone-numbers/:sid/reassign — move a number between accounts.
// Body: { targetAccountSid: string, targetTenantId?: string }
//   - targetAccountSid is master.sid for "move to platform-owned"
//   - or a subaccount SID for "move to tenant"
//   - targetTenantId is required when targetAccountSid is a subaccount (so we
//     can update the local DB row)
//
// Updates the DB to reflect the new ownership:
//   - master ← anywhere : delete the PhoneNumber row (no longer tenant-assigned)
//   - master → subaccount : create a new PhoneNumber row for the tenant
//   - subaccount → subaccount : update tenantId + subaccountSid on existing row
const reassignSchema = z.object({
  targetAccountSid: z.string().regex(/^AC[a-zA-Z0-9]{32}$/, 'Invalid Twilio account SID'),
  targetTenantId:   z.string().uuid().optional(),
  confirmPhoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must match the number being reassigned in E.164'),
})

router.post('/phone-numbers/:sid/reassign', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { sid } = req.params as { sid: string }
    if (!sid.startsWith('PN')) throw new AppError('VALIDATION_ERROR', 'Invalid Twilio number SID', 422)
    const { targetAccountSid, targetTenantId, confirmPhoneNumber } = reassignSchema.parse(req.body)

    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()
    const masterAccountSid = masterClient.accountSid!

    // Verify target is either master or a known active subaccount
    if (targetAccountSid !== masterAccountSid) {
      const sub = await prisma.tenantTwilioSubaccount.findUnique({ where: { twilioSubaccountSid: targetAccountSid } })
      if (!sub || sub.status !== 'ACTIVE') {
        throw new AppError('VALIDATION_ERROR', 'Target account is not a known active subaccount', 422)
      }
      if (!targetTenantId) {
        throw new AppError('VALIDATION_ERROR', 'targetTenantId is required when reassigning to a subaccount', 422)
      }
      if (sub.tenantId !== targetTenantId) {
        throw new AppError('VALIDATION_ERROR', 'targetTenantId does not match the subaccount', 422)
      }
    }

    // Confirm the phoneNumber typed in the modal matches what we're moving —
    // belt-and-suspenders against accidentally moving the wrong row
    let beforeNumber
    try {
      beforeNumber = await masterClient.incomingPhoneNumbers(sid).fetch()
    } catch (e) {
      throw new AppError('NOT_FOUND', `Number ${sid} not found on master account or accessible subaccount: ${(e as Error).message}`, 404)
    }
    if (beforeNumber.phoneNumber !== confirmPhoneNumber) {
      throw new AppError('VALIDATION_ERROR', `Confirmation phone number (${confirmPhoneNumber}) does not match the number being reassigned (${beforeNumber.phoneNumber})`, 422)
    }

    const sourceAccountSid = beforeNumber.accountSid
    if (sourceAccountSid === targetAccountSid) {
      throw new AppError('VALIDATION_ERROR', 'Number is already on the target account — no move needed', 422)
    }

    // ── Execute the Twilio-side move ─────────────────────────────────────
    await masterClient.incomingPhoneNumbers(sid).update({ accountSid: targetAccountSid })

    // ── Reconcile our DB to reflect the new ownership ─────────────────────
    // Look up the existing row (if any) by either twilioNumberSid or e164Number
    const existing = await prisma.phoneNumber.findFirst({
      where: { OR: [{ twilioNumberSid: sid }, { e164Number: beforeNumber.phoneNumber }] },
    })

    if (targetAccountSid === masterAccountSid) {
      // Moving back to master → delete tenant row if it exists
      if (existing) await prisma.phoneNumber.delete({ where: { id: existing.id } })
    } else if (sourceAccountSid === masterAccountSid && targetTenantId) {
      // Moving from master to subaccount → create new tenant row
      await prisma.phoneNumber.upsert({
        where:  { e164Number: beforeNumber.phoneNumber },
        create: {
          tenantId:            targetTenantId,
          twilioNumberSid:     sid,
          twilioSubaccountSid: targetAccountSid,
          e164Number:          beforeNumber.phoneNumber,
          monthlyPriceCents:   115,
          isInboundEnabled:    true,
          isOutboundEnabled:   true,
          isSmsEnabled:        true,
        },
        update: {
          tenantId:            targetTenantId,
          twilioSubaccountSid: targetAccountSid,
        },
      })
    } else if (targetTenantId) {
      // Moving between subaccounts → update tenantId + subaccountSid
      if (existing) {
        await prisma.phoneNumber.update({
          where: { id: existing.id },
          data:  { tenantId: targetTenantId, twilioSubaccountSid: targetAccountSid },
        })
      } else {
        // No existing row but we're going to a subaccount — create one
        await prisma.phoneNumber.create({
          data: {
            tenantId:            targetTenantId,
            twilioNumberSid:     sid,
            twilioSubaccountSid: targetAccountSid,
            e164Number:          beforeNumber.phoneNumber,
            monthlyPriceCents:   115,
            isInboundEnabled:    true,
            isOutboundEnabled:   true,
            isSmsEnabled:        true,
          },
        })
      }
    }

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.phone_number.reassigned',
      targetType:   'TwilioIncomingPhoneNumber',
      targetId:     sid,
      tenantId:     targetTenantId,
      metadataJson: {
        phoneNumber:      beforeNumber.phoneNumber,
        sid,
        sourceAccountSid,
        targetAccountSid,
        targetTenantId:   targetTenantId ?? null,
      },
    })

    res.json({
      data: {
        sid,
        phoneNumber: beforeNumber.phoneNumber,
        sourceAccountSid,
        targetAccountSid,
        targetTenantId: targetTenantId ?? null,
      },
    })
  } catch (err) { next(err) }
})

// DELETE /api/admin/phone-numbers/:sid — release a platform-owned number back to Twilio
router.delete('/phone-numbers/:sid', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { sid } = req.params as { sid: string }
    if (!sid.startsWith('PN')) throw new AppError('VALIDATION_ERROR', 'Invalid Twilio number SID', 422)
    const { getPlatformTwilioClient } = await import('../services/twilio.service.js')
    const masterClient = await getPlatformTwilioClient()

    const before = await masterClient.incomingPhoneNumbers(sid).fetch()
    await masterClient.incomingPhoneNumbers(sid).remove()

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.phone_number.released_platform',
      targetType:   'TwilioIncomingPhoneNumber',
      targetId:     sid,
      metadataJson: { phoneNumber: before.phoneNumber, sid },
    })

    res.json({ data: { released: true, phoneNumber: before.phoneNumber } })
  } catch (err) { next(err) }
})

// Helper to flatten the schema into Prisma-shaped data
function buildA2PData(d: z.infer<typeof a2pAdminSchema>) {
  return {
    legalName:         d.legalName,
    ein:               d.ein || null,
    businessType:      d.businessType,
    vertical:          d.vertical,
    websiteUrl:        d.websiteUrl || null,
    addressLine1:      d.addressLine1,
    addressLine2:      d.addressLine2 || null,
    city:              d.city,
    region:            d.region,
    postalCode:        d.postalCode,
    country:           d.country,
    contactFirstName:  d.contactFirstName,
    contactLastName:   d.contactLastName,
    contactEmail:      d.contactEmail,
    contactPhone:      d.contactPhone,
    useCase:           d.useCase,
    sampleMessagesJson: d.sampleMessages,
  }
}

// ── Comp codes (single-use 100%-off Stripe promotion codes) ───────────────
//
// Generates and tracks tier-scoped, single-use promo codes that grant 100%
// off a specific plan. Stripe is the source of truth — no parallel DB
// table. See apps/api/src/services/comp-code.service.ts for the model and
// docs/runbook-comp-codes-setup.md for the one-time Stripe Dashboard setup.

const compCodeCreateSchema = z.object({
  tier:           z.enum(['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE']),
  recipientName:  z.string().min(1).max(200),
  recipientEmail: z.string().email(),
  purpose:        z.string().max(500).optional().or(z.literal('')),
})

function validateCompCode(data: unknown): z.infer<typeof compCodeCreateSchema> {
  const result = compCodeCreateSchema.safeParse(data)
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

// GET /api/admin/comp-codes/config-status — which tiers have a coupon
// configured in Stripe Dashboard. Used by the admin UI to grey out tiers
// that aren't ready yet.
router.get('/comp-codes/config-status', async (_req, res, next) => {
  try {
    res.json({ data: await compCodeService.getConfigStatus() })
  } catch (err) { next(err) }
})

// GET /api/admin/comp-codes/buy-links — list all 5 plan tiers (Basic, Pro,
// Premier, Enterprise, LTD) with their Stripe Payment Link URLs. The
// standalone link-generator section in the admin UI uses this to let an
// admin pick any tier (including LTD) and generate a "share this buy link
// with email pre-filled" URL — separate from comp codes.
router.get('/comp-codes/buy-links', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where:  { isActive: true, stripeBuyLinkUrl: { not: null } },
      select: { code: true, name: true, stripeBuyLinkUrl: true, priceCents: true, interval: true },
      orderBy: { priceCents: 'asc' },
    })
    res.json({ data: plans })
  } catch (err) { next(err) }
})

// GET /api/admin/comp-codes — list all comp codes, optional tier filter
router.get('/comp-codes', async (req, res, next) => {
  try {
    const rawTier = (req.query as Record<string, string>)['tier']
    const filters: { tier?: 'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE' } = {}
    if (rawTier && ['BASIC', 'PRO', 'PREMIER', 'ENTERPRISE'].includes(rawTier)) {
      filters.tier = rawTier as 'BASIC' | 'PRO' | 'PREMIER' | 'ENTERPRISE'
    }
    res.json({ data: await compCodeService.listCompCodes(filters) })
  } catch (err) { next(err) }
})

// POST /api/admin/comp-codes — generate a fresh single-use comp code
router.post('/comp-codes', requirePlatformAdmin, async (req, res, next) => {
  try {
    const body = validateCompCode(req.body)
    const created = await compCodeService.generateCompCode({
      tier:           body.tier,
      recipientName:  body.recipientName,
      recipientEmail: body.recipientEmail,
      purpose:        body.purpose || undefined,
      generatedBy:    req.user!.id,
    })
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.comp_code.generated',
      targetType:   'PromotionCode',
      targetId:     created.id,
      metadataJson: {
        tier:           created.tier,
        code:           created.code,
        recipientEmail: created.recipientEmail,
        recipientName:  created.recipientName,
      },
    })
    res.status(201).json({ data: created })
  } catch (err) { next(err) }
})

// DELETE /api/admin/comp-codes/:id — disable an unredeemed comp code
router.delete('/comp-codes/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string }
    const updated = await compCodeService.disableCompCode(id)
    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.comp_code.disabled',
      targetType:   'PromotionCode',
      targetId:     id,
      metadataJson: { tier: updated.tier, code: updated.code },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// ── Platform team management ────────────────────────────────────────────
// Super-admin-only endpoints for granting/revoking platform-staff roles
// (platform_admin, platform_support). Roles are assigned via a TenantMember
// row on the platform-tenant (slug `orbis-platform`) — same pattern as the
// initial admin user gets in prisma/seed.ts. Granting a role to an existing
// User by email is the v1 path; full email-magic-link invite flow is a v2
// follow-up.

const PLATFORM_TENANT_SLUG = 'orbis-platform'
const ASSIGNABLE_ROLES = ['platform_super_admin', 'platform_admin', 'platform_support'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

async function getPlatformTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: PLATFORM_TENANT_SLUG } })
  if (!tenant) throw new AppError('INTERNAL_ERROR', 'Platform tenant not found — seed may not have run', 500)
  return tenant.id
}

/** Hard rule (intentional, locked-in 2026-05-07): Super Admin accounts
 *  are immutable from the team-management UI. No edit, no role change,
 *  no disable, no revoke — even by another Super Admin. The only admin
 *  action permitted on a Super Admin is `password-reset` (which sends
 *  the user a 15-min reset link they have to act on themselves).
 *
 *  Removing a Super Admin requires direct DB access via SSH. That's
 *  deliberate friction — Super Admin removal is a serious action and
 *  shouldn't be possible from an admin session that might be hijacked.
 *  Self-edits to email/name go through /admin/profile, not this surface. */
async function assertNotSuperAdmin(userId: string): Promise<void> {
  const platformTenantId = await getPlatformTenantId()
  const member = await prisma.tenantMember.findFirst({
    where:   { userId, tenantId: platformTenantId },
    include: { roleDefinition: { select: { key: true } } },
  })
  if (member?.roleDefinition.key === 'platform_super_admin') {
    throw new AppError(
      'FORBIDDEN',
      'Super Admin accounts cannot be modified from the team page. Only password reset is permitted. To remove a Super Admin, use direct DB access.',
      403,
    )
  }
}

// GET /api/admin/platform-staff — list users with platform-level roles
router.get('/platform-staff', requirePlatformSuperAdmin, async (_req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId()
    const memberships = await prisma.tenantMember.findMany({
      where: {
        tenantId: platformTenantId,
        roleDefinition: { isPlatformRole: true },
      },
      include: {
        user:           { select: { id: true, email: true, username: true, firstName: true, lastName: true, status: true, lastLoginAt: true, createdAt: true } },
        roleDefinition: { select: { key: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const data = memberships.map(m => ({
      userId:    m.user.id,
      email:     m.user.email,
      username:  m.user.username,
      firstName: m.user.firstName,
      lastName:  m.user.lastName,
      status:    m.user.status,
      roleKey:   m.roleDefinition.key,
      roleName:  m.roleDefinition.name,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      grantedAt:   m.createdAt.toISOString(),
    }))
    res.json({ data })
  } catch (err) { next(err) }
})

const grantRoleSchema = z.object({
  email:   z.string().email(),
  roleKey: z.enum(ASSIGNABLE_ROLES),
})

// POST /api/admin/platform-staff/grant — assign a platform role to an existing user by email
router.post('/platform-staff/grant', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const parsed = grantRoleSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input — email and roleKey required', 422)
    const { email, roleKey } = parsed.data

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) throw new AppError('NOT_FOUND', `No user with email ${email} exists. They must sign up first, then a Super Admin can grant the role.`, 404)

    const role = await prisma.roleDefinition.findUnique({ where: { key: roleKey } })
    if (!role) throw new AppError('INTERNAL_ERROR', 'Role not found in seed', 500)

    const platformTenantId = await getPlatformTenantId()
    const existing = await prisma.tenantMember.findFirst({
      where:   { userId: user.id, tenantId: platformTenantId },
      include: { roleDefinition: { select: { key: true } } },
    })
    if (existing) {
      // If the existing role is Super Admin and we're being asked to change
      // it to anything OTHER than Super Admin, block it. Super Admin is a
      // one-way door — see assertNotSuperAdmin for the reasoning.
      if (existing.roleDefinition.key === 'platform_super_admin' && roleKey !== 'platform_super_admin') {
        throw new AppError(
          'FORBIDDEN',
          'Super Admin role cannot be changed once granted. To remove a Super Admin, use direct DB access.',
          403,
        )
      }
      // Already a platform staff member — update their role instead
      await prisma.tenantMember.update({
        where: { id: existing.id },
        data:  { roleDefinitionId: role.id },
      })
    } else {
      await prisma.tenantMember.create({
        data: {
          userId:           user.id,
          tenantId:         platformTenantId,
          roleDefinitionId: role.id,
        },
      })
    }

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       existing ? 'admin.platform_staff.role_changed' : 'admin.platform_staff.granted',
      targetType:   'User',
      targetId:     user.id,
      metadataJson: { email: user.email, roleKey, previousRole: existing ? 'unknown' : null },
    })
    res.status(201).json({ data: { userId: user.id, email: user.email, roleKey } })
  } catch (err) { next(err) }
})

const updatePlatformStaffSchema = z.object({
  firstName: z.string().min(1).max(80).optional().or(z.literal('')),
  lastName:  z.string().min(1).max(80).optional().or(z.literal('')),
  username:  z.string().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/).optional().or(z.literal('')),
  email:     z.string().email().optional(),
  status:    z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']).optional(),
})

// PATCH /api/admin/platform-staff/:userId — edit a platform-staff member's
// account info. Empty string clears optional fields (firstName, lastName,
// username); undefined leaves them alone. Email must remain unique.
//
// Super Admin accounts are NOT editable from this endpoint — see
// assertNotSuperAdmin. Only password-reset is allowed on a Super Admin.
router.patch('/platform-staff/:userId', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string }
    const parsed = updatePlatformStaffSchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 422)

    // Ensure target is actually a platform-staff member
    const platformTenantId = await getPlatformTenantId()
    const member = await prisma.tenantMember.findFirst({
      where:   { userId, tenantId: platformTenantId },
      include: { user: { select: { id: true, email: true } } },
    })
    if (!member) throw new AppError('NOT_FOUND', 'User is not a platform-staff member', 404)
    await assertNotSuperAdmin(userId)

    const data: Record<string, unknown> = {}
    const { firstName, lastName, username, email, status } = parsed.data
    if (firstName !== undefined) data['firstName'] = firstName === '' ? null : firstName
    if (lastName  !== undefined) data['lastName']  = lastName  === '' ? null : lastName
    if (username  !== undefined) data['username']  = username  === '' ? null : username
    if (email     !== undefined) data['email']     = email.toLowerCase().trim()
    if (status    !== undefined) data['status']    = status

    if (Object.keys(data).length === 0) {
      res.json({ data: { ok: true, noChanges: true } })
      return
    }

    try {
      const updated = await prisma.user.update({
        where:  { id: userId },
        data,
        select: { id: true, email: true, username: true, firstName: true, lastName: true, status: true },
      })
      await writeAuditLogFromRequest(req, {
        actorType:    'ADMIN',
        actorUserId:  req.user!.id,
        action:       'admin.platform_staff.updated',
        targetType:   'User',
        targetId:     userId,
        metadataJson: { fields: Object.keys(data), email: updated.email, status: updated.status },
      })
      res.json({ data: updated })
    } catch (e: unknown) {
      const err = e as { code?: string; meta?: { target?: string[] } }
      if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
        throw new AppError('CONFLICT', 'Another user already uses that email', 409)
      }
      if (err.code === 'P2002' && err.meta?.target?.includes('username')) {
        throw new AppError('CONFLICT', 'Another user already uses that username', 409)
      }
      throw e
    }
  } catch (err) { next(err) }
})

// POST /api/admin/platform-staff/:userId/password-reset — trigger an
// admin-initiated password reset email. The user receives the same
// reset email a self-service "Forgot password" flow would send.
router.post('/platform-staff/:userId/password-reset', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string }
    const platformTenantId = await getPlatformTenantId()
    const member = await prisma.tenantMember.findFirst({
      where:   { userId, tenantId: platformTenantId },
      include: { user: { select: { email: true, firstName: true, status: true } } },
    })
    if (!member) throw new AppError('NOT_FOUND', 'User is not a platform-staff member', 404)
    if (member.user.status === 'DISABLED' || member.user.status === 'SUSPENDED') {
      throw new AppError('CONFLICT', 'User account is disabled or suspended; restore it before sending a reset email.', 409)
    }

    const authService = await import('../services/auth.service.js')
    const result = await authService.startPasswordReset(member.user.email)
    if (!result) throw new AppError('NOT_FOUND', 'Could not start password reset for this user', 404)

    const { sendPasswordResetEmail } = await import('../services/email.service.js')
    const { getEnv } = await import('@voiceautomation/config')
    const appBase = getEnv().APP_BASE_URL
    const resetUrl = `${appBase}/reset-password?token=${encodeURIComponent(result.rawToken)}`
    sendPasswordResetEmail({
      to:               result.email,
      firstName:        result.firstName,
      resetUrl,
      expiresInMinutes: 15,
    }).catch(e => console.error('[admin][password-reset] email send failed:', e?.message ?? e))

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  req.user!.id,
      action:       'admin.platform_staff.password_reset_sent',
      targetType:   'User',
      targetId:     userId,
      metadataJson: { email: result.email },
    })
    res.json({ data: { ok: true, sentTo: result.email } })
  } catch (err) { next(err) }
})

// DELETE /api/admin/platform-staff/:userId — revoke a user's platform-staff role.
// Super Admin accounts cannot be revoked (locked-in 2026-05-07) — see
// assertNotSuperAdmin for the reasoning.
router.delete('/platform-staff/:userId', requirePlatformSuperAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params as { userId: string }
    const requesterId = req.user!.id

    const platformTenantId = await getPlatformTenantId()
    const member = await prisma.tenantMember.findFirst({
      where:   { userId, tenantId: platformTenantId },
      include: { user: { select: { email: true } }, roleDefinition: { select: { key: true } } },
    })
    if (!member) throw new AppError('NOT_FOUND', 'User is not a platform-staff member', 404)
    await assertNotSuperAdmin(userId)

    await prisma.tenantMember.delete({ where: { id: member.id } })

    await writeAuditLogFromRequest(req, {
      actorType:    'ADMIN',
      actorUserId:  requesterId,
      action:       'admin.platform_staff.revoked',
      targetType:   'User',
      targetId:     userId,
      metadataJson: { email: member.user.email, roleKey: member.roleDefinition.key },
    })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
