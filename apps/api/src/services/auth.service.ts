import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signAccessToken } from '../lib/jwt.js'
import { hashToken, generateSecureToken, AppError, toSlug } from '@voiceautomation/shared'
import type { RoleKey } from '@voiceautomation/types'
import { getOrCreateStripeCustomer } from './stripe.service.js'
import { syncEntitlementsFromPlan } from './entitlement.service.js'
import { syncUserToKeycloak } from './keycloak-sync.service.js'
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
  preferredLocale?: string
  phone?: string
  smsConsent?: boolean
}) {
  // Case-insensitive uniqueness check — prevents "Redkins" + "redkins" from
  // co-existing. findFirst (not findUnique) because the column-level @unique
  // constraint is case-sensitive at the DB; we enforce insensitivity here.
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findFirst({ where: { email:    { equals: data.email,    mode: 'insensitive' } } }),
    prisma.user.findFirst({ where: { username: { equals: data.username, mode: 'insensitive' } } }),
  ])
  if (existingEmail) throw new AppError('CONFLICT', 'Email already in use', 409)
  if (existingUsername) throw new AppError('CONFLICT', 'Username already taken', 409)

  const tenantOwnerRole = await prisma.roleDefinition.findUnique({ where: { key: 'tenant_owner' } })
  if (!tenantOwnerRole) throw new AppError('INTERNAL_ERROR', 'Role configuration missing — run db:seed', 500)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const baseSlug = toSlug(data.businessName) || 'workspace'
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const { user, tenant } = await prisma.$transaction(async (tx) => {
    // preferredLocale: only honor 'en' or 'es' (defaults to 'en' otherwise via the DB default).
    // Set at signup time from Accept-Language detection (frontend reads useLocale() and passes
    // current locale to apiSignup), so a Spanish-speaking visitor who saw Spanish auth pages
    // continues seeing Spanish post-signup instead of having User.preferredLocale='en' override
    // their chosen language on every /me hydration.
    const locale = (data.preferredLocale === 'en' || data.preferredLocale === 'es') ? data.preferredLocale : 'en'
    const user = await tx.user.create({ data: {
      email: data.email, username: data.username, passwordHash, preferredLocale: locale,
      phone: data.phone || null,
      smsConsentAt: data.smsConsent ? new Date() : null,
    } })
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

  // Phase F.1 — seed the default 7-stage CRM pipeline. Idempotent + non-fatal:
  // a brand-new tenant whose pipeline seeding fails still completes signup
  // (they'll get an empty kanban; backfill possible via admin).
  try {
    const { seedDefaultPipeline } = await import('./crm.service.js')
    await seedDefaultPipeline({ kind: 'tenant', tenantId: tenant.id })
  } catch (err) {
    console.warn('[signup] CRM pipeline seed failed (non-fatal):', (err as Error).message)
  }

  // Always seed FREE-tier entitlements at signup. Paid-plan entitlements are
  // granted by the Stripe webhook after payment confirms (handleCheckoutCompleted
  // for LTD, handleSubscriptionUpdated for recurring). selectedPlanCode is still
  // honored by the frontend, which redirects to Stripe checkout — but if the user
  // bails on checkout, they end up on the free tier instead of a paid plan they
  // never paid for.
  const freePlan = await prisma.plan.findFirst({ where: { code: 'free', isActive: true } })
  if (freePlan) {
    await syncEntitlementsFromPlan(tenant.id, freePlan.id).catch(() => { /* non-fatal */ })
  }

  // Wire referral attribution (non-fatal)
  if (data.affiliateCode) {
    await attributeTenant(tenant.id, data.affiliateCode).catch(() => {})
  }

  // Phase 2: provision the new user into Keycloak for SSO (best-effort, non-fatal).
  // Pass the plaintext password so the KC login works immediately with the same
  // password — no set-password email round-trip (that was the self-serve gap).
  await syncUserToKeycloak(user.id, data.password)

  const tokens = await issueTokens(user.id, user.email, tenant.id, 'tenant_owner', false)
  return { user: sanitizeUser(user), tenant: sanitizeTenant(tenant), ...tokens }
}

/**
 * Finish a Google-initiated signup: caller has already verified the Google
 * profile (so email is known-good), now we collect username + businessName
 * and create the User + Tenant + supporting rows.
 *
 * Differences from signupUser():
 *   - passwordHash is null (Google-only). Caller can later set a password
 *     via the change-password / set-password flow if they want both methods.
 *   - googleId is stored at creation so future sign-ins are stable across
 *     email changes on the Google side.
 *   - firstName/lastName are pre-filled from the Google profile.
 *   - No password validation (Google verified the email).
 *
 * Same as signupUser():
 *   - Tenant created with TRIAL status, owner membership, business profile
 *   - Stripe customer eagerly created
 *   - FREE-tier entitlements seeded (paid plans gate on Stripe webhook —
 *     see fix(auth) commit cee97b7)
 *   - Affiliate attribution via referral code
 *   - Welcome email fire-and-forget
 */
export async function signupUserFromGoogle(data: {
  username:        string
  email:           string
  googleId:        string
  businessName:    string
  firstName?:      string | null
  lastName?:       string | null
  affiliateCode?:  string
  preferredLocale?: string
}) {
  // Case-insensitive uniqueness check — prevents "Redkins" + "redkins" from
  // co-existing. findFirst (not findUnique) because the column-level @unique
  // constraint is case-sensitive at the DB; we enforce insensitivity here.
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findFirst({ where: { email:    { equals: data.email,    mode: 'insensitive' } } }),
    prisma.user.findFirst({ where: { username: { equals: data.username, mode: 'insensitive' } } }),
  ])
  if (existingEmail)    throw new AppError('CONFLICT', 'Email already in use', 409)
  if (existingUsername) throw new AppError('CONFLICT', 'Username already taken', 409)

  const tenantOwnerRole = await prisma.roleDefinition.findUnique({ where: { key: 'tenant_owner' } })
  if (!tenantOwnerRole) throw new AppError('INTERNAL_ERROR', 'Role configuration missing — run db:seed', 500)

  const baseSlug = toSlug(data.businessName) || 'workspace'
  const slug = `${baseSlug}-${Date.now().toString(36)}`
  const locale = (data.preferredLocale === 'en' || data.preferredLocale === 'es') ? data.preferredLocale : 'en'

  const { user, tenant } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email:           data.email,
        username:        data.username,
        passwordHash:    null,                       // Google-only, no local password
        googleId:        data.googleId,
        firstName:       data.firstName ?? null,
        lastName:        data.lastName  ?? null,
        preferredLocale: locale,
      },
    })
    const tenant = await tx.tenant.create({
      data: { slug, displayName: data.businessName, registrationEmail: data.email, status: 'TRIAL' },
    })
    await tx.tenantMember.create({
      data: { userId: user.id, tenantId: tenant.id, roleDefinitionId: tenantOwnerRole.id, isOwner: true },
    })
    await tx.businessProfile.create({
      data: { tenantId: tenant.id, brandName: data.businessName },
    })
    return { user, tenant }
  })

  await getOrCreateStripeCustomer(tenant.id).catch(() => { /* non-fatal */ })

  // Phase F.1 — seed the default CRM pipeline for the new tenant (same as
  // the password-signup path above). Non-fatal.
  try {
    const { seedDefaultPipeline } = await import('./crm.service.js')
    await seedDefaultPipeline({ kind: 'tenant', tenantId: tenant.id })
  } catch (err) {
    console.warn('[google-signup] CRM pipeline seed failed (non-fatal):', (err as Error).message)
  }

  const freePlan = await prisma.plan.findFirst({ where: { code: 'free', isActive: true } })
  if (freePlan) {
    await syncEntitlementsFromPlan(tenant.id, freePlan.id).catch(() => { /* non-fatal */ })
  }

  if (data.affiliateCode) {
    await attributeTenant(tenant.id, data.affiliateCode).catch(() => {})
  }

  // Phase 2: provision the new user into Keycloak for SSO (best-effort, non-fatal).
  await syncUserToKeycloak(user.id)

  const tokens = await issueTokens(user.id, user.email, tenant.id, 'tenant_owner', false)
  return { user: sanitizeUser(user), tenant: sanitizeTenant(tenant), ...tokens }
}

/** Pick a unique username from a seed (email local-part), case-insensitive. */
async function uniqueUsername(seed: string): Promise<string> {
  const root = (seed.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user').slice(0, 24)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}${i}`
    const taken = await prisma.user.findFirst({ where: { username: { equals: candidate, mode: 'insensitive' } } })
    if (!taken) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

/**
 * Provision a tenant from a Stripe Payment Link purchase — the buyer never went
 * through app /signup (they clicked a buy.stripe.com link with a prefilled comp
 * code), so no account exists. Creates a PASSWORDLESS owner (like the Google path);
 * the caller links the Stripe customer + grants paid entitlements + sends a
 * set-password invite. Idempotent on email: if the user already owns a tenant, we
 * return it instead of creating a duplicate. Tenant is ACTIVE (they have a live sub).
 */
export async function provisionTenantFromPaymentLink(data: {
  email: string
  businessName: string
  preferredLocale?: string
}): Promise<{ userId: string; email: string; tenantId: string; isNew: boolean }> {
  const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } })
  if (existing) {
    const owner = await prisma.tenantMember.findFirst({ where: { userId: existing.id, isOwner: true }, select: { tenantId: true } })
    if (owner) return { userId: existing.id, email: existing.email, tenantId: owner.tenantId, isNew: false }
  }

  const tenantOwnerRole = await prisma.roleDefinition.findUnique({ where: { key: 'tenant_owner' } })
  if (!tenantOwnerRole) throw new AppError('INTERNAL_ERROR', 'Role configuration missing — run db:seed', 500)

  const username = await uniqueUsername(data.email.split('@')[0] || 'user')
  const baseSlug = toSlug(data.businessName) || 'workspace'
  const slug = `${baseSlug}-${Date.now().toString(36)}`
  const locale = (data.preferredLocale === 'en' || data.preferredLocale === 'es') ? data.preferredLocale : 'en'

  const { userId, tenantId } = await prisma.$transaction(async (tx) => {
    const user = existing ?? await tx.user.create({
      data: { email: data.email, username, passwordHash: null, preferredLocale: locale },
    })
    const tenant = await tx.tenant.create({
      data: { slug, displayName: data.businessName, registrationEmail: data.email, status: 'ACTIVE' },
    })
    await tx.tenantMember.create({
      data: { userId: user.id, tenantId: tenant.id, roleDefinitionId: tenantOwnerRole.id, isOwner: true },
    })
    await tx.businessProfile.create({ data: { tenantId: tenant.id, brandName: data.businessName } })
    return { userId: user.id, tenantId: tenant.id }
  })

  try { const { seedDefaultPipeline } = await import('./crm.service.js'); await seedDefaultPipeline({ kind: 'tenant', tenantId }) }
  catch (e) { console.warn('[paymentlink-provision] pipeline seed failed (non-fatal):', (e as Error).message) }
  try { await syncUserToKeycloak(userId) }
  catch (e) { console.warn('[paymentlink-provision] keycloak sync failed (non-fatal):', (e as Error).message) }

  return { userId, email: data.email, tenantId, isNew: true }
}

export async function affiliateSignupUser(data: {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  phone?: string
  smsConsent?: boolean
}) {
  // Case-insensitive uniqueness check — prevents "Redkins" + "redkins" from
  // co-existing. findFirst (not findUnique) because the column-level @unique
  // constraint is case-sensitive at the DB; we enforce insensitivity here.
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findFirst({ where: { email:    { equals: data.email,    mode: 'insensitive' } } }),
    prisma.user.findFirst({ where: { username: { equals: data.username, mode: 'insensitive' } } }),
  ])
  if (existingEmail) throw new AppError('CONFLICT', 'Email already in use', 409)
  if (existingUsername) throw new AppError('CONFLICT', 'Username already taken', 409)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: { email: data.email, username: data.username, passwordHash, firstName: data.firstName ?? null, lastName: data.lastName ?? null, phone: data.phone || null, smsConsentAt: data.smsConsent ? new Date() : null },
  })

  // Create the affiliate account in PENDING state
  await applyForAffiliate(user.id)
  // Mirror into the Hub Partner table so the parent storefront recognizes them as a
  // partner (else they land in the tenant dashboard). Best-effort.
  const { syncPartnerToHub } = await import('./hub-sync.service.js')
  await syncPartnerToHub(user.id).catch(() => {})

  const tokens = await issueTokens(user.id, user.email, null, 'affiliate', false)
  return { user: sanitizeUser(user), ...tokens }
}

export async function loginUser(data: { login: string; password: string }) {
  // Case-insensitive lookup on both email + username so users can type any
  // capitalization at the login form. The DB stores the original casing the
  // user chose at signup; this comparison ignores it on read. See also the
  // case-insensitive uniqueness check in signup* helpers below.
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email:    { equals: data.login, mode: 'insensitive' } },
        { username: { equals: data.login, mode: 'insensitive' } },
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

  // Google-only users (passwordHash null) can't password-login; reject with
  // generic UNAUTHORIZED rather than leaking the auth method, so we don't
  // help an attacker enumerate which accounts use which sign-in method.
  if (!user || !user.passwordHash || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401)
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

/**
 * Issue a fresh token pair for an already-authenticated user.
 * Used by the Google Sign-In flow once we've matched a Google profile to an
 * existing User. Mirrors the membership/role resolution that login + refresh
 * use, so a Google-signed-in user gets the same JWT payload as a password
 * user (currentTenantId, roleKey, isPlatformRole). If the user has no
 * memberships yet (rare: Google-signed-up but never finished a tenant flow)
 * roleKey defaults to 'tenant_staff' and tenantId is null.
 */
export async function issueTokensForUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  const membership      = user.tenantMemberships[0]
  const tenantId        = membership?.tenantId ?? null
  let   roleKey         = (membership?.roleDefinition?.key ?? 'tenant_staff') as RoleKey
  const isPlatformRole  = membership?.roleDefinition?.isPlatformRole ?? false

  // Precedence: platform-admin > affiliate > tenant. An active AffiliateAccount makes
  // this an affiliate, so EVERY login path routes to the partner portal. (Google
  // login only read tenant membership, so affiliate-only users fell to tenant_staff
  // and landed in the tenant app.) Platform-admin memberships keep their role.
  if (!isPlatformRole) {
    const affiliate = await prisma.affiliateAccount.findFirst({
      where: { userId, status: 'ACTIVE' }, select: { id: true },
    })
    if (affiliate) roleKey = 'affiliate' as RoleKey
  }

  const tokens = await issueTokens(user.id, user.email, tenantId, roleKey, isPlatformRole)
  return { user: sanitizeUser(user), ...tokens }
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

export async function updateProfile(userId: string, data: { firstName?: string; lastName?: string; username?: string; preferredLocale?: string; preferredTimezone?: string | null }) {
  if (data.username) {
    const existing = await prisma.user.findFirst({ where: { username: { equals: data.username, mode: 'insensitive' }, NOT: { id: userId } } })
    if (existing) throw new AppError('CONFLICT', 'Username already taken', 409)
  }
  if (data.preferredLocale && !SUPPORTED_LOCALES.includes(data.preferredLocale as Locale)) {
    throw new AppError('VALIDATION_ERROR', `preferredLocale must be one of: ${SUPPORTED_LOCALES.join(', ')}`, 422)
  }
  // Validate timezone via Intl. Null is allowed (clears the preference).
  if (data.preferredTimezone !== undefined && data.preferredTimezone !== null) {
    if (!isValidIanaTimezone(data.preferredTimezone)) {
      throw new AppError('VALIDATION_ERROR', 'preferredTimezone must be a valid IANA time-zone name (e.g. "America/New_York")', 422)
    }
  }
  const user = await prisma.user.update({ where: { id: userId }, data })
  return sanitizeUser(user)
}

function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404)
  // Google-only users have no local password to compare against. They need
  // to set one first via a separate "set password" flow (not exposed yet —
  // for now they stay Google-only and use Google sign-in to authenticate).
  if (!user.passwordHash) {
    throw new AppError('VALIDATION_ERROR', 'This account uses Google sign-in. Set a password from the profile page first to use password change.', 422)
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) throw new AppError('UNAUTHORIZED', 'Current password is incorrect', 401)
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
  // Revoke all refresh tokens to force re-login on other devices
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000  // 15 minutes

/** Step 1 of forgot-password flow. Creates a one-shot reset token (15-min
 *  TTL), stores its sha256 hash in PasswordResetToken, and returns the raw
 *  token PLUS the user's email + firstName so the route can email them.
 *
 *  Returns null when no user matches — caller must NOT reveal that fact to
 *  the requester (account-enumeration defense). The caller should return a
 *  success-shaped response either way.
 *
 *  Also revokes any prior unused reset tokens for the same user, so a
 *  fresh request invalidates older still-active tokens. */
export async function startPasswordReset(email: string): Promise<{
  rawToken: string
  expiresAt: Date
  email: string
  firstName: string | null
} | null> {
  // Case-insensitive lookup — the user might have signed up with mixed case
  // and lowercase comparison-only would miss the row. findFirst + insensitive
  // mode handles all stored capitalizations.
  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } })
  if (!user) return null
  if (user.status === 'DISABLED' || user.status === 'SUSPENDED') return null

  // Invalidate any pending unused reset tokens for this user — reset
  // requests are intentionally one-at-a-time. Older still-active tokens
  // can't be used after a fresh request.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data:  { usedAt: new Date() },
  })

  const rawToken  = generateSecureToken(48)
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  return { rawToken, expiresAt, email: user.email, firstName: user.firstName }
}

/** Step 2 of forgot-password flow. Verifies the raw token, checks TTL +
 *  single-use, sets new password, marks token used, and revokes ALL the
 *  user's existing refresh tokens (forces re-login everywhere — same as
 *  changePassword). */
export async function completePasswordReset(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken)
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  if (!record) throw new AppError('UNAUTHORIZED', 'Reset link is invalid or expired', 401)
  if (record.usedAt)            throw new AppError('UNAUTHORIZED', 'Reset link has already been used', 401)
  if (record.expiresAt < new Date()) throw new AppError('UNAUTHORIZED', 'Reset link has expired', 401)

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Force re-login on all devices
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    }),
  ])
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
  preferredTimezone?: string | null
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
    preferredTimezone: user.preferredTimezone ?? null,
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
