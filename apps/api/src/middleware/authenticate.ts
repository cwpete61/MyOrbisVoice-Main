import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'
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

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    next(Errors.unauthorized())
    return
  }
  const token = authHeader.slice(7)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    next(Errors.unauthorized('Invalid or expired token'))
    return
  }

  // Impersonation tokens are revocable server-side: if the session was ended
  // (endedAt set) or deleted, stop authorizing immediately — don't wait for the
  // 15-minute token exp. Only hits the DB when the token actually carries a
  // session id, so normal requests are unaffected.
  if (payload.impersonationSessionId) {
    try {
      const session = await prisma.impersonationSession.findUnique({
        where: { id: payload.impersonationSessionId },
        select: { endedAt: true },
      })
      if (!session || session.endedAt) {
        next(Errors.unauthorized('Impersonation session has ended'))
        return
      }
    } catch {
      next(Errors.unauthorized('Could not validate impersonation session'))
      return
    }
  }

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
}
