import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { verifyEmail } from './reoon.service.js'

export async function listContacts(tenantId: string, opts: {
  search?: string; page?: number; limit?: number
  /** Filter by pipeline stage id. `'unstaged'` returns contacts not placed on
   *  the pipeline (legacy data + edge cases). Omit to return all stages. */
  stageId?: string
}) {
  const { search, page = 1, limit = 50, stageId } = opts
  const where = {
    tenantId,
    ...(search ? {
      OR: [
        { fullName:  { contains: search, mode: 'insensitive' as const } },
        { email:     { contains: search, mode: 'insensitive' as const } },
        { phoneE164: { contains: search } },
      ],
    } : {}),
    ...(stageId === 'unstaged'
      ? { pipelineStageId: null }
      : stageId
        ? { pipelineStageId: stageId }
        : {}),
  }
  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: { pipelineStage: { select: { id: true, name: true, color: true, sortOrder: true } } },
    }),
    prisma.contact.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getContact(tenantId: string, id: string) {
  return prisma.contact.findFirst({
    where:   { id, tenantId },
    include: { pipelineStage: { select: { id: true, name: true, color: true, sortOrder: true } } },
  })
}

/**
 * Phase F.1 — every newly-created contact is auto-placed on the pipeline at
 * the first stage so the kanban view shows the new row immediately. Skipped
 * silently when the tenant has no pipeline (e.g. seeding failed on signup).
 */
export async function createContact(tenantId: string, data: {
  firstName?: string; lastName?: string; fullName?: string
  email?: string; phoneE164?: string; source?: string
  addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string
}) {
  // Verify email in background — non-blocking save, then update status
  const contact = await prisma.contact.create({
    data: {
      tenantId,
      firstName:    data.firstName,
      lastName:     data.lastName,
      fullName:     data.fullName ?? ([data.firstName, data.lastName].filter(Boolean).join(' ') || null),
      email:        data.email,
      phoneE164:    data.phoneE164,
      addressLine1: data.addressLine1,
      city:         data.city,
      region:       data.region,
      postalCode:   data.postalCode,
      country:      data.country,
      source:       data.source ?? 'manual',
      emailStatus:  data.email ? 'unchecked' : null,
      phoneStatus:  data.phoneE164 ? 'unchecked' : null,
    },
  })

  // Run Reoon verification async — doesn't block the response
  if (data.email) {
    verifyEmail(data.email).then(({ status }) => {
      prisma.contact.update({
        where: { id: contact.id },
        data: {
          emailStatus:     status,
          emailVerifiedAt: status === 'valid' ? new Date() : null,
        },
      }).catch(() => {})
    }).catch(() => {})
  }

  // Phase F.1 — place the new contact on the CRM pipeline at the first stage.
  // Fire-and-forget; never blocks the response. No-op when tenant has no
  // pipeline yet (seed failed) or the contact is somehow already staged.
  import('./crm.service.js')
    .then(m => m.placeNewContactOnPipeline({ kind: 'tenant', tenantId }, contact.id))
    .catch(err => console.warn('[contact] pipeline placement failed:', (err as Error).message))

  return contact
}

export async function updateContact(tenantId: string, id: string, data: {
  firstName?: string; lastName?: string; fullName?: string
  email?: string; phoneE164?: string
  addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string
  // CRM relationship fields — null clears, undefined leaves untouched, value writes
  birthday?: string | Date | null
  anniversary?: string | Date | null
  spouseName?: string
  kidsInfoJson?: unknown
  petsInfoJson?: unknown
  importantDatesJson?: unknown
  hobbies?: string
  preferredContactTime?: string
  customerSince?: string | Date | null
  personalNotes?: string
}) {
  const contact = await prisma.contact.findFirst({ where: { id, tenantId }, select: { email: true } })

  // Build the update payload carefully — date strings need parsing, JSON
  // fields use Prisma.JsonNull as the explicit clear sentinel, empty strings
  // on optional text fields clear them. Undefined keys are dropped so we
  // don't blow away fields the caller didn't touch.
  const update: Record<string, unknown> = { updatedAt: new Date() }
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    if (k === 'birthday' || k === 'anniversary' || k === 'customerSince') {
      update[k] = v === null || v === '' ? null : (typeof v === 'string' ? new Date(v) : v)
    } else if (k === 'kidsInfoJson' || k === 'petsInfoJson' || k === 'importantDatesJson') {
      update[k] = v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue)
    } else if (typeof v === 'string') {
      update[k] = v.trim() === '' ? null : v
    } else {
      update[k] = v
    }
  }

  await prisma.contact.updateMany({
    where: { id, tenantId },
    data:  update as Prisma.ContactUpdateManyMutationInput,
  })

  // Re-verify if email changed
  if (data.email && data.email !== contact?.email) {
    verifyEmail(data.email).then(({ status }) => {
      prisma.contact.updateMany({
        where: { id, tenantId },
        data: {
          emailStatus:     status,
          emailVerifiedAt: status === 'valid' ? new Date() : null,
        },
      }).catch(() => {})
    }).catch(() => {})
  }
}

export async function deleteContact(tenantId: string, id: string) {
  await prisma.contact.deleteMany({ where: { id, tenantId } })
}
