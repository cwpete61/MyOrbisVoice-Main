import type { Request, Response, NextFunction } from 'express'
import { Errors } from '@voiceautomation/shared'
import { ROLE_KEYS } from '@voiceautomation/types'
import { prisma } from '../lib/prisma.js'

/** Three platform roles, ranked from most → least privileged:
 *
 *    Super Admin  →  Admin  →  Support
 *
 *  Each guard below admits the named role AND every role above it.
 *  Guards are mutually inclusive on purpose (e.g. Super Admin passes
 *  every check) so route owners can use the most-permissive guard their
 *  endpoint needs, and tighter routes get tighter guards. */

/** Allow Super Admin only. Used for secret-rotation, account-email
 *  visibility, and platform team management. */
export function requirePlatformSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  if (req.user.roleKey !== ROLE_KEYS.PLATFORM_SUPER_ADMIN) {
    next(Errors.forbidden('Super admin access required'))
    return
  }
  next()
}

/** Allow Super Admin OR Platform Admin. Used for tenant
 *  suspend/restore, plan management, comp code generation, and most
 *  privileged writes. Explicitly EXCLUDES Platform Support. */
export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  const role = req.user.roleKey
  if (role !== ROLE_KEYS.PLATFORM_SUPER_ADMIN && role !== ROLE_KEYS.PLATFORM_ADMIN) {
    next(Errors.forbidden('Platform admin access required'))
    return
  }
  next()
}

/** Allow any platform-level role (Super Admin, Admin, OR Support). Used
 *  for read-only paths on the admin dashboard — tenant list, tenant
 *  detail, conversations, audit logs — that support staff need to do
 *  their job. Tighter writes still gated by requirePlatformAdmin or
 *  requirePlatformSuperAdmin. */
export function requirePlatformSupport(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  if (!req.user.isPlatformRole) {
    next(Errors.forbidden('Platform staff access required'))
    return
  }
  next()
}

/**
 * Guarantee a tenant context for every route behind it.
 *
 * The ~134 `req.user!.currentTenantId!` call sites downstream assert non-null on a
 * `string | null`. That assertion holds today only because of an invariant in
 * issueTokensForUserId: tenantId and isPlatformRole are both derived from the SAME
 * membership, so isPlatformRole === true implies tenantId !== null. Nothing enforces
 * or documents that coupling.
 *
 * It used to short-circuit on `isPlatformRole || currentTenantId`. Given the invariant
 * that branch was unreachable-with-null, so this is not a live-bug fix — it is a
 * guardrail. If a future token path ever set isPlatformRole with no tenantId (a new SSO
 * flow, a platform user without a membership), every one of those call sites would pass
 * `where: { tenantId: undefined }` to Prisma, which DROPS the filter and returns every
 * tenant's rows. Requiring a real tenantId here makes that fail closed with a 403
 * instead of leaking silently.
 *
 * Platform staff are unaffected: granting a platform role creates a TenantMember on the
 * platform tenant, so their tokens carry a tenantId. To act on a specific tenant they
 * impersonate (which mints a tenant-scoped token) — the same path as before.
 *
 * If the token was issued without a tenantId (e.g. during a rate-limited login session),
 * fall back to a DB lookup so the user isn't permanently locked out.
 */
export function requireTenantContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  if (req.user.currentTenantId) { next(); return }

  // No tenantId — attempt DB recovery before blocking. Applies to platform roles too:
  // a tenant route without a tenant is never safe to serve.
  prisma.tenantMember.findFirst({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true },
  }).then((membership) => {
    if (membership?.tenantId) {
      req.user!.currentTenantId = membership.tenantId
      next()
    } else {
      next(Errors.forbidden('No tenant context'))
    }
  }).catch(() => {
    next(Errors.forbidden('No tenant context'))
  })
}

/** Require that the authenticated user has an active Partner profile.
 *  Used by /api/partner/* routes — gates the Mailbox / Profile / Dashboard
 *  surfaces for the marketing-page partner program.
 *
 *  Adds `req.partnerAccountId` (the AffiliateAccount.id) so downstream
 *  handlers don't have to re-query for it.
 */
export function requirePartnerContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  prisma.affiliateAccount.findUnique({
    where: { userId: req.user.id },
    select: { id: true, slug: true, partnerPageActive: true, status: true },
  }).then((partner) => {
    if (!partner) { next(Errors.forbidden('No partner profile for this user')); return }
    if (partner.status !== 'ACTIVE') { next(Errors.forbidden(`Partner is ${partner.status.toLowerCase()}`)); return }
    if (!partner.slug) { next(Errors.forbidden('Partner profile incomplete — no slug')); return }
    ;(req as any).partnerAccountId = partner.id
    ;(req as any).partnerSlug = partner.slug
    next()
  }).catch((err) => {
    next(err)
  })
}

/** Soft variant of requirePartnerContext: only requires that an
 *  AffiliateAccount exists for the user. Allows non-ACTIVE / no-slug
 *  partners through so they can still view + edit their own profile while
 *  pending approval. Adds partnerAccountId, partnerSlug (may be null),
 *  and partnerStatus to req so handlers can react to incomplete state. */
export function requirePartnerAccount(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  prisma.affiliateAccount.findUnique({
    where: { userId: req.user.id },
    select: { id: true, slug: true, status: true },
  }).then((partner) => {
    if (!partner) { next(Errors.forbidden('No partner profile for this user')); return }
    ;(req as any).partnerAccountId = partner.id
    ;(req as any).partnerSlug = partner.slug
    ;(req as any).partnerStatus = partner.status
    next()
  }).catch((err) => {
    next(err)
  })
}
