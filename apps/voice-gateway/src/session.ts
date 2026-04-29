import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary } from './services/summary.service.js'
import { persistConversation, markSessionFailed, type TranscriptEntry } from './services/conversation.service.js'

// Message types sent from the browser widget
type ClientMsg =
  | { type: 'audio'; data: string }   // base64-encoded PCM16 audio chunk
  | { type: 'text'; text: string }    // text input fallback
  | { type: 'end' }                   // caller hung up

// Message types sent to the browser widget
type ServerMsg =
  | { type: 'ready' }
  | { type: 'audio'; data: string }   // base64 audio from Gemini
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string }
  | { type: 'turn_complete' }
  | { type: 'ended'; conversationId?: string }
  | { type: 'error'; message: string }

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg))
}

export async function handleWidgetSession(ws: WebSocket, token: string) {
  console.log('[session] new connection, token prefix:', token.slice(0, 8))

  // 1. Validate session token
  let sessionOrNull: Awaited<ReturnType<typeof prisma.widgetSession.findUnique>>
  try {
    sessionOrNull = await prisma.widgetSession.findUnique({ where: { token } })
  } catch (err) {
    console.error('[session] DB lookup failed:', err)
    send(ws, { type: 'error', message: 'Session lookup failed.' })
    ws.close()
    return
  }

  if (!sessionOrNull || sessionOrNull.status === 'EXPIRED' || sessionOrNull.expiresAt < new Date()) {
    console.warn('[session] invalid/expired token')
    send(ws, { type: 'error', message: 'Invalid or expired session token.' })
    ws.close()
    return
  }
  if (sessionOrNull.status === 'COMPLETED' || sessionOrNull.status === 'FAILED') {
    console.warn('[session] already ended')
    send(ws, { type: 'error', message: 'Session already ended.' })
    ws.close()
    return
  }

  const session = sessionOrNull

  // Mark active
  await prisma.widgetSession.update({
    where: { id: session.id },
    data: { status: 'ACTIVE', startedAt: new Date() },
  })

  // 2. Resolve prompt stack from snapshots stored at session creation time
  const prompts = Array.isArray(session.promptSnapshotJson)
    ? (session.promptSnapshotJson as any[])
    : []
  const dna = session.businessDNASnapshotJson as Record<string, any> | null
  const systemPrompt = resolveSystemPrompt(prompts, dna)

  const transcript: TranscriptEntry[] = []
  let conversationId: string | undefined

  console.log('[session] opening Gemini Live session')

  // 3. Open Gemini Live session
  const gemini = openGeminiLiveSession(systemPrompt, {
    onAudioChunk(chunk) {
      send(ws, { type: 'audio', data: chunk.toString('base64') })
    },
    onTranscriptDelta(role, text) {
      transcript.push({ role, text, timestamp: Date.now() })
      send(ws, { type: 'transcript', role, text })
    },
    onTurnComplete() {
      send(ws, { type: 'turn_complete' })
    },
    async onClose() {
      await finalize('COMPLETED')
    },
    async onError(err) {
      console.error('[session] Gemini error:', err.message, err.stack)
      send(ws, { type: 'error', message: 'Voice session error. Please try again.' })
      await finalize('FAILED')
      ws.close()
    },
  })

  send(ws, { type: 'ready' })

  // 4. Relay browser → Gemini
  ws.on('message', (raw) => {
    try {
      const msg: ClientMsg = JSON.parse(raw.toString('utf8'))
      if (msg.type === 'audio') {
        gemini.sendAudio(Buffer.from(msg.data, 'base64'))
      } else if (msg.type === 'text') {
        gemini.sendText(msg.text)
      } else if (msg.type === 'end') {
        gemini.close()
      }
    } catch {
      // ignore malformed frames
    }
  })

  ws.on('close', () => {
    gemini.close()
  })

  ws.on('error', () => {
    gemini.close()
  })

  // 5. Finalize — generate summary, persist conversation
  async function finalize(status: 'COMPLETED' | 'FAILED') {
    try {
      if (status === 'COMPLETED' && transcript.length > 0) {
        const summary = await generateSummary(transcript)
        conversationId = await persistConversation({
          tenantId: session.tenantId,
          sessionId: session.id,
          transcript,
          summary,
        })
        send(ws, { type: 'ended', conversationId })
      } else {
        await markSessionFailed(session.id)
        send(ws, { type: 'ended' })
      }
    } catch (err) {
      console.error('[session] finalize error:', err)
      await markSessionFailed(session.id).catch(() => null)
    }
  }
}
