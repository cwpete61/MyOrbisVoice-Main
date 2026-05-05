import { prisma } from '../lib/prisma.js'

export type TranscriptEntry = {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
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

  // WIDGET — create a new conversation record
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
