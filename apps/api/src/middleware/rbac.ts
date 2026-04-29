import type { Request, Response, NextFunction } from 'express'
import type { RoleKey } from '@voiceautomation/types'
import { Errors } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'

export function requireRole(...roles: RoleKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(Errors.unauthorized()); return }
    if (!roles.includes(req.user.roleKey)) { next(Errors.forbidden()); return }
    next()
  }
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  if (!req.user.isPlatformRole) { next(Errors.forbidden('Platform admin access required')); return }
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

export function requireTenantMatch(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(Errors.unauthorized()); return }
  const paramTenantId = req.params['tenantId']
  if (!paramTenantId) { next(); return }
  if (!req.user.isPlatformRole && req.user.currentTenantId !== paramTenantId) {
    next(Errors.forbidden('Tenant access denied'))
    return
  }
  next()
}
