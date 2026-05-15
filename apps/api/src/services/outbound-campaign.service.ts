import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { dispatchPendingCalls } from './outbound.service.js'

// ── Schemas ───────────────────────────────────────────────────────────────────

export const createOutboundCampaignSchema = z.object({
  name:              z.string().min(1).max(100),
  description:       z.string().optional(),
  audienceJson:      z.record(z.unknown()).optional(),  // { contactIds: string[] } or tag filter
  scheduleJson:      z.record(z.unknown()).optional(),  // { scheduledAt, maxRetries, retryIntervalHours }
  promptVersionId:   z.string().optional(),
})

export const updateOutboundCampaignSchema = createOutboundCampaignSchema.partial()

export const addContactsSchema = z.object({
  contactIds: z.array(z.string()).min(1),
})

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listOutboundCampaigns(tenantId: string) {
  return prisma.outboundCampaign.findMany({
    where: { tenantId },
    include: {
      _count: { select: { attempts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOutboundCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({
    where: { id: campaignId, tenantId },
    include: {
      _count: { select: { attempts: true } },
    },
  })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  return campaign
}

export async function createOutboundCampaign(tenantId: string, data: z.infer<typeof createOutboundCampaignSchema>) {
  return prisma.outboundCampaign.create({
    data: {
      tenantId,
      name:            data.name,
      description:     data.description,
      audienceJson:    data.audienceJson as any,
      scheduleJson:    data.scheduleJson as any,
      promptVersionId: data.promptVersionId,
      status:          'DRAFT',
    },
  })
}

export async function updateOutboundCampaign(tenantId: string, campaignId: string, data: z.infer<typeof updateOutboundCampaignSchema>) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (campaign.status === 'RUNNING') throw new AppError('CONFLICT', 'Cannot edit a running campaign. Pause it first.', 409)

  return prisma.outboundCampaign.update({
    where: { id: campaignId },
    data: {
      name:            data.name,
      description:     data.description,
      audienceJson:    data.audienceJson as any,
      scheduleJson:    data.scheduleJson as any,
      promptVersionId: data.promptVersionId,
    },
  })
}

export async function deleteOutboundCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (campaign.status === 'RUNNING') throw new AppError('CONFLICT', 'Cannot delete a running campaign. Cancel it first.', 409)
  await prisma.outboundCampaign.delete({ where: { id: campaignId } })
}

// ── Contact Management ────────────────────────────────────────────────────────

export async function addContactsToCampaign(tenantId: string, campaignId: string, contactIds: string[]) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (!['DRAFT', 'PAUSED'].includes(campaign.status)) {
    throw new AppError('CONFLICT', 'Can only add contacts to a DRAFT or PAUSED campaign', 409)
  }

  // Verify contacts belong to tenant + are still active (no soft-deleted
  // contacts should be enrolled in outbound voice campaigns).
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, tenantId, deletedAt: null },
    select: { id: true },
  })
  const validIds = contacts.map(c => c.id)

  // Skip already-added contacts
  const existing = await prisma.outboundCallAttempt.findMany({
    where: { campaignId, contactId: { in: validIds } },
    select: { contactId: true },
  })
  const existingIds = new Set(existing.map(e => e.contactId))
  const newIds = validIds.filter(id => !existingIds.has(id))

  if (newIds.length === 0) return { added: 0 }

  await prisma.outboundCallAttempt.createMany({
    data: newIds.map(contactId => ({
      campaignId,
      tenantId,
      contactId,
      status:        'PENDING',
      attemptNumber: 1,
    })),
  })

  return { added: newIds.length }
}

export async function removeContactFromCampaign(tenantId: string, campaignId: string, contactId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)

  await prisma.outboundCallAttempt.deleteMany({
    where: { campaignId, contactId, tenantId, status: 'PENDING' },
  })
}

export async function listAttempts(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)

  return prisma.outboundCallAttempt.findMany({
    where: { campaignId },
    include: {
      contact: {
        select: { id: true, fullName: true, firstName: true, lastName: true, phoneE164: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ── State Transitions ─────────────────────────────────────────────────────────

export async function startCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
    throw new AppError('CONFLICT', `Cannot start campaign in status ${campaign.status}`, 409)
  }

  const pendingCount = await prisma.outboundCallAttempt.count({
    where: { campaignId, status: 'PENDING' },
  })
  if (pendingCount === 0) {
    throw new AppError('CONFLICT', 'No pending contacts to call. Add contacts first.', 409)
  }

  await prisma.outboundCampaign.update({
    where: { id: campaignId },
    data:  { status: 'RUNNING' },
  })

  // Fire off calls asynchronously — don't wait for all to complete
  dispatchPendingCalls(tenantId, campaignId).catch(err =>
    console.error('[outbound] dispatchPendingCalls error:', err)
  )

  return { status: 'RUNNING', pendingCount }
}

export async function pauseCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (campaign.status !== 'RUNNING') throw new AppError('CONFLICT', 'Campaign is not running', 409)

  await prisma.outboundCampaign.update({
    where: { id: campaignId },
    data:  { status: 'PAUSED' },
  })
  return { status: 'PAUSED' }
}

export async function cancelCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.outboundCampaign.findFirst({ where: { id: campaignId, tenantId } })
  if (!campaign) throw new AppError('NOT_FOUND', 'Outbound campaign not found', 404)
  if (['COMPLETED', 'CANCELED'].includes(campaign.status)) {
    throw new AppError('CONFLICT', `Campaign is already ${campaign.status}`, 409)
  }

  // Cancel pending attempts
  await prisma.outboundCallAttempt.updateMany({
    where: { campaignId, status: 'PENDING' },
    data:  { status: 'CANCELLED', outcomeCode: 'campaign_canceled', endedAt: new Date() },
  })

  await prisma.outboundCampaign.update({
    where: { id: campaignId },
    data:  { status: 'CANCELED' },
  })
  return { status: 'CANCELED' }
}
