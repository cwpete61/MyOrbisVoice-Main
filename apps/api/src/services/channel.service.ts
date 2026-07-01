import { randomBytes } from 'crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export const updateChannelSchema = z.object({
  isEnabled: z.boolean().optional(),
  greetingMode: z.string().max(50).optional().nullable(),
  afterHoursMode: z.string().max(50).optional().nullable(),
  escalationMode: z.string().max(50).optional().nullable(),
  configJson: z.record(z.unknown()).optional().nullable(),
  promptVersionId: z.string().uuid().optional().nullable(),
})

const CHANNEL_TYPES = ['WIDGET', 'INBOUND', 'OUTBOUND'] as const

export async function listChannels(tenantId: string) {
  const existing = await prisma.channelConfig.findMany({
    where: { tenantId },
    include: { promptVersion: { select: { id: true, name: true, status: true } } },
  })

  const existingByType = new Map(existing.map((c) => [c.channelType, c]))

  const result = await Promise.all(
    CHANNEL_TYPES.map(async (channelType) => {
      if (existingByType.has(channelType)) return existingByType.get(channelType)!
      return prisma.channelConfig.create({
        data: { tenantId, channelType, isEnabled: false },
        include: { promptVersion: { select: { id: true, name: true, status: true } } },
      })
    }),
  )
  return result
}

export async function updateChannel(
  tenantId: string,
  channelType: string,
  data: z.infer<typeof updateChannelSchema>,
) {
  if (!CHANNEL_TYPES.includes(channelType as (typeof CHANNEL_TYPES)[number])) {
    throw new AppError('NOT_FOUND', 'Invalid channel type', 404)
  }

  if (data.promptVersionId) {
    const prompt = await prisma.promptVersion.findFirst({
      where: { id: data.promptVersionId, tenantId },
    })
    if (!prompt) throw new AppError('NOT_FOUND', 'Prompt version not found', 404)
  }

  // Auto-generate publicKey when enabling the widget channel for the first time
  const existing = await prisma.channelConfig.findUnique({
    where: { tenantId_channelType: { tenantId, channelType: channelType as (typeof CHANNEL_TYPES)[number] } },
    select: { publicKey: true },
  })
  const needsPublicKey = channelType === 'WIDGET' && data.isEnabled && !existing?.publicKey
  // Mint once and reuse in both upsert branches — otherwise a first-time enable
  // that hits the CREATE path gets no publicKey (the embed comes back empty).
  const newPublicKey = needsPublicKey ? randomBytes(24).toString('hex') : null

  const update: Prisma.ChannelConfigUpdateInput = {
    ...(newPublicKey && { publicKey: newPublicKey }),
    ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
    ...(data.greetingMode !== undefined && { greetingMode: data.greetingMode }),
    ...(data.afterHoursMode !== undefined && { afterHoursMode: data.afterHoursMode }),
    ...(data.escalationMode !== undefined && { escalationMode: data.escalationMode }),
    ...(data.promptVersionId !== undefined && {
      promptVersion: data.promptVersionId
        ? { connect: { id: data.promptVersionId } }
        : { disconnect: true },
    }),
    ...(data.configJson !== undefined && {
      configJson: data.configJson === null ? Prisma.JsonNull : (data.configJson as Prisma.InputJsonValue),
    }),
  }

  return prisma.channelConfig.upsert({
    where: { tenantId_channelType: { tenantId, channelType: channelType as (typeof CHANNEL_TYPES)[number] } },
    update,
    create: {
      tenantId,
      channelType: channelType as (typeof CHANNEL_TYPES)[number],
      ...(newPublicKey && { publicKey: newPublicKey }),
      isEnabled: data.isEnabled ?? false,
      greetingMode: data.greetingMode ?? null,
      afterHoursMode: data.afterHoursMode ?? null,
      escalationMode: data.escalationMode ?? null,
      configJson: data.configJson === null ? Prisma.JsonNull : (data.configJson as Prisma.InputJsonValue | undefined),
      promptVersionId: data.promptVersionId ?? null,
    },
    include: { promptVersion: { select: { id: true, name: true, status: true } } },
  })
}
