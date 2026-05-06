import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
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

  // Auto-convert any unhandled ZodError into a clean 422 VALIDATION_ERROR.
  // Routes can call schema.parse(req.body) directly; if validation fails,
  // the ZodError bubbles up here and gets formatted with fieldErrors so the
  // caller knows exactly which fields are wrong. Without this branch, Zod
  // failures leak to the catch-all 500 below — a real bug we hit repeatedly
  // during comp-codes / a2p development.
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'root'
      fields[key] = [...(fields[key] ?? []), issue.message]
    }
    res.status(422).json({
      errors: [{ code: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: fields }],
    })
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
