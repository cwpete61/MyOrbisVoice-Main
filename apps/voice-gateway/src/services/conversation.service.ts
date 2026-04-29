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
}): Promise<string> {
  const { tenantId, sessionId, transcript, summary, channelType = 'WIDGET' } = opts

  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      channelType,
      direction:     'INBOUND',
      status:        'COMPLETED',
      startedAt:     new Date(transcript[0]?.timestamp ?? Date.now()),
      endedAt:       new Date(),
      summaryText:   summary,
      transcriptRef: JSON.stringify(transcript),
    },
  })

  if (channelType === 'WIDGET') {
    await prisma.widgetSession.update({
      where: { id: sessionId },
      data:  { status: 'COMPLETED', endedAt: new Date(), conversationId: conversation.id },
    }).catch(() => null)
  } else if (channelType === 'INBOUND') {
    await prisma.callLog.updateMany({
      where: { providerCallId: sessionId },
      data:  { conversationId: conversation.id, status: 'completed', endAt: new Date() },
    }).catch(() => null)
  }

  return conversation.id
}

export async function markSessionFailed(sessionId: string) {
  await prisma.widgetSession.update({
    where: { id: sessionId },
    data:  { status: 'FAILED', endedAt: new Date() },
  }).catch(() => null)
}
