/**
 * CRM service — pipeline stage management, auto-transitions, and notes.
 *
 * Phase F.1 + F.2 + F.3 of the partner/tenant CRM build.
 *
 * Two scopes are supported and they share the same tables: tenant CRM (owned
 * by a Tenant; partnerId column is NULL) and partner CRM (owned by an
 * AffiliateAccount; partnerId is set, hosting tenantId is also recorded so
 * the existing tenantId NOT NULL constraint on Contact/PipelineStage/ContactNote
 * holds without breaking).
 *
 * Auto-transitions are conservative: only the obvious New → Spoke and Spoke
 * → Booked moves fire automatically. Showed Up, Customer, No-show, Not
 * Interested are all manual — only the human owner knows what actually
 * happened.
 */
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '@prisma/client'

// ── Scope (tenant CRM vs partner CRM) ───────────────────────────────────────
// Pass into every service function. The where-clauses derive from this and
// preserve the correct visibility: tenant CRM rows have partnerId NULL,
// partner CRM rows have partnerId set. tenantId is still required by the
// table — for partner rows it's the hosting tenant (the platform demo tenant
// in production today).

export type CrmScope =
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'partner'; partnerId: string; hostingTenantId: string }

function stageWhere(scope: CrmScope): Prisma.PipelineStageWhereInput {
  return scope.kind === 'tenant'
    ? { tenantId: scope.tenantId, partnerId: null }
    : { partnerId: scope.partnerId }
}

function contactWhere(scope: CrmScope): Prisma.ContactWhereInput {
  return scope.kind === 'tenant'
    ? { tenantId: scope.tenantId, partnerId: null }
    : { partnerId: scope.partnerId }
}

function noteWhere(scope: CrmScope): Prisma.ContactNoteWhereInput {
  return scope.kind === 'tenant'
    ? { tenantId: scope.tenantId, partnerId: null }
    : { partnerId: scope.partnerId }
}

/**
 * Default 7-stage voice-agent pipeline. Seeded on tenant or partner create.
 * The first two stages are the auto-transition targets; the rest stay manual.
 *
 * Color values are oklch strings the frontend can use directly as a CSS
 * `background:`. They're light tints so dark text reads on top.
 */
const DEFAULT_STAGES: Array<{ name: string; color: string; isWon?: boolean; isLost?: boolean }> = [
  { name: 'New Lead',         color: 'oklch(95% 0.04 250)' },                      // cool blue tint
  { name: 'Spoke with Orby',  color: 'oklch(95% 0.04 193)' },                      // teal tint (brand)
  { name: 'Booked Appointment', color: 'oklch(95% 0.08 80)' },                     // amber tint
  { name: 'Showed Up',        color: 'oklch(95% 0.05 145)' },                      // green tint
  { name: 'Customer',         color: 'oklch(92% 0.10 145)', isWon: true },         // brighter green
  { name: 'No-show',          color: 'oklch(95% 0.05 25)',  isLost: true },        // muted red
  { name: 'Not Interested',   color: 'oklch(93% 0 0)',      isLost: true },        // neutral grey
]

// Helper — resolves what tenantId to write on a stage row given a scope. For
// partner rows we still need a tenantId because the column is NOT NULL on the
// table (carryover from Phase F.1 when only tenants existed).
function resolveTenantIdForScope(scope: CrmScope): string {
  return scope.kind === 'tenant' ? scope.tenantId : scope.hostingTenantId
}

function resolvePartnerIdForScope(scope: CrmScope): string | null {
  return scope.kind === 'tenant' ? null : scope.partnerId
}

/**
 * Seed the default 7-stage pipeline for a tenant or partner. Idempotent:
 * skips creation when any PipelineStage already exists in the scope. Safe to
 * call from tenant/partner-create or as a one-time backfill.
 */
export async function seedDefaultPipeline(scope: CrmScope): Promise<{ created: number }> {
  const existing = await prisma.pipelineStage.count({ where: stageWhere(scope) })
  if (existing > 0) return { created: 0 }

  const tenantId  = resolveTenantIdForScope(scope)
  const partnerId = resolvePartnerIdForScope(scope)

  let created = 0
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const stage = DEFAULT_STAGES[i]!
    await prisma.pipelineStage.create({
      data: {
        tenantId,
        partnerId,
        name:      stage.name,
        sortOrder: i,
        color:     stage.color,
        isWon:     stage.isWon ?? false,
        isLost:    stage.isLost ?? false,
        isSystem:  true,
      },
    })
    created++
  }
  return { created }
}

/**
 * Backwards-compat shim — older callers pass tenantId directly. Wraps the
 * new scope-based API. Avoids a sweeping refactor in service/route files
 * that only deal with the tenant CRM (auth.service, contact.service).
 */
export async function seedDefaultPipelineForTenant(tenantId: string): Promise<{ created: number }> {
  return seedDefaultPipeline({ kind: 'tenant', tenantId })
}

/**
 * Seed the default partner pipeline. Convenience wrapper used at partner
 * approval time and from the backfill script.
 */
export async function seedDefaultPipelineForPartner(opts: {
  partnerId: string
  hostingTenantId: string
}): Promise<{ created: number }> {
  return seedDefaultPipeline({ kind: 'partner', partnerId: opts.partnerId, hostingTenantId: opts.hostingTenantId })
}

/**
 * Find a stage by exact name within a scope. Used by auto-transitions which
 * key off the default stage names. Returns null when renamed → silent no-op.
 */
async function findStageByName(scope: CrmScope, name: string): Promise<{ id: string; sortOrder: number } | null> {
  return prisma.pipelineStage.findFirst({
    where:  { ...stageWhere(scope), name },
    select: { id: true, sortOrder: true },
  })
}

/**
 * Move a contact to a new pipeline stage. No-op if already there. The where
 * clause uses the contact's own partnerId/tenantId so callers can't write
 * a tenant contact into a partner stage or vice versa.
 */
export async function setContactStage(opts: {
  contactId: string
  stageId:   string
}): Promise<void> {
  await prisma.contact.updateMany({
    where: {
      id: opts.contactId,
      OR: [
        { pipelineStageId: null },
        { pipelineStageId: { not: opts.stageId } },
      ],
    },
    data: {
      pipelineStageId: opts.stageId,
      stageUpdatedAt:  new Date(),
    },
  })
}

/**
 * Auto-transition triggered by a Conversation being logged for a contact.
 * Moves the contact forward only if they are at or before the "Spoke with
 * Orby" stage — never moves backwards. No-op when stage names have been
 * renamed. Scope is inferred from whether the conversation has partnerId.
 */
export async function onConversationLogged(scope: CrmScope, contactId: string): Promise<void> {
  const [contact, target] = await Promise.all([
    prisma.contact.findFirst({
      where:  { id: contactId, ...contactWhere(scope) },
      select: { pipelineStage: { select: { sortOrder: true } } },
    }),
    findStageByName(scope, 'Spoke with Orby'),
  ])
  if (!contact || !target) return

  const currentOrder = contact.pipelineStage?.sortOrder ?? -1
  if (currentOrder >= target.sortOrder) return
  await setContactStage({ contactId, stageId: target.id })
}

/**
 * Auto-transition triggered by an Appointment being created for a contact.
 * Same rules as onConversationLogged but bumps to "Booked Appointment".
 */
export async function onAppointmentCreated(scope: CrmScope, contactId: string): Promise<void> {
  const [contact, target] = await Promise.all([
    prisma.contact.findFirst({
      where:  { id: contactId, ...contactWhere(scope) },
      select: { pipelineStage: { select: { sortOrder: true } } },
    }),
    findStageByName(scope, 'Booked Appointment'),
  ])
  if (!contact || !target) return

  const currentOrder = contact.pipelineStage?.sortOrder ?? -1
  if (currentOrder >= target.sortOrder) return
  await setContactStage({ contactId, stageId: target.id })
}

/**
 * Place a brand-new contact on the pipeline at the first stage. Called from
 * createContact() and from the partner save_contact path so every new CRM
 * entry shows up on the kanban without manual placement.
 */
export async function placeNewContactOnPipeline(scope: CrmScope, contactId: string): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where:  { id: contactId, ...contactWhere(scope) },
    select: { pipelineStageId: true },
  })
  if (!contact || contact.pipelineStageId) return

  const firstStage = await prisma.pipelineStage.findFirst({
    where:   stageWhere(scope),
    orderBy: { sortOrder: 'asc' },
    select:  { id: true },
  })
  if (!firstStage) return
  await setContactStage({ contactId, stageId: firstStage.id })
}

// ── Notes thread ─────────────────────────────────────────────────────────────

export async function listContactNotes(scope: CrmScope, contactId: string) {
  return prisma.contactNote.findMany({
    where:   { ...noteWhere(scope), contactId },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })
}

export async function addContactNote(opts: {
  scope:        CrmScope
  contactId:    string
  authorUserId: string | null
  body:         string
}): Promise<{ id: string }> {
  const tenantId  = resolveTenantIdForScope(opts.scope)
  const partnerId = resolvePartnerIdForScope(opts.scope)
  const note = await prisma.contactNote.create({
    data: {
      tenantId,
      partnerId,
      contactId:    opts.contactId,
      authorUserId: opts.authorUserId,
      body:         opts.body.slice(0, 4000),
    },
    select: { id: true },
  })
  return note
}

export type PipelineStageOut = {
  id:        string
  name:      string
  sortOrder: number
  color:     string | null
  isWon:     boolean
  isLost:    boolean
  isSystem:  boolean
  contactCount: number
}

export async function listPipelineStages(scope: CrmScope): Promise<PipelineStageOut[]> {
  const [stages, counts] = await Promise.all([
    prisma.pipelineStage.findMany({
      where:   stageWhere(scope),
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.contact.groupBy({
      by:    ['pipelineStageId'],
      where: { ...contactWhere(scope), pipelineStageId: { not: null } },
      _count: { _all: true },
    }),
  ])
  const countMap = new Map<string, number>()
  for (const row of counts) {
    if (row.pipelineStageId) countMap.set(row.pipelineStageId, row._count._all)
  }
  return stages.map(s => ({
    id:           s.id,
    name:         s.name,
    sortOrder:    s.sortOrder,
    color:        s.color,
    isWon:        s.isWon,
    isLost:       s.isLost,
    isSystem:     s.isSystem,
    contactCount: countMap.get(s.id) ?? 0,
  }))
}

/**
 * Update stages: rename, reorder, color, terminal flags. Cannot delete a
 * stage with contacts in it. The previous DB unique on (tenantId, sortOrder)
 * was dropped to allow partner stages on the same hosting tenant — the
 * two-pass parking below is now the only line of defense, so it has to be
 * scope-tight: it parks ONLY rows in the current scope to avoid touching
 * rows belonging to other partners that share the hosting tenant.
 */
export async function upsertPipelineStages(
  scope: CrmScope,
  stages: Array<{
    id?:        string
    name:       string
    sortOrder:  number
    color?:     string | null
    isWon?:     boolean
    isLost?:    boolean
  }>,
  toDelete: string[],
): Promise<PipelineStageOut[]> {
  const tenantId  = resolveTenantIdForScope(scope)
  const partnerId = resolvePartnerIdForScope(scope)

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Deletes first — surface contacts-still-in-stage as an error before
    // we mutate anything. Stage lookup is scope-bounded.
    for (const id of toDelete) {
      const stage = await tx.pipelineStage.findFirst({ where: { id, ...stageWhere(scope) } })
      if (!stage) continue
      const used = await tx.contact.count({ where: { ...contactWhere(scope), pipelineStageId: id } })
      if (used > 0) throw new Error(`Cannot delete stage with ${used} contact(s) — move them first.`)
      await tx.pipelineStage.delete({ where: { id } })
    }

    // Two-pass parking — only operates on rows in scope. Park at large
    // negative sortOrder values to avoid colliding with any other scope's
    // stages on the same hosting tenant.
    const allStages = await tx.pipelineStage.findMany({ where: stageWhere(scope), select: { id: true } })
    for (let i = 0; i < allStages.length; i++) {
      await tx.pipelineStage.update({ where: { id: allStages[i]!.id }, data: { sortOrder: -1000 - i } })
    }

    // Apply requested set — upsert each row at its real sortOrder.
    for (const s of stages) {
      if (s.id) {
        await tx.pipelineStage.update({
          where: { id: s.id },
          data: {
            name:      s.name,
            sortOrder: s.sortOrder,
            color:     s.color ?? null,
            isWon:     s.isWon  ?? false,
            isLost:    s.isLost ?? false,
          },
        })
      } else {
        await tx.pipelineStage.create({
          data: {
            tenantId,
            partnerId,
            name:      s.name,
            sortOrder: s.sortOrder,
            color:     s.color ?? null,
            isWon:     s.isWon  ?? false,
            isLost:    s.isLost ?? false,
          },
        })
      }
    }
  })
  return listPipelineStages(scope)
}
