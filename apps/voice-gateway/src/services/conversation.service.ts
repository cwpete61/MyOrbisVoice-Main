import { prisma } from '../lib/prisma.js'
import type { ShowingBrief } from './summary.service.js'

export type TranscriptEntry = {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

/**
 * Create the Conversation row at WIDGET session start so its id is available
 * for tool calls fired mid-session (record_disposition, save_contact, etc.).
 * Without this, those tools were 422-ing because we had no conversationId or
 * externalCallId to scope them to. The widgetSession row is linked back to
 * the conversation immediately so the relation is queryable from either side.
 *
 * Phase E.2: when the visitor is on a partner's landing page, the session's
 * metadataJson.partner.slug is set. We resolve that slug → AffiliateAccount.id
 * and persist it on Conversation.partnerId so the book_appointment handler
 * later knows to route the booking to the partner's Google Calendar instead
 * of the tenant's. Null partnerSlug → null partnerId → existing tenant flow.
 *
 * The row starts in OPEN status with an empty transcript; persistConversation()
 * flips it to COMPLETED (or FAILED) and fills in summary/transcript at end.
 */
export async function startWidgetConversation(opts: {
  tenantId:     string
  sessionId:    string
  partnerSlug?: string | null
}): Promise<string> {
  const { tenantId, sessionId, partnerSlug } = opts

  // Resolve partner ID from slug (best-effort; null if not found or not given).
  let partnerId: string | null = null
  if (partnerSlug) {
    const partner = await prisma.affiliateAccount.findFirst({
      where:  { slug: partnerSlug },
      select: { id: true },
    }).catch(() => null)
    partnerId = partner?.id ?? null
    if (partnerSlug && !partnerId) {
      console.warn(`[session] partner slug "${partnerSlug}" did not match any AffiliateAccount — partner-scoped booking disabled for this call`)
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      partnerId,
      channelType: 'WIDGET',
      direction:   'INBOUND',
      status:      'OPEN',
      startedAt:   new Date(),
      transcriptJson: [] as any,
    },
  })
  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { conversationId: conversation.id },
  }).catch(() => null)
  return conversation.id
}

export async function persistConversation(opts: {
  tenantId:    string
  sessionId:   string
  transcript:  TranscriptEntry[]
  summary:     string
  channelType?: 'WIDGET' | 'INBOUND' | 'OUTBOUND'
  /** Per-turn user→agent turnaround latencies (ms). Persisted to
   *  Conversation.metadataJson so we can plot the distribution and
   *  decide whether VAD tuning is worth further work. */
  turnLatenciesMs?: number[]
  /** Post-call AI attention assessment — see analyzeConversation(). Drives
   *  the admin central call log's colour + alerting. */
  attentionLevel?: 'NONE' | 'WATCH' | 'ALERT'
  attentionReason?: string | null
  /** Pre-showing handoff extracted from real-estate buyer calls — stored on
   *  Conversation.outcomeJson and rendered as the Showing Brief card. Null for
   *  non-buyer / non-RE conversations. */
  showingBrief?: ShowingBrief | null
  /** Partner slug when the call's number is partner-owned. Inbound sets
   *  Conversation.partnerId at logCallStart, so it passes nothing here.
   *  Outbound has no pre-create step, so it passes the slug and we resolve +
   *  set partnerId on the row (create + update). Never nulls an existing
   *  partnerId. */
  partnerSlug?: string | null
  /** DEMO phone sessions — set when a PIN-bound inbound call connected. Tags the
   *  conversation so the demo cockpit can filter to that browser session. */
  demoSessionId?: string | null
}): Promise<string> {
  const { tenantId, sessionId, transcript, summary, channelType = 'WIDGET', turnLatenciesMs, attentionLevel, attentionReason, partnerSlug, demoSessionId, showingBrief } = opts
  const demoPatch = demoSessionId ? { demoSessionId } : {}
  // Store the Showing Brief on outcomeJson when present (real-estate buyer calls).
  const outcomePatch = showingBrief ? { outcomeJson: { showingBrief } as unknown as object } : {}

  // Resolve partner slug → id (outbound partner attribution). Only set when a
  // slug was supplied + matches; otherwise leave undefined so we never wipe a
  // partnerId already set upstream (inbound's logCallStart).
  let resolvedPartnerId: string | null | undefined = undefined
  if (partnerSlug) {
    const partner = await prisma.affiliateAccount.findFirst({
      where:  { slug: partnerSlug },
      select: { id: true },
    })
    resolvedPartnerId = partner?.id ?? undefined
    if (!resolvedPartnerId) {
      console.warn(`[conversation] partner slug "${partnerSlug}" did not match — outbound conversation left untagged`)
    }
  }
  const partnerPatch = resolvedPartnerId ? { partnerId: resolvedPartnerId } : {}

  const transcriptJson = transcript.map(e => ({
    role:      e.role,
    text:      e.text,
    timestamp: e.timestamp,
  }))

  // metadataJson payload — only attach latency if we measured at least one turn
  const metadataPatch: Record<string, unknown> = {}
  if (turnLatenciesMs && turnLatenciesMs.length > 0) {
    const sorted = [...turnLatenciesMs].sort((a, b) => a - b)
    metadataPatch['latency'] = {
      turns: turnLatenciesMs,
      count: turnLatenciesMs.length,
      min:   sorted[0],
      max:   sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95:   sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    }
  }

  // Attention assessment + Showing Brief — patched into every write path below.
  const attentionData = {
    ...(attentionLevel ? { attentionLevel, attentionReason: attentionReason ?? null } : {}),
    ...outcomePatch,
  }

  if (channelType === 'INBOUND' || channelType === 'OUTBOUND') {
    // Conversation was already created by logCallStart — update it
    const updated = await prisma.conversation.updateMany({
      where: { externalCallId: sessionId, tenantId },
      data:  {
        status:        'COMPLETED',
        endedAt:       new Date(),
        summaryText:   summary,
        transcriptJson: transcriptJson as any,
        ...(Object.keys(metadataPatch).length > 0 ? { metadataJson: metadataPatch as any } : {}),
        ...attentionData,
        ...partnerPatch,
        ...demoPatch,
      },
    })

    if (updated.count === 0) {
      console.warn(`[conversation] no conversation found for callSid=${sessionId}, creating fallback`)
      const conv = await prisma.conversation.create({
        data: {
          tenantId,
          channelType,
          direction:      channelType === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
          status:         'COMPLETED',
          startedAt:      new Date(transcript[0]?.timestamp ?? Date.now()),
          endedAt:        new Date(),
          summaryText:    summary,
          transcriptJson: transcriptJson as any,
          externalCallId: sessionId,
          ...attentionData,
          ...partnerPatch,
          ...demoPatch,
        },
      })
      return conv.id
    }

    const conv = await prisma.conversation.findFirst({ where: { externalCallId: sessionId, tenantId } })
    if (conv?.id) await fireCrmTransition(tenantId, conv.id).catch(() => null)
    return conv?.id ?? sessionId
  }

  // WIDGET — the conversation row was created at session start by
  // startWidgetConversation() so its id was available for mid-call tool calls.
  // Find it via the widgetSession link and update with the final transcript/summary.
  // If it's missing (legacy session that started before this fix), fall back to create.
  const session = await prisma.widgetSession.findUnique({ where: { id: sessionId } })
  const existingConvId = session?.conversationId

  if (existingConvId) {
    await prisma.conversation.update({
      where: { id: existingConvId },
      data: {
        status:         'COMPLETED',
        endedAt:        new Date(),
        summaryText:    summary,
        transcriptJson: transcriptJson as any,
        ...(Object.keys(metadataPatch).length > 0 ? { metadataJson: metadataPatch as any } : {}),
        ...attentionData,
      },
    })
    await prisma.widgetSession.update({
      where: { id: sessionId },
      data:  { status: 'COMPLETED', endedAt: new Date() },
    }).catch(() => null)
    await fireCrmTransition(tenantId, existingConvId).catch(() => null)
    return existingConvId
  }

  // Fallback: no pre-created row (shouldn't happen post-fix, but keep the path).
  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      channelType,
      direction:      'INBOUND',
      status:         'COMPLETED',
      startedAt:      new Date(transcript[0]?.timestamp ?? Date.now()),
      endedAt:        new Date(),
      summaryText:    summary,
      transcriptJson: transcriptJson as any,
      ...attentionData,
    },
  })

  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { status: 'COMPLETED', endedAt: new Date(), conversationId: conversation.id },
  }).catch(() => null)

  await fireCrmTransition(tenantId, conversation.id).catch(() => null)
  return conversation.id
}

/**
 * Phase F.1 — CRM auto-transition on conversation persist. Moves the contact
 * forward to "Spoke with Orby" if they're still at "New Lead" (or unstaged).
 * Inlined here instead of importing the API service — the gateway shouldn't
 * depend on apps/api code. Same SQL the API service runs.
 */
async function fireCrmTransition(tenantId: string, conversationId: string): Promise<void> {
  try {
    const conv = await prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { contactId: true, partnerId: true },
    })
    if (!conv?.contactId) return

    // F.3 — partner-scoped lookup when the conversation originated on a
    // partner page. Pipeline + contact filter on partnerId; tenant filter
    // drops out (the partner CRM is one logical pipeline regardless of the
    // hosting tenant). Tenant calls keep the prior tenantId+partnerId-null
    // scope so the two CRMs stay isolated.
    const stageWhere = conv.partnerId
      ? { partnerId: conv.partnerId, name: 'Spoke with Orby' }
      : { tenantId,                   partnerId: null, name: 'Spoke with Orby' }
    const contactWhere = conv.partnerId
      ? { id: conv.contactId, partnerId: conv.partnerId }
      : { id: conv.contactId, tenantId, partnerId: null }

    const [contact, target] = await Promise.all([
      prisma.contact.findFirst({
        where:  contactWhere,
        select: { pipelineStage: { select: { sortOrder: true } } },
      }),
      prisma.pipelineStage.findFirst({
        where:  stageWhere,
        select: { id: true, sortOrder: true },
      }),
    ])
    if (!contact || !target) return

    const currentOrder = contact.pipelineStage?.sortOrder ?? -1
    if (currentOrder >= target.sortOrder) return  // already past — respect manual progress

    await prisma.contact.updateMany({
      where: contactWhere,
      data:  { pipelineStageId: target.id, stageUpdatedAt: new Date() },
    })
  } catch (err) {
    console.warn('[crm] auto-transition failed (non-fatal):', (err as Error).message)
  }
}

// Wire fireCrmTransition into the WIDGET path that updates an existing
// conversation row (the common case post-fix).
export async function markSessionFailed(sessionId: string) {
  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { status: 'FAILED', endedAt: new Date() },
  }).catch(() => null)
}
