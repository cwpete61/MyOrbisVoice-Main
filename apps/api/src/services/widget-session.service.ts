import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export async function createWidgetSession(tenantId: string, opts: {
  remoteIp?: string
  userAgent?: string
}) {
  // Check widget channel is enabled
  const channel = await prisma.channelConfig.findFirst({
    where: { tenantId, channelType: 'WIDGET', isEnabled: true },
  })
  if (!channel) throw new AppError('FORBIDDEN', 'Widget channel is not enabled for this tenant', 403)

  // Load active Business DNA snapshot (store all JSON sections as-is)
  const dna = await prisma.businessDNA.findFirst({
    where: { tenantId, isActive: true },
  })

  // Load published prompt versions for TENANT, WIDGET channel, and ORCHESTRATOR role
  const prompts = await prisma.promptVersion.findMany({
    where: {
      tenantId,
      status: 'PUBLISHED',
      scope: { in: ['TENANT', 'CHANNEL', 'ROLE'] },
    },
    orderBy: { scope: 'asc' },
    select: { id: true, scope: true, channelType: true, agentRoleType: true, content: true },
  })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  const dnaSnashot: Prisma.InputJsonValue | typeof Prisma.JsonNull = dna ? {
    id: dna.id,
    identityJson:    dna.identityJson,
    servicesJson:    dna.servicesJson,
    pricingJson:     dna.pricingJson,
    operationsJson:  dna.operationsJson,
    salesJson:       dna.salesJson,
    appointmentJson: dna.appointmentJson,
    supportJson:     dna.supportJson,
    languageJson:    dna.languageJson,
    complianceJson:  dna.complianceJson,
  } : Prisma.JsonNull

  const session = await prisma.widgetSession.create({
    data: {
      tenant:          { connect: { id: tenantId } },
      token,
      expiresAt,
      remoteIp:        opts.remoteIp ?? null,
      userAgent:       opts.userAgent ?? null,
      channelConfigId: channel.id,
      businessDNASnapshotJson: dnaSnashot,
      promptSnapshotJson: prompts as unknown as Prisma.InputJsonValue,
    },
  })

  return { sessionToken: token, expiresAt, sessionId: session.id }
}

export async function resolveWidgetSession(token: string) {
  const session = await prisma.widgetSession.findUnique({ where: { token } })
  if (!session) throw new AppError('NOT_FOUND', 'Session not found', 404)
  if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
    await prisma.widgetSession.update({ where: { id: session.id }, data: { status: 'EXPIRED' } })
    throw new AppError('FORBIDDEN', 'Session token has expired', 403)
  }
  if (session.status === 'COMPLETED' || session.status === 'FAILED') {
    throw new AppError('FORBIDDEN', 'Session is no longer active', 403)
  }
  return session
}

export async function markSessionActive(sessionId: string) {
  return prisma.widgetSession.update({
    where: { id: sessionId },
    data: { status: 'ACTIVE', startedAt: new Date() },
  })
}

export async function finalizeWidgetSession(sessionId: string, opts: {
  status: 'COMPLETED' | 'FAILED'
  conversationId?: string
}) {
  return prisma.widgetSession.update({
    where: { id: sessionId },
    data: { status: opts.status, endedAt: new Date(), conversationId: opts.conversationId },
  })
}
