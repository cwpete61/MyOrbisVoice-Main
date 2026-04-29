import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const adminUpdateTenantSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  legalName: z.string().max(200).optional().nullable(),
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'ARCHIVED']).optional(),
  timezone: z.string().max(60).optional(),
})

export async function listTenants(params: { search?: string; status?: string; limit?: number; offset?: number }) {
  const { search, status, limit = 50, offset = 0 } = params

  const where = {
    deletedAt: null,
    ...(status && { status: status as 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'ARCHIVED' }),
    ...(search && {
      OR: [
        { displayName: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
        { registrationEmail: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, displayName: true, status: true,
        registrationEmail: true, createdAt: true, updatedAt: true,
        _count: { select: { members: true, conversations: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ])

  return { tenants, total, limit, offset }
}

export async function getTenantDetail(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      businessProfile: true,
      members: {
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } }, roleDefinition: true },
      },
      integrationConnections: { select: { id: true, provider: true, status: true, label: true, lastVerifiedAt: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
      tenantEntitlements: true,
      _count: { select: { conversations: true, appointments: true, contacts: true } },
    },
  })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)
  return tenant
}

export async function adminUpdateTenant(tenantId: string, adminUserId: string, data: z.infer<typeof adminUpdateTenantSchema>) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({ where: { id: tenantId }, data })
    await tx.auditLog.create({
      data: {
        tenantId,
        actorType: 'ADMIN',
        actorUserId: adminUserId,
        action: 'admin.tenant.updated',
        targetType: 'Tenant',
        targetId: tenantId,
        metadataJson: { changes: data },
      },
    })
    return updated
  })
}

export async function suspendTenant(tenantId: string, adminUserId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)
  if (tenant.status === 'SUSPENDED') throw new AppError('CONFLICT', 'Tenant is already suspended', 409)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } })
    await tx.auditLog.create({
      data: {
        tenantId,
        actorType: 'ADMIN',
        actorUserId: adminUserId,
        action: 'admin.tenant.suspended',
        targetType: 'Tenant',
        targetId: tenantId,
      },
    })
    return updated
  })
}

export async function restoreTenant(tenantId: string, adminUserId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new AppError('NOT_FOUND', 'Tenant not found', 404)
  if (tenant.status !== 'SUSPENDED') throw new AppError('CONFLICT', 'Tenant is not suspended', 409)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } })
    await tx.auditLog.create({
      data: {
        tenantId,
        actorType: 'ADMIN',
        actorUserId: adminUserId,
        action: 'admin.tenant.restored',
        targetType: 'Tenant',
        targetId: tenantId,
      },
    })
    return updated
  })
}
