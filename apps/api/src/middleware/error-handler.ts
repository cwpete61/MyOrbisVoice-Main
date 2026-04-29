import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@voiceautomation/shared'
import type { ApiErrorResponse } from '@voiceautomation/types'

export function errorHandler(
  err: unknown,
  _req: Request,
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
  const body: ApiErrorResponse = {
    errors: [{ code: 'INTERNAL_ERROR', message: 'An internal error occurred' }],
  }
  res.status(500).json(body)
}
