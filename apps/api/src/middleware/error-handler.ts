import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '@voiceautomation/shared'
import type { ApiErrorResponse } from '@voiceautomation/types'
import { writeAuditLog } from '../lib/audit.js'
import { captureError } from '../lib/sentry.js'

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

  const e = err as Error
  const message = e?.message ?? ''

  // CORS origin rejections are correct security blocks, not unhandled errors.
  // Vulnerability scanners and misconfigured clients hit us constantly from
  // un-allowlisted origins; logging each rejection as system.error.unhandled
  // floods the audit log and makes the platform look unhealthy when it's
  // actually working as designed. Treat as a warning and respond 403 without
  // an audit row.
  if (message.startsWith('CORS: origin ')) {
    console.warn('[api] CORS rejected:', message, req.method, req.originalUrl)
    res.status(403).json({
      errors: [{ code: 'CORS_REJECTED', message: 'Origin not allowed' }],
    })
    return
  }

  console.error('[api] unhandled error:', err)
  // Report to Sentry (no-op when unconfigured) — grouped, alertable.
  captureError(err, { method: req.method, path: req.originalUrl })
  // Persist unhandled errors to AuditLog so admins can see what's
  // breaking without SSH'ing into the container.
  writeAuditLog({
    actorType: 'SYSTEM',
    action:    'system.error.unhandled',
    metadataJson: {
      method:  req.method,
      path:    req.originalUrl,
      message: message || 'unknown',
      stack:   e?.stack?.slice(0, 2000) ?? null,
      tenantId: (req as any).user?.currentTenantId ?? null,
    },
  }).catch(() => null)

  const body: ApiErrorResponse = {
    errors: [{ code: 'INTERNAL_ERROR', message: 'An internal error occurred' }],
  }
  res.status(500).json(body)
}
