import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@voiceautomation/shared'
import type { ApiErrorResponse } from '@voiceautomation/types'
import { writeAuditLog } from '../lib/audit.js'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      errors: [
        {
          code: err.code,
          message: err.message,
          ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
        },
      ],
    }
    res.status(err.status).json(body)
    return
  }

  console.error('[api] unhandled error:', err)
  // Persist unhandled errors to AuditLog so admins can see what's
  // breaking without SSH'ing into the container.
  const e = err as Error
  writeAuditLog({
    actorType: 'SYSTEM',
    action:    'system.error.unhandled',
    metadataJson: {
      method:  req.method,
      path:    req.originalUrl,
      message: e?.message ?? 'unknown',
      stack:   e?.stack?.slice(0, 2000) ?? null,
      tenantId: (req as any).user?.currentTenantId ?? null,
    },
  }).catch(() => null)

  const body: ApiErrorResponse = {
    errors: [{ code: 'INTERNAL_ERROR', message: 'An internal error occurred' }],
  }
  res.status(500).json(body)
}
