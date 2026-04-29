import { createHash, randomBytes } from 'crypto'

// Crypto utilities
export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex')
}

export function generateTraceId(): string {
  return `tr_${randomBytes(12).toString('hex')}`
}

// Result type for service returns — avoids try/catch in calling code when desired
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error }
}

// Domain error class
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Named constructors for common errors
export const Errors = {
  unauthorized: (msg = 'Authentication required') => new AppError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Insufficient permissions') => new AppError('FORBIDDEN', msg, 403),
  notFound: (resource: string) => new AppError('NOT_FOUND', `${resource} not found`, 404),
  conflict: (msg: string) => new AppError('CONFLICT', msg, 409),
  validation: (msg: string, fields?: Record<string, string[]>) =>
    new AppError('VALIDATION_ERROR', msg, 422, fields),
  internal: () => new AppError('INTERNAL_ERROR', 'An internal error occurred', 500),
  badRequest: (msg: string) => new AppError('BAD_REQUEST', msg, 400),
} as const

// Slug generator
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Safe JSON parse — returns undefined instead of throwing
export function parseJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

// Mask sensitive string for logging (shows first 4 + last 4 chars)
export function maskSecret(value: string): string {
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}
