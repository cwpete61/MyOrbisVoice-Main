import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export async function listCampaigns(tenantId: string) {
  return prisma.outboundCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { attempts: true } } },
  })
}

export async function getCampaign(tenantId: string, id: string) {
  return prisma.outboundCampaign.findFirst({
    where: { id, tenantId },
    include: {
      attempts: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { contact: { select: { id: true, fullName: true, phoneE164: true } } },
      },
      _count: { select: { attempts: true } },
    },
  })
}

export async function createCampaign(tenantId: string, data: {
  name: string; description?: string
  audienceJson?: Record<string, unknown>; scheduleJson?: Record<string, unknown>
  promptVersionId?: string
}) {
  return prisma.outboundCampaign.create({
    data: {
      tenantId,
      name:            data.name,
      description:     data.description,
      status:          'DRAFT',
      audienceJson:    (data.audienceJson ?? {}) as Prisma.InputJsonValue,
      scheduleJson:    (data.scheduleJson ?? {}) as Prisma.InputJsonValue,
      promptVersionId: data.promptVersionId,
    },
  })
}

export async function updateCampaign(tenantId: string, id: string, data: {
  name?: string; description?: string
  audienceJson?: Record<string, unknown>; scheduleJson?: Record<string, unknown>
  promptVersionId?: string
}) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  if (campaign.status === 'RUNNING') throw new AppError('CONFLICT', 'Cannot edit a running campaign', 409)
  return prisma.outboundCampaign.update({
    where: { id },
    data: {
      ...data,
      audienceJson: data.audienceJson !== undefined ? (data.audienceJson as Prisma.InputJsonValue) : undefined,
      scheduleJson: data.scheduleJson !== undefined ? (data.scheduleJson as Prisma.InputJsonValue) : undefined,
    },
  })
}

export async function launchCampaign(tenantId: string, id: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  if (!['DRAFT', 'PAUSED'].includes(campaign.status)) {
    throw new AppError('CONFLICT', `Campaign is ${campaign.status} — cannot launch`, 409)
  }
  return prisma.outboundCampaign.update({ where: { id }, data: { status: 'RUNNING' } })
}

export async function pauseCampaign(tenantId: string, id: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  if (campaign.status !== 'RUNNING') throw new AppError('CONFLICT', 'Campaign is not running', 409)
  return prisma.outboundCampaign.update({ where: { id }, data: { status: 'PAUSED' } })
}

export async function cancelCampaign(tenantId: string, id: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  if (campaign.status === 'COMPLETED') throw new AppError('CONFLICT', 'Campaign already completed', 409)
  return prisma.outboundCampaign.update({ where: { id }, data: { status: 'CANCELED' } })
}

export async function addContactsToCampaign(tenantId: string, campaignId: string, contactIds: string[]) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)

  const existing = await prisma.outboundCallAttempt.findMany({
    where: { campaignId, contactId: { in: contactIds } },
    select: { contactId: true },
  })
  const existingIds = new Set(existing.map(e => e.contactId))
  const toAdd = contactIds.filter(id => !existingIds.has(id))

  if (toAdd.length === 0) return { added: 0 }

  await prisma.outboundCallAttempt.createMany({
    data: toAdd.map(contactId => ({
      campaignId,
      tenantId,
      contactId,
      status: 'PENDING',
      attemptNumber: 1,
    })),
  })
  return { added: toAdd.length }
}

export async function getAttemptStats(campaignId: string) {
  const groups = await prisma.outboundCallAttempt.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  })
  return Object.fromEntries(groups.map(g => [g.status, g._count]))
}
