import { prisma } from '../lib/prisma.js'

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
}) {
  return prisma.contact.create({
    data: {
      tenantId,
      firstName: data.firstName,
      lastName:  data.lastName,
      fullName:  data.fullName ?? ([data.firstName, data.lastName].filter(Boolean).join(' ') || null),
      email:     data.email,
      phoneE164: data.phoneE164,
      source:    data.source ?? 'manual',
    },
  })
}

export async function updateContact(tenantId: string, id: string, data: {
  firstName?: string; lastName?: string; fullName?: string
  email?: string; phoneE164?: string
}) {
  return prisma.contact.updateMany({
    where: { id, tenantId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  })
}

export async function deleteContact(tenantId: string, id: string) {
  await prisma.contact.deleteMany({ where: { id, tenantId } })
}
