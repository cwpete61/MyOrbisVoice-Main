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

// If the token was issued without a tenantId (e.g. during a rate-limited login session),
// fall back to a DB lookup so the user isn't permanently locked out.
export function requireTenantContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  if (req.user.isPlatformRole || req.user.currentTenantId) { next(); return }

  // Token has no tenantId — attempt DB recovery before blocking
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
