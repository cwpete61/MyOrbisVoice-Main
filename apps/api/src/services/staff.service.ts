import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { startStaffGoogleOAuth, handleStaffGoogleCallback, disconnectStaffGoogle } from './google.service.js'

export async function listStaff(tenantId: string) {
  return prisma.staffMember.findMany({
    where: { tenantId },
    include: {
      integrationConnection: {
        select: { status: true, externalEmail: true, lastVerifiedAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

type StaffCreateData = { name: string; title?: string; department?: string; email?: string; phone?: string; timezone?: string; phoneExtension?: string }
type StaffUpdateData = Partial<StaffCreateData & { isActive: boolean; availabilityJson: object }>

export async function getStaffMember(tenantId: string, staffId: string) {
  const member = await prisma.staffMember.findFirst({
    where: { id: staffId, tenantId },
    include: { integrationConnection: { select: { status: true, externalEmail: true, lastVerifiedAt: true } } },
  })
  if (!member) throw new AppError('NOT_FOUND', 'Staff member not found', 404)
  return member
}

export async function createStaffMember(tenantId: string, data: StaffCreateData) {
  const seats = await prisma.tenantEntitlement.findFirst({ where: { tenantId, key: 'max_seats' } })
  const max = seats?.integerValue ?? 1
  const current = await prisma.staffMember.count({ where: { tenantId, isActive: true } })
  if (current >= max) {
    throw new AppError('SEATS_LIMIT_REACHED', `Your plan allows ${max} seat${max === 1 ? '' : 's'}. Contact support to add more.`, 403)
  }
  return prisma.staffMember.create({ data: { tenantId, ...data } })
}

export async function updateStaffMember(tenantId: string, staffId: string, data: StaffUpdateData) {
  const member = await prisma.staffMember.findFirst({ where: { id: staffId, tenantId } })
  if (!member) throw new AppError('NOT_FOUND', 'Staff member not found', 404)
  return prisma.staffMember.update({ where: { id: staffId }, data })
}

export async function deleteStaffMember(tenantId: string, staffId: string, actorUserId: string) {
  const member = await prisma.staffMember.findFirst({ where: { id: staffId, tenantId } })
  if (!member) throw new AppError('NOT_FOUND', 'Staff member not found', 404)
  if (member.integrationConnectionId) {
    await disconnectStaffGoogle(tenantId, staffId, actorUserId).catch(() => null)
  }
  return prisma.staffMember.delete({ where: { id: staffId } })
}

export { startStaffGoogleOAuth, handleStaffGoogleCallback, disconnectStaffGoogle }
