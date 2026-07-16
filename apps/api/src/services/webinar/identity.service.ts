/**
 * MyOrbisWebinar — deterministic person identity resolution (design §9 D4).
 *
 * Resolution order: email-exact → phone-exact → new. If email resolves to one
 * person and phone to a DIFFERENT person, they stay separate and the returned
 * person is flagged ambiguous — never auto-merged (silent merges corrupt the
 * attribution spine). Links to the Voice Contact (email/phone) when resolvable.
 */
import { prisma } from '../../lib/prisma.js'
import { normalizePhoneE164 } from '../contact.service.js'

export interface ResolveInput {
  tenantId: string
  email?: string | null
  phone?: string | null
  fullName?: string | null
}

const normEmail = (e?: string | null): string | undefined => {
  const v = (e ?? '').trim().toLowerCase()
  return v.length ? v : undefined
}

/** Best-effort link to a Voice CRM Contact by email then phone (same tenant). */
async function resolveContactId(tenantId: string, email?: string, phoneE164?: string): Promise<string | null> {
  if (email) {
    const c = await prisma.contact.findFirst({ where: { tenantId, email }, select: { id: true } })
    if (c) return c.id
  }
  if (phoneE164) {
    const c = await prisma.contact.findFirst({ where: { tenantId, phoneE164 }, select: { id: true } })
    if (c) return c.id
  }
  return null
}

export interface ResolvedPerson {
  id: string
  ambiguousFlag: boolean
  created: boolean
}

export async function resolvePerson(input: ResolveInput): Promise<ResolvedPerson> {
  const { tenantId, fullName } = input
  const email = normEmail(input.email)
  const phone = normalizePhoneE164(input.phone) // E164 or undefined

  if (!email && !phone) {
    throw new Error('resolvePerson requires at least an email or phone')
  }

  const [emailMatch, phoneMatch] = await Promise.all([
    email ? prisma.webinarPerson.findFirst({ where: { tenantId, normalizedEmail: email } }) : null,
    phone ? prisma.webinarPerson.findFirst({ where: { tenantId, normalizedPhone: phone } }) : null,
  ])

  // Both resolve, to different people → ambiguous. Return the email match
  // (email is the stronger identity), flag it, never merge.
  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    if (!emailMatch.ambiguousFlag) {
      await prisma.webinarPerson.update({ where: { id: emailMatch.id }, data: { ambiguousFlag: true } })
    }
    return { id: emailMatch.id, ambiguousFlag: true, created: false }
  }

  const existing = emailMatch ?? phoneMatch
  if (existing) {
    // Backfill missing identifiers / name / contact link on the matched person.
    const patch: Record<string, unknown> = {}
    if (email && !existing.normalizedEmail) { patch['email'] = input.email?.trim(); patch['normalizedEmail'] = email }
    if (phone && !existing.normalizedPhone) { patch['phone'] = input.phone?.trim(); patch['normalizedPhone'] = phone }
    if (fullName && !existing.fullName) patch['fullName'] = fullName
    if (!existing.contactId) {
      const cid = await resolveContactId(tenantId, email, phone)
      if (cid) patch['contactId'] = cid
    }
    if (Object.keys(patch).length) {
      await prisma.webinarPerson.update({ where: { id: existing.id }, data: patch })
    }
    return { id: existing.id, ambiguousFlag: existing.ambiguousFlag, created: false }
  }

  // New person.
  const contactId = await resolveContactId(tenantId, email, phone)
  const person = await prisma.webinarPerson.create({
    data: {
      tenantId,
      email: input.email?.trim() ?? null,
      normalizedEmail: email ?? null,
      phone: input.phone?.trim() ?? null,
      normalizedPhone: phone ?? null,
      fullName: fullName ?? null,
      contactId,
    },
    select: { id: true },
  })
  return { id: person.id, ambiguousFlag: false, created: true }
}
