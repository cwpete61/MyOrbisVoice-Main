/**
 * Email campaign service — partner-owned bulk send.
 *
 * Phase F.4 (Batch 2). State machine:
 *
 *   DRAFT ──┬─→ SCHEDULED (manual schedule) ──→ RUNNING (worker picks up at scheduledAt)
 *           │
 *           └─→ RUNNING (manual start, fires immediately within send window)
 *
 *   RUNNING ──→ PAUSED   (manual or auto on reputation crossing)
 *            ──→ COMPLETED (all recipients drained)
 *            ──→ FAILED    (provider repeatedly errored)
 *            ──→ CANCELED  (manual cancel)
 *
 * The worker (separate file) does the actual drip-sending. This service
 * owns CRUD + state transitions + recipient bulk-loading.
 *
 * Recipient source today: partner's own CRM Contacts. Future (F.5): scraped
 * lead lists. The EmailCampaignRecipient row snapshots email + name at queue
 * time so a contact rename mid-campaign doesn't corrupt the send.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { checkSuppression } from './email-suppression.service.js'
import { getPartnerPolicy } from './email-bulk-policy.service.js'

export type CampaignScope =
  | { kind: 'partner'; partnerId: string; hostingTenantId: string }
  | { kind: 'tenant';  tenantId: string }

function scopeWhere(scope: CampaignScope): Prisma.EmailCampaignWhereInput {
  return scope.kind === 'partner'
    ? { partnerId: scope.partnerId }
    : { tenantId:  scope.tenantId, partnerId: null }
}

export async function listCampaigns(scope: CampaignScope, opts: { limit?: number; offset?: number; status?: string } = {}) {
  const limit  = Math.min(opts.limit  ?? 50, 200)
  const offset = opts.offset ?? 0
  const where: Prisma.EmailCampaignWhereInput = scopeWhere(scope)
  if (opts.status) where.status = opts.status as any

  const [items, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.emailCampaign.count({ where }),
  ])
  return { items, total, limit, offset }
}

export async function getCampaign(scope: CampaignScope, id: string) {
  return prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    include: {
      _count: { select: { recipients: true } },
    },
  })
}

export async function createCampaign(scope: CampaignScope, data: {
  name: string
  subject: string
  bodyText: string
  bodyHtml?: string
  fromName?: string
  scheduledAt?: Date | null
}) {
  // Hosting tenant is the column the table wants; partners use their resolved
  // hosting tenant id, tenants use their own.
  const tenantId = scope.kind === 'partner' ? scope.hostingTenantId : scope.tenantId

  return prisma.emailCampaign.create({
    data: {
      tenantId,
      partnerId:  scope.kind === 'partner' ? scope.partnerId : null,
      name:       data.name.slice(0, 120),
      subject:    data.subject.slice(0, 200),
      bodyText:   data.bodyText,
      bodyHtml:   data.bodyHtml ?? null,
      fromName:   data.fromName ?? null,
      status:     data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: data.scheduledAt ?? null,
    },
  })
}

export async function updateCampaign(scope: CampaignScope, id: string, patch: {
  name?: string
  subject?: string
  bodyText?: string
  bodyHtml?: string | null
  fromName?: string | null
  scheduledAt?: Date | null
}) {
  // Only DRAFT and SCHEDULED can be edited. RUNNING/PAUSED/etc. are locked.
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { status: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status !== 'DRAFT' && camp.status !== 'SCHEDULED') {
    throw new Error(`Cannot edit campaign in state ${camp.status}`)
  }
  const data: any = {}
  if (patch.name        !== undefined) data.name        = patch.name.slice(0, 120)
  if (patch.subject     !== undefined) data.subject     = patch.subject.slice(0, 200)
  if (patch.bodyText    !== undefined) data.bodyText    = patch.bodyText
  if (patch.bodyHtml    !== undefined) data.bodyHtml    = patch.bodyHtml
  if (patch.fromName    !== undefined) data.fromName    = patch.fromName
  if (patch.scheduledAt !== undefined) {
    data.scheduledAt = patch.scheduledAt
    data.status      = patch.scheduledAt ? 'SCHEDULED' : 'DRAFT'
  }

  return prisma.emailCampaign.update({ where: { id }, data })
}

/** Bulk-add recipients from partner CRM contacts. Pre-filters suppressed
 *  addresses so they don't even enter the queue (count returned as `skipped`).
 *  Dedupes against existing recipients on the campaign so re-adding the same
 *  contact is safe. */
export async function addRecipientsFromContacts(scope: CampaignScope, campaignId: string, contactIds: string[]) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id: campaignId, ...scopeWhere(scope) },
    select: { id: true, status: true, partnerId: true, tenantId: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status === 'COMPLETED' || camp.status === 'CANCELED' || camp.status === 'FAILED') {
    throw new Error(`Cannot add recipients to ${camp.status} campaign`)
  }

  // Pull the contacts that actually belong to this scope.
  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: contactIds },
      ...(camp.partnerId
        ? { partnerId: camp.partnerId }
        : { tenantId: camp.tenantId, partnerId: null }),
      // Skip contacts who opted out of email at the contact level.
      optedOutEmail: false,
      email:         { not: null },
      // Skip soft-deleted contacts. A deleted contact must never receive
      // outbound email — the deletion is the user's signal to stop.
      deletedAt:     null,
    },
    select: { id: true, email: true, fullName: true, firstName: true, lastName: true },
  })

  let added     = 0
  let skipped   = 0
  let suppressed = 0
  for (const c of contacts) {
    if (!c.email) { skipped++; continue }
    const supp = await checkSuppression({
      email:     c.email,
      kind:      'marketing',
      tenantId:  camp.tenantId,
      partnerId: camp.partnerId,
    })
    if (supp.suppressed) { suppressed++; continue }
    try {
      await prisma.emailCampaignRecipient.create({
        data: {
          campaignId,
          contactId: c.id,
          email:     c.email.toLowerCase(),
          name:      c.fullName ?? ([c.firstName, c.lastName].filter(Boolean).join(' ') || null),
          status:    'PENDING',
        },
      })
      added++
    } catch (err) {
      // unique constraint (campaignId, email) — already queued; skip silently
      const e = err as { code?: string }
      if (e.code === 'P2002') skipped++
      else throw err
    }
  }

  // Update campaign totals.
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data:  {
      totalRecipients: { increment: added },
      skippedCount:    { increment: suppressed },
    },
  })

  return { added, skipped, suppressed }
}

export async function startCampaign(scope: CampaignScope, id: string) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { id: true, status: true, partnerId: true, totalRecipients: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status !== 'DRAFT' && camp.status !== 'SCHEDULED' && camp.status !== 'PAUSED') {
    throw new Error(`Cannot start campaign in state ${camp.status}`)
  }
  if (camp.totalRecipients === 0) throw new Error('Add at least one recipient before starting')

  // Partner check: bulk must be enabled + not suspended.
  if (camp.partnerId) {
    const policy = await getPartnerPolicy(camp.partnerId)
    if (!policy?.bulkEnabled) throw new Error('Bulk email is not enabled for this partner (admin gate)')
    if (policy.suspended)     throw new Error(`Partner bulk is suspended: ${policy.suspendedReason ?? 'admin action'}`)
  }

  await prisma.emailCampaign.update({
    where: { id },
    data:  {
      status:    'RUNNING',
      startedAt: new Date(),
    },
  })
}

export async function pauseCampaign(scope: CampaignScope, id: string, reason?: string) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { id: true, status: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status !== 'RUNNING') throw new Error(`Cannot pause campaign in state ${camp.status}`)
  await prisma.emailCampaign.update({
    where: { id },
    data:  { status: 'PAUSED', pausedReason: reason ?? 'manual' },
  })
}

export async function resumeCampaign(scope: CampaignScope, id: string) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { id: true, status: true, partnerId: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status !== 'PAUSED') throw new Error(`Cannot resume campaign in state ${camp.status}`)
  if (camp.partnerId) {
    const policy = await getPartnerPolicy(camp.partnerId)
    if (policy?.suspended) throw new Error(`Partner bulk is still suspended: ${policy.suspendedReason}`)
  }
  await prisma.emailCampaign.update({
    where: { id },
    data:  { status: 'RUNNING', pausedReason: null },
  })
}

export async function cancelCampaign(scope: CampaignScope, id: string) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { id: true, status: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status === 'COMPLETED' || camp.status === 'CANCELED' || camp.status === 'FAILED') {
    throw new Error(`Already ${camp.status}`)
  }
  await prisma.emailCampaign.update({
    where: { id },
    data:  { status: 'CANCELED', completedAt: new Date() },
  })
}

export async function deleteDraftCampaign(scope: CampaignScope, id: string) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id, ...scopeWhere(scope) },
    select: { id: true, status: true },
  })
  if (!camp) throw new Error('campaign not found')
  if (camp.status !== 'DRAFT' && camp.status !== 'SCHEDULED') {
    throw new Error(`Cannot delete campaign in state ${camp.status} — cancel it instead`)
  }
  // Cascade on FK deletes the recipients.
  await prisma.emailCampaign.delete({ where: { id } })
}

export async function listRecipients(scope: CampaignScope, campaignId: string, opts: { status?: string; limit?: number; offset?: number } = {}) {
  const camp = await prisma.emailCampaign.findFirst({
    where:  { id: campaignId, ...scopeWhere(scope) },
    select: { id: true },
  })
  if (!camp) throw new Error('campaign not found')

  const limit  = Math.min(opts.limit  ?? 100, 500)
  const offset = opts.offset ?? 0
  const where: Prisma.EmailCampaignRecipientWhereInput = { campaignId }
  if (opts.status) where.status = opts.status as any

  const [items, total] = await Promise.all([
    prisma.emailCampaignRecipient.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take:    limit,
      skip:    offset,
    }),
    prisma.emailCampaignRecipient.count({ where }),
  ])
  return { items, total, limit, offset }
}
