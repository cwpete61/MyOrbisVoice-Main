import { prisma } from '../lib/prisma.js'

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
 * The row starts in OPEN status with an empty transcript; persistConversation()
 * flips it to COMPLETED (or FAILED) and fills in summary/transcript at end.
 */
export async function startWidgetConversation(opts: {
  tenantId:  string
  sessionId: string
}): Promise<string> {
  const { tenantId, sessionId } = opts
  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
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
}): Promise<string> {
  const { tenantId, sessionId, transcript, summary, channelType = 'WIDGET', turnLatenciesMs } = opts

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
        },
      })
      return conv.id
    }

    const conv = await prisma.conversation.findFirst({ where: { externalCallId: sessionId, tenantId } })
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
      },
    })
    await prisma.widgetSession.update({
      where: { id: sessionId },
      data:  { status: 'COMPLETED', endedAt: new Date() },
    }).catch(() => null)
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
    },
  })

  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { status: 'COMPLETED', endedAt: new Date(), conversationId: conversation.id },
  }).catch(() => null)

  return conversation.id
}

export async function markSessionFailed(sessionId: string) {
  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { status: 'FAILED', endedAt: new Date() },
  }).catch(() => null)
}
