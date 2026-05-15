import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

export async function createWidgetSession(tenantId: string, opts: {
  remoteIp?: string
  userAgent?: string
  draftConfig?: { voiceName: string | null; avatarId: string | null; channelType: string; isDraft: boolean }
  /** Partner slug from /p/<slug>/ URLs. When set, we snapshot the partner's
   *  identity onto metadataJson.partner so the gateway can inject "you are
   *  demoing for Alex Rivera" into the agent's prompt context. */
  partnerSlug?: string
}) {
  const isDraft = !!opts.draftConfig

  // For draft test sessions, look up the channel but don't require it to be enabled
  const channelType = opts.draftConfig?.channelType ?? 'WIDGET'
  const channel = await prisma.channelConfig.findFirst({
    where: { tenantId, channelType: channelType as 'WIDGET' | 'INBOUND' | 'OUTBOUND', ...(isDraft ? {} : { isEnabled: true }) },
  })
  if (!isDraft && !channel) throw new AppError('FORBIDDEN', 'Widget channel is not enabled for this tenant', 403)
  if (isDraft && !channel) {
    // Channel may not exist yet — that's fine for testing, create session without channel binding
  }

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

  // Build metadata: combines draftConfig (test sessions) + partner context (when
  // the widget was activated on /p/<slug>/). Both are optional. Stashed in
  // metadataJson so the gateway picks them up at WebSocket open without needing
  // extra DB lookups during a live call.
  const metaPayload: Record<string, unknown> = {}
  if (opts.draftConfig) metaPayload['draft'] = opts.draftConfig
  if (opts.partnerSlug) {
    // findFirst (not findUnique) so we can add deletedAt: null — Prisma's
    // findUnique only accepts the unique-constraint shape. Deleted partners
    // can't host a live widget session.
    const partner = await prisma.affiliateAccount.findFirst({
      where: { slug: opts.partnerSlug, deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
    if (partner?.partnerPageActive) {
      const slug = partner.slug!
      metaPayload['partner'] = {
        id:           partner.id,
        slug,
        firstName:    partner.user.firstName ?? '',
        lastName:     partner.user.lastName  ?? '',
        displayName:  partner.displayName ?? (`${partner.user.firstName ?? ''} ${partner.user.lastName ?? ''}`.trim() || slug),
        businessName: partner.businessName   ?? null,
        partnerEmail: `${slug}@myorbisresults.com`,
        avatarUrl:    partner.avatarUrl      ?? null,
        bio:          partner.bio            ?? null,
        partnerPhone: partner.partnerPhone   ?? null,
      }
    }
  }
  const metadataJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    Object.keys(metaPayload).length > 0
      ? (metaPayload as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull

  const session = await prisma.widgetSession.create({
    data: {
      tenant:          { connect: { id: tenantId } },
      token,
      expiresAt,
      remoteIp:        opts.remoteIp ?? null,
      userAgent:       opts.userAgent ?? null,
      ...(channel ? { channelConfigId: channel.id } : {}),
      businessDNASnapshotJson: dnaSnashot,
      promptSnapshotJson:      prompts as unknown as Prisma.InputJsonValue,
      metadataJson,
    },
  })

  return { sessionToken: token, expiresAt, sessionId: session.id, isDraft: isDraft }
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
