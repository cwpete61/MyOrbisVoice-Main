import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import type { AuthUser } from '@voiceautomation/types'
import { Errors } from '@voiceautomation/shared'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    next(Errors.unauthorized())
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    req.user = {
      id: payload.sub,
      email: payload.email,
      firstName: null,
      lastName: null,
      status: 'ACTIVE',
      currentTenantId: payload.tenantId,
      roleKey: payload.roleKey,
      isPlatformRole: payload.isPlatformRole,
      impersonatedBy: payload.impersonatedBy,
      impersonationSessionId: payload.impersonationSessionId,
    }
    next()
  } catch {
    next(Errors.unauthorized('Invalid or expired token'))
  }
}
