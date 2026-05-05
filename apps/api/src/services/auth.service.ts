import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signAccessToken } from '../lib/jwt.js'
import { hashToken, generateSecureToken, AppError, toSlug } from '@voiceautomation/shared'
import type { RoleKey } from '@voiceautomation/types'
import { getOrCreateStripeCustomer } from './stripe.service.js'
import { syncEntitlementsFromPlan } from './entitlement.service.js'
import { attributeTenant, applyForAffiliate } from './affiliate.service.js'

const SALT_ROUNDS = 12
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function signupUser(data: {
  username: string
  email: string
  password: string
  businessName: string
  selectedPlanCode?: string
  affiliateCode?: string
}) {
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email } }),
    prisma.user.findUnique({ where: { username: data.username } }),
  ])
  if (existingEmail) throw new AppError('CONFLICT', 'Email already in use', 409)
  if (existingUsername) throw new AppError('CONFLICT', 'Username already taken', 409)

  const tenantOwnerRole = await prisma.roleDefinition.findUnique({ where: { key: 'tenant_owner' } })
  if (!tenantOwnerRole) throw new AppError('INTERNAL_ERROR', 'Role configuration missing — run db:seed', 500)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const baseSlug = toSlug(data.businessName) || 'workspace'
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const { user, tenant } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: data.email, username: data.username, passwordHash } })
    const tenant = await tx.tenant.create({
      data: {
        slug,
        displayName: data.businessName,
        registrationEmail: data.email,
        status: 'TRIAL',
      },
    })
    await tx.tenantMember.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleDefinitionId: tenantOwnerRole.id,
        isOwner: true,
      },
    })
    await tx.businessProfile.create({
      data: { tenantId: tenant.id, brandName: data.businessName },
    })
    return { user, tenant }
  })

  // Create Stripe customer eagerly so billing flows work immediately
  await getOrCreateStripeCustomer(tenant.id).catch(() => { /* non-fatal — customer created on first checkout */ })

  // Sync entitlements from the selected plan, defaulting to free tier
  const planCode = data.selectedPlanCode ?? 'free'
  const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } })
  if (plan) {
    await syncEntitlementsFromPlan(tenant.id, plan.id).catch(() => { /* non-fatal */ })
  }

  // Wire referral attribution (non-fatal)
  if (data.affiliateCode) {
    await attributeTenant(tenant.id, data.affiliateCode).catch(() => {})
  }

  const tokens = await issueTokens(user.id, user.email, tenant.id, 'tenant_owner', false)
  return { user: sanitizeUser(user), tenant: sanitizeTenant(tenant), ...tokens }
}

export async function affiliateSignupUser(data: {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
}) {
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email } }),
    prisma.user.findUnique({ where: { username: data.username } }),
  ])
  if (existingEmail) throw new AppError('CONFLICT', 'Email already in use', 409)
  if (existingUsername) throw new AppError('CONFLICT', 'Username already taken', 409)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: { email: data.email, username: data.username, passwordHash, firstName: data.firstName ?? null, lastName: data.lastName ?? null },
  })

  // Create the affiliate account in PENDING state
  await applyForAffiliate(user.id)

  const tokens = await issueTokens(user.id, user.email, null, 'affiliate', false)
  return { user: sanitizeUser(user), ...tokens }
}

export async function loginUser(data: { login: string; password: string }) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.login },
        { username: data.login },
      ],
    },
    include: {
      tenantMemberships: {
        include: { roleDefinition: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401)
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('FORBIDDEN', 'Account is not active', 403)
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const membership = user.tenantMemberships[0]
  let tenantId = membership?.tenantId ?? null
  let roleKey = (membership?.roleDefinition?.key ?? 'tenant_staff') as RoleKey
  let isPlatformRole = membership?.roleDefinition?.isPlatformRole ?? false

  // Affiliate-only users have no tenant membership — detect via AffiliateAccount
  if (!membership) {
    const affiliateAccount = await prisma.affiliateAccount.findUnique({ where: { userId: user.id } })
    if (affiliateAccount) {
      roleKey = 'affiliate'
      tenantId = null
      isPlatformRole = false
    }
  }

  const tokens = await issueTokens(user.id, user.email, tenantId, roleKey, isPlatformRole)
  return { user: sanitizeUser(user), tenantId, roleKey, ...tokens }
}

export async function refreshUserTokens(rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken)
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401)
  }

  // Rotate: revoke current token
  await prisma.refreshToken.update({ where: { tokenHash }, data: { revokedAt: new Date() } })

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    include: {
      tenantMemberships: {
        include: { roleDefinition: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('UNAUTHORIZED', 'User not found or inactive', 401)
  }

  const membership = user.tenantMemberships[0]
  const tenantId = membership?.tenantId ?? null
  const roleKey = (membership?.roleDefinition?.key ?? 'tenant_staff') as RoleKey
  const isPlatformRole = membership?.roleDefinition?.isPlatformRole ?? false

  return issueTokens(user.id, user.email, tenantId, roleKey, isPlatformRole)
}

export async function logoutUser(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken)
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

const SUPPORTED_LOCALES = ['en', 'es'] as const
type Locale = typeof SUPPORTED_LOCALES[number]

export async function updateProfile(userId: string, data: { firstName?: string; lastName?: string; username?: string; preferredLocale?: string }) {
  if (data.username) {
    const existing = await prisma.user.findFirst({ where: { username: data.username, NOT: { id: userId } } })
    if (existing) throw new AppError('CONFLICT', 'Username already taken', 409)
  }
  if (data.preferredLocale && !SUPPORTED_LOCALES.includes(data.preferredLocale as Locale)) {
    throw new AppError('VALIDATION_ERROR', `preferredLocale must be one of: ${SUPPORTED_LOCALES.join(', ')}`, 422)
  }
  const user = await prisma.user.update({ where: { id: userId }, data })
  return sanitizeUser(user)
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) throw new AppError('UNAUTHORIZED', 'Current password is incorrect', 401)
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  // Revoke all refresh tokens to force re-login on other devices
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenantMemberships: {
        include: { roleDefinition: true, tenant: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  return {
    user: sanitizeUser(user),
    memberships: user.tenantMemberships.map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant.displayName,
      roleKey: m.roleDefinition.key,
      isPlatformRole: m.roleDefinition.isPlatformRole,
      isOwner: m.isOwner,
    })),
  }
}

async function issueTokens(
  userId: string,
  email: string,
  tenantId: string | null,
  roleKey: RoleKey,
  isPlatformRole: boolean,
) {
  const accessToken = signAccessToken({ sub: userId, email, tenantId, roleKey, isPlatformRole })
  const rawRefresh = generateSecureToken(40)
  const tokenHash = hashToken(rawRefresh)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } })
  return { accessToken, refreshToken: rawRefresh }
}

function sanitizeUser(user: {
  id: string
  email: string
  username: string | null
  firstName: string | null
  lastName: string | null
  preferredLocale?: string
  status: string
  createdAt: Date
  lastLoginAt: Date | null
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredLocale: user.preferredLocale ?? 'en',
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

function sanitizeTenant(tenant: {
  id: string
  slug: string
  displayName: string
  status: string
  createdAt: Date
}) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    displayName: tenant.displayName,
    status: tenant.status,
    createdAt: tenant.createdAt,
  }
}
