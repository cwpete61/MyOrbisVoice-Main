import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const createPromptSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  scope: z.enum(['PLATFORM', 'TENANT', 'CHANNEL', 'ROLE', 'CAMPAIGN']),
  channelType: z.enum(['WIDGET', 'INBOUND', 'OUTBOUND']).optional(),
  agentRoleType: z.enum(['ORCHESTRATOR', 'APPOINTMENT', 'SALES', 'CUSTOMER_SERVICE', 'MARKETING', 'ASSISTANT', 'SECRETARY']).optional(),
  parentPromptId: z.string().uuid().optional(),
})

export const updatePromptSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
})

export const promptFiltersSchema = z.object({
  scope: z.enum(['PLATFORM', 'TENANT', 'CHANNEL', 'ROLE', 'CAMPAIGN']).optional(),
  channelType: z.enum(['WIDGET', 'INBOUND', 'OUTBOUND']).optional(),
  agentRoleType: z.enum(['ORCHESTRATOR', 'APPOINTMENT', 'SALES', 'CUSTOMER_SERVICE', 'MARKETING', 'ASSISTANT', 'SECRETARY']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
})

export async function listPrompts(tenantId: string, filters: z.infer<typeof promptFiltersSchema>) {
  return prisma.promptVersion.findMany({
    where: {
      tenantId,
      ...(filters.scope && { scope: filters.scope }),
      ...(filters.channelType && { channelType: filters.channelType }),
      ...(filters.agentRoleType && { agentRoleType: filters.agentRoleType }),
      ...(filters.status && { status: filters.status }),
    },
    orderBy: [{ scope: 'asc' }, { versionNumber: 'desc' }],
    select: {
      id: true, name: true, scope: true, channelType: true, agentRoleType: true,
      status: true, versionNumber: true, publishedAt: true, createdAt: true, updatedAt: true,
    },
  })
}

export async function getPrompt(tenantId: string, id: string) {
  const prompt = await prisma.promptVersion.findFirst({ where: { id, tenantId } })
  if (!prompt) throw new AppError('NOT_FOUND', 'Prompt not found', 404)
  return prompt
}

export async function createPrompt(tenantId: string, userId: string, data: z.infer<typeof createPromptSchema>) {
  // Version number is highest existing + 1 for this scope/channel/role combo
  const existing = await prisma.promptVersion.findFirst({
    where: { tenantId, scope: data.scope, channelType: data.channelType ?? null, agentRoleType: data.agentRoleType ?? null },
    orderBy: { versionNumber: 'desc' },
  })
  const versionNumber = (existing?.versionNumber ?? 0) + 1

  return prisma.promptVersion.create({
    data: {
      tenantId,
      createdByUserId: userId,
      versionNumber,
      status: 'DRAFT',
      name: data.name,
      content: data.content,
      scope: data.scope,
      channelType: data.channelType ?? null,
      agentRoleType: data.agentRoleType ?? null,
      parentPromptId: data.parentPromptId ?? null,
    },
  })
}

export async function updatePrompt(tenantId: string, id: string, data: z.infer<typeof updatePromptSchema>) {
  const prompt = await prisma.promptVersion.findFirst({ where: { id, tenantId } })
  if (!prompt) throw new AppError('NOT_FOUND', 'Prompt not found', 404)
  if (prompt.status !== 'DRAFT') throw new AppError('CONFLICT', 'Only DRAFT prompts can be edited', 409)
  return prisma.promptVersion.update({ where: { id }, data })
}

export async function publishPrompt(tenantId: string, id: string, publishedByUserId: string) {
  const prompt = await prisma.promptVersion.findFirst({ where: { id, tenantId } })
  if (!prompt) throw new AppError('NOT_FOUND', 'Prompt not found', 404)
  if (prompt.status === 'PUBLISHED') throw new AppError('CONFLICT', 'Prompt is already published', 409)
  if (prompt.status === 'ARCHIVED') throw new AppError('CONFLICT', 'Archived prompts cannot be published', 409)

  return prisma.$transaction(async (tx) => {
    const published = await tx.promptVersion.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
    await tx.auditLog.create({
      data: {
        tenantId,
        actorType: 'USER',
        actorUserId: publishedByUserId,
        action: 'prompt.published',
        targetType: 'PromptVersion',
        targetId: id,
        metadataJson: { scope: prompt.scope, versionNumber: prompt.versionNumber },
      },
    })
    return published
  })
}
