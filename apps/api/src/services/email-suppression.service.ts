/**
 * Email suppression list — source of truth for "do not email."
 *
 * Phase F.4. Every send path (transactional + bulk) consults this BEFORE
 * handing off to the email provider. Three scopes, queried in priority
 * order from most-to-least specific:
 *
 *   1. Global   (tenantId NULL, partnerId NULL)
 *      Hard bounces and complaints get suppressed platform-wide. A proven-
 *      dead or proven-spam-complaint address shouldn't be retried by anyone.
 *
 *   2. Tenant   (tenantId set, partnerId NULL)
 *      Tenant-side "do not contact" lists. Used when a customer asks the
 *      tenant directly to stop, even if they haven't formally unsubscribed.
 *
 *   3. Partner  (partnerId set)
 *      Partner-scoped unsubscribes don't bleed across partners — two
 *      partners with different value props might legitimately deserve a
 *      different decision from the same prospect.
 *
 * Transactional emails (welcome, password reset, booking confirm) bypass
 * tenant- and partner-scope suppression but STILL respect global hard
 * bounces — there's no point retrying a dead mailbox.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export type EmailSendContext = {
  email:     string
  tenantId?: string | null
  partnerId?: string | null
  /** transactional skips tenant/partner scope but still hits global hard-bounce
   *  list. marketing/bulk respects every scope. */
  kind: 'transactional' | 'marketing'
}

export type SuppressionHit = {
  suppressed: true
  reason: 'HARD_BOUNCE' | 'COMPLAINT' | 'UNSUBSCRIBE' | 'MANUAL' | 'SOFT_BOUNCE_REPEATED'
  scope: 'global' | 'tenant' | 'partner'
  suppressionId: string
}

export type SuppressionMiss = { suppressed: false }

/**
 * Is this address suppressed for the given send context?
 *
 * Returns the most-specific hit (global > tenant > partner) when multiple
 * scopes match. Transactional sends only check global. Always normalizes
 * email to lowercase before lookup.
 */
export async function checkSuppression(ctx: EmailSendContext): Promise<SuppressionHit | SuppressionMiss> {
  const email = ctx.email.trim().toLowerCase()
  if (!email) return { suppressed: false }

  // Global — always checked.
  const globalHit = await prisma.emailSuppression.findFirst({
    where:  { email, tenantId: null, partnerId: null },
    select: { id: true, reason: true },
  })
  if (globalHit) {
    return { suppressed: true, reason: globalHit.reason, scope: 'global', suppressionId: globalHit.id }
  }

  // Transactional bypass — recipient still gets password reset, booking
  // confirms, etc. even if they've unsubscribed from marketing. Industry
  // standard + arguably legally required (CAN-SPAM exempts transactional).
  if (ctx.kind === 'transactional') return { suppressed: false }

  // Tenant scope
  if (ctx.tenantId) {
    const tenantHit = await prisma.emailSuppression.findFirst({
      where:  { email, tenantId: ctx.tenantId, partnerId: null },
      select: { id: true, reason: true },
    })
    if (tenantHit) {
      return { suppressed: true, reason: tenantHit.reason, scope: 'tenant', suppressionId: tenantHit.id }
    }
  }

  // Partner scope
  if (ctx.partnerId) {
    const partnerHit = await prisma.emailSuppression.findFirst({
      where:  { email, partnerId: ctx.partnerId },
      select: { id: true, reason: true },
    })
    if (partnerHit) {
      return { suppressed: true, reason: partnerHit.reason, scope: 'partner', suppressionId: partnerHit.id }
    }
  }

  return { suppressed: false }
}

export type AddSuppressionOpts = {
  email:     string
  reason:    'HARD_BOUNCE' | 'COMPLAINT' | 'UNSUBSCRIBE' | 'MANUAL' | 'SOFT_BOUNCE_REPEATED'
  tenantId?: string | null
  partnerId?: string | null
  note?:     string
}

/**
 * Add an address to the suppression list at the given scope. Idempotent —
 * re-adding the same address+scope is a no-op (no error, returns the
 * existing row's id). Always normalizes email to lowercase.
 *
 * Scope rules:
 *   - tenantId NULL + partnerId NULL → global
 *   - tenantId set + partnerId NULL → tenant-scope
 *   - partnerId set → partner-scope (tenantId is ignored)
 */
export async function addSuppression(opts: AddSuppressionOpts): Promise<{ id: string; created: boolean }> {
  const email = opts.email.trim().toLowerCase()
  if (!email) throw new Error('email is required')

  // Normalize scope: partner takes precedence; otherwise tenant; otherwise global.
  const scope: { tenantId: string | null; partnerId: string | null } = opts.partnerId
    ? { tenantId: null, partnerId: opts.partnerId }
    : opts.tenantId
      ? { tenantId: opts.tenantId, partnerId: null }
      : { tenantId: null, partnerId: null }

  const existing = await prisma.emailSuppression.findFirst({
    where:  { email, tenantId: scope.tenantId, partnerId: scope.partnerId },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  const row = await prisma.emailSuppression.create({
    data: {
      email,
      reason:    opts.reason,
      tenantId:  scope.tenantId,
      partnerId: scope.partnerId,
      note:      opts.note ?? null,
    },
    select: { id: true },
  })
  return { id: row.id, created: true }
}

/** Remove a suppression entry by id, scoped so a tenant/partner can only
 *  remove their own. Returns the number of rows deleted (0 or 1). */
export async function removeSuppression(opts: {
  id: string
  tenantId?: string | null
  partnerId?: string | null
}): Promise<number> {
  const where: Prisma.EmailSuppressionWhereInput = { id: opts.id }
  if (opts.partnerId) where.partnerId = opts.partnerId
  else if (opts.tenantId) { where.tenantId = opts.tenantId; where.partnerId = null }
  // No scope = admin-level delete. Caller is responsible for auth.

  const result = await prisma.emailSuppression.deleteMany({ where })
  return result.count
}

export type SuppressionListOpts = {
  tenantId?:  string | null
  partnerId?: string | null
  query?:     string
  limit?:     number
  offset?:    number
}

/** Paginated list of suppressions in the given scope. Search across the
 *  email column case-insensitively. */
export async function listSuppressions(opts: SuppressionListOpts) {
  const limit  = Math.min(opts.limit  ?? 50, 200)
  const offset = opts.offset ?? 0

  const where: Prisma.EmailSuppressionWhereInput = opts.partnerId
    ? { partnerId: opts.partnerId }
    : opts.tenantId !== undefined && opts.tenantId !== null
      ? { tenantId: opts.tenantId, partnerId: null }
      : {}  // admin/global — caller must auth
  if (opts.query) {
    where.email = { contains: opts.query.trim().toLowerCase() }
  }

  const [items, total] = await Promise.all([
    prisma.emailSuppression.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.emailSuppression.count({ where }),
  ])
  return { items, total, limit, offset }
}
