import { prisma } from '../lib/prisma.js'
import { verifyEmail } from './reoon.service.js'

export async function listContacts(tenantId: string, opts: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 50 } = opts
  const where = {
    tenantId,
    ...(search ? {
      OR: [
        { fullName:  { contains: search, mode: 'insensitive' as const } },
        { email:     { contains: search, mode: 'insensitive' as const } },
        { phoneE164: { contains: search } },
      ],
    } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.contact.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getContact(tenantId: string, id: string) {
  return prisma.contact.findFirst({ where: { id, tenantId } })
}

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

  return contact
}

export async function updateContact(tenantId: string, id: string, data: {
  firstName?: string; lastName?: string; fullName?: string
  email?: string; phoneE164?: string
  addressLine1?: string; city?: string; region?: string; postalCode?: string; country?: string
}) {
  const contact = await prisma.contact.findFirst({ where: { id, tenantId }, select: { email: true } })

  await prisma.contact.updateMany({
    where: { id, tenantId },
    data: { ...data, updatedAt: new Date() },
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
