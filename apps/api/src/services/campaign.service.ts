import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const createCampaignSchema = z.object({
  templateId:          z.string().optional(),
  campaignType:        z.string(),
  name:                z.string().min(1).max(100),
  description:         z.string().optional(),
  prompt:              z.string().min(1),
  triggerTag:          z.string().min(1).max(80),
  delayHours:          z.number().int().min(0).default(1),
  maxRetries:          z.number().int().min(0).max(10).default(2),
  retryIntervalHours:  z.number().int().min(1).default(24),
  isActive:            z.boolean().default(false),
  exitOnReply:         z.boolean().default(true),
  exitOnOptOut:        z.boolean().default(true),
})

export const updateCampaignSchema = createCampaignSchema.partial()

export async function listTemplates() {
  return prisma.campaignTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ vertical: 'asc' }, { name: 'asc' }],
  })
}

export async function listCampaigns(tenantId: string) {
  return prisma.campaign.findMany({
    where: { tenantId },
    include: {
      template: { select: { name: true, vertical: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    include: {
      template: true,
      _count: { select: { enrollments: true } },
    },
  })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  return campaign
}

export async function createCampaign(tenantId: string, data: z.infer<typeof createCampaignSchema>) {
  const existing = await prisma.campaign.findFirst({
    where: { tenantId, triggerTag: data.triggerTag },
  })
  if (existing) {
    throw new AppError('CONFLICT', `A campaign with trigger tag "${data.triggerTag}" already exists`, 409)
  }
  return prisma.campaign.create({
    data: { tenantId, ...data, campaignType: data.campaignType as any },
    include: { template: { select: { name: true, vertical: true } } },
  })
}

export async function updateCampaign(tenantId: string, campaignId: string, data: z.infer<typeof updateCampaignSchema>) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)

  if (data.triggerTag && data.triggerTag !== campaign.triggerTag) {
    const conflict = await prisma.campaign.findFirst({
      where: { tenantId, triggerTag: data.triggerTag, id: { not: campaignId } },
    })
    if (conflict) throw new AppError('CONFLICT', `Tag "${data.triggerTag}" is already used by another campaign`, 409)
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { ...data, campaignType: data.campaignType as any },
    include: { template: { select: { name: true, vertical: true } } },
  })
}

export async function deleteCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
  await prisma.campaign.delete({ where: { id: campaignId } })
}

export async function applyTag(tenantId: string, contactId: string, tag: string) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
  if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

  const campaign = await prisma.campaign.findFirst({
    where: { tenantId, triggerTag: tag, isActive: true },
  })

  const existingTags: string[] = Array.isArray(contact.tagsJson) ? contact.tagsJson as string[] : []
  if (!existingTags.includes(tag)) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { tagsJson: [...existingTags, tag] },
    })
  }

  if (!campaign) return { enrolled: false, tag }

  const scheduledCallAt = new Date(Date.now() + campaign.delayHours * 60 * 60 * 1000)

  const enrollment = await prisma.campaignEnrollment.upsert({
    where: { campaignId_contactId: { campaignId: campaign.id, contactId } },
    update: {
      status: 'PENDING',
      triggerTag: tag,
      triggeredAt: new Date(),
      scheduledCallAt,
      attemptCount: 0,
      completedAt: null,
      exitReason: null,
    },
    create: {
      tenantId,
      campaignId: campaign.id,
      contactId,
      triggerTag: tag,
      scheduledCallAt,
      status: 'PENDING',
    },
  })

  return { enrolled: true, tag, campaign: { id: campaign.id, name: campaign.name }, enrollment }
}

export async function removeTag(tenantId: string, contactId: string, tag: string) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
  if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

  const existingTags: string[] = Array.isArray(contact.tagsJson) ? contact.tagsJson as string[] : []
  await prisma.contact.update({
    where: { id: contactId },
    data: { tagsJson: existingTags.filter(t => t !== tag) },
  })

  await prisma.campaignEnrollment.updateMany({
    where: { tenantId, contactId, triggerTag: tag, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { status: 'CANCELLED', exitReason: 'tag_removed', completedAt: new Date() },
  })

  return { removed: true, tag }
}

export async function listEnrollments(tenantId: string, campaignId?: string, status?: string) {
  return prisma.campaignEnrollment.findMany({
    where: {
      tenantId,
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phoneE164: true } },
      campaign: { select: { id: true, name: true, campaignType: true } },
    },
    orderBy: { triggeredAt: 'desc' },
    take: 200,
  })
}

export async function updateTenantVertical(tenantId: string, vertical: string) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: { industryVertical: vertical as any },
    select: { id: true, industryVertical: true },
  })
}
