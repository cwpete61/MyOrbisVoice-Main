import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const updateAgentSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  modelProvider: z.string().max(50).optional(),
  modelName: z.string().max(100).optional(),
  promptVersionId: z.string().uuid().optional().nullable(),
  settingsJson: z.record(z.unknown()).optional().nullable(),
})

const AGENT_ROLES = [
  'ORCHESTRATOR', 'APPOINTMENT', 'SALES', 'CUSTOMER_SERVICE', 'MARKETING', 'ASSISTANT', 'SECRETARY',
] as const

const DEFAULT_AGENT_SETTINGS = {
  ORCHESTRATOR: { displayName: 'Orchestrator', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  APPOINTMENT: { displayName: 'Appointment Agent', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  SALES: { displayName: 'Sales Agent', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  CUSTOMER_SERVICE: { displayName: 'Customer Service Agent', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  MARKETING: { displayName: 'Marketing Agent', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  ASSISTANT: { displayName: 'Assistant', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
  SECRETARY: { displayName: 'Secretary', modelProvider: 'openai', modelName: 'gpt-4o-mini' },
}

export async function listAgents(tenantId: string) {
  const existing = await prisma.agentProfile.findMany({
    where: { tenantId },
    include: { promptVersion: { select: { id: true, name: true, status: true, versionNumber: true } } },
  })

  // Return all 7 roles, creating missing ones with defaults on first access
  const existingByRole = new Map(existing.map((a) => [a.agentRoleType, a]))

  const result = await Promise.all(
    AGENT_ROLES.map(async (role) => {
      if (existingByRole.has(role)) return existingByRole.get(role)!
      const defaults = DEFAULT_AGENT_SETTINGS[role]
      return prisma.agentProfile.create({
        data: { tenantId, agentRoleType: role, isEnabled: false, ...defaults },
        include: { promptVersion: { select: { id: true, name: true, status: true, versionNumber: true } } },
      })
    }),
  )
  return result
}

export async function updateAgent(
  tenantId: string,
  roleType: string,
  data: z.infer<typeof updateAgentSchema>,
) {
  if (!AGENT_ROLES.includes(roleType as (typeof AGENT_ROLES)[number])) {
    throw new AppError('NOT_FOUND', 'Invalid agent role type', 404)
  }

  // Verify promptVersionId belongs to this tenant if provided
  if (data.promptVersionId) {
    const prompt = await prisma.promptVersion.findFirst({
      where: { id: data.promptVersionId, tenantId },
    })
    if (!prompt) throw new AppError('NOT_FOUND', 'Prompt version not found', 404)
  }

  // Build update object explicitly — Prisma's Without<> discriminant rejects spreading Zod output directly
  const update: Prisma.AgentProfileUpdateInput = {
    ...(data.displayName !== undefined && { displayName: data.displayName }),
    ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
    ...(data.modelProvider !== undefined && { modelProvider: data.modelProvider }),
    ...(data.modelName !== undefined && { modelName: data.modelName }),
    ...(data.promptVersionId !== undefined && {
      promptVersion: data.promptVersionId
        ? { connect: { id: data.promptVersionId } }
        : { disconnect: true },
    }),
    ...(data.settingsJson !== undefined && {
      settingsJson: data.settingsJson === null ? Prisma.JsonNull : (data.settingsJson as Prisma.InputJsonValue),
    }),
  }

  return prisma.agentProfile.upsert({
    where: { tenantId_agentRoleType: { tenantId, agentRoleType: roleType as (typeof AGENT_ROLES)[number] } },
    update,
    create: {
      tenantId,
      agentRoleType: roleType as (typeof AGENT_ROLES)[number],
      isEnabled: data.isEnabled ?? false,
      displayName: data.displayName ?? DEFAULT_AGENT_SETTINGS[roleType as keyof typeof DEFAULT_AGENT_SETTINGS]?.displayName ?? roleType,
      modelProvider: data.modelProvider ?? 'openai',
      modelName: data.modelName ?? 'gpt-4o-mini',
      promptVersionId: data.promptVersionId ?? null,
      settingsJson: data.settingsJson === null ? Prisma.JsonNull : (data.settingsJson as Prisma.InputJsonValue | undefined),
    },
    include: { promptVersion: { select: { id: true, name: true, status: true, versionNumber: true } } },
  })
}
