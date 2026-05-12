import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { fetchKbForPrompt } from './lib/knowledge-base.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary } from './services/summary.service.js'
import { persistConversation, markSessionFailed, startWidgetConversation, type TranscriptEntry } from './services/conversation.service.js'
import { getGeminiApiKey, resolveGeminiApiKey } from './lib/gemini-key.js'
import { TOOL_DECLARATIONS, buildToolGuidanceBlock, executeTool, rollbackToolCall, type ToolResult } from './services/tools.js'

// Message types sent from the browser widget
type ClientMsg =
  | { type: 'audio'; data: string }   // base64-encoded PCM16 audio chunk
  | { type: 'text'; text: string }    // text input fallback
  | { type: 'mic_stop' }              // user released mic — signal explicit end-of-turn to Gemini
  | { type: 'end' }                   // caller hung up

// Message types sent to the browser widget
type ServerMsg =
  | { type: 'ready' }
  | { type: 'audio'; data: string }   // base64 audio from Gemini
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string }
  | { type: 'turn_complete' }
  | { type: 'interrupted' }
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
  const kbText = await fetchKbForPrompt(session.tenantId).catch(e => {
    console.error('[session] kb fetch failed (non-fatal):', e?.message ?? e)
    return null
  })
  // Partner context — set by widget session creation when the widget loaded on
  // a partner's published page (/p/<slug>/). The resolver prepends a block
  // telling the agent who they're demoing for.
  const meta = session.metadataJson as Record<string, any> | null
  const partner = (meta?.['partner'] && typeof meta['partner'] === 'object')
    ? meta['partner']
    : null
  const systemPrompt = resolveSystemPrompt(prompts, dna, 'WIDGET', buildToolGuidanceBlock(), kbText, partner)

  const transcript: TranscriptEntry[] = []
  // Create the Conversation row upfront so mid-call tools (record_disposition,
  // save_contact, book_appointment with the convId param) have a target to
  // attach to. Without this, those tools 422'd with "Provide conversationId
  // or externalCallId" for every widget call. The row starts as OPEN and is
  // flipped to COMPLETED by persistConversation() at session end.
  let conversationId: string | undefined
  try {
    conversationId = await startWidgetConversation({ tenantId: session.tenantId, sessionId: session.id })
    console.log('[session] conversation created upfront:', conversationId)
  } catch (err) {
    console.error('[session] startWidgetConversation failed (non-fatal — tools will fall back to session end):', err)
  }
  // Tool-call lifecycle tracker — see inbound.ts comment for rationale.
  type ToolCallEntry = { name: string; cancelled: boolean; result?: ToolResult }
  const toolCallTracker = new Map<string, ToolCallEntry>()

  console.log('[session] opening Gemini Live session')

  // Look up tenant Gemini key; fall back to platform env key
  let tenantGeminiKey: string | undefined
  try {
    const geminiConn = await prisma.integrationConnection.findFirst({
      where: { tenantId: session.tenantId, provider: 'GEMINI', status: 'CONNECTED' },
    })
    if (geminiConn) {
      const meta = geminiConn.metadataJson as Record<string, string> | null
      const enc = meta?.['encryptedApiKey']
      if (enc) tenantGeminiKey = getGeminiApiKey(enc) ?? undefined
    }
  } catch { /* fallback to platform key */ }
  const effectiveGeminiKey = await resolveGeminiApiKey(tenantGeminiKey)

  // 3. Resolve voice name — draft config takes precedence over channel config
  const draftMeta = session.metadataJson as Record<string, unknown> | null
  let voiceName = (draftMeta?.['voiceName'] as string | undefined) ?? undefined
  if (!voiceName && session.channelConfigId) {
    try {
      const channelCfg = await prisma.channelConfig.findUnique({
        where: { id: session.channelConfigId },
        select: { configJson: true },
      })
      const cfgJson = channelCfg?.configJson as Record<string, unknown> | null
      voiceName = (cfgJson?.['voiceName'] as string | undefined) ?? undefined
    } catch { /* fallback to Gemini default */ }
  }
  voiceName = voiceName ?? 'Fenrir'

  // 4. Open Gemini Live session
  const identityJson = dna?.['identityJson'] as Record<string, unknown> | null | undefined
  const businessName = (identityJson?.['businessName'] as string | undefined)
    || (identityJson?.['name'] as string | undefined)
    || 'this business'

  const gemini = openGeminiLiveSession(systemPrompt, {
    onReady() {
      gemini.sendText(
        `A visitor just opened the voice chat widget for ${businessName}. ` +
        `You must speak immediately — do not wait for the visitor. ` +
        `Open with your professional greeting now.`
      )
    },
    onAudioChunk(chunk) {
      send(ws, { type: 'audio', data: chunk.toString('base64') })
    },
    onInterrupted() {
      send(ws, { type: 'interrupted' })
    },
    onTranscriptDelta(role, text) {
      transcript.push({ role, text, timestamp: Date.now() })
      send(ws, { type: 'transcript', role, text })
      // Also send in draft-studio format so the live preview panel can display turns
      if (draftMeta?.['isDraft']) {
        ws.send(JSON.stringify({ type: 'transcript_delta', speaker: role === 'user' ? 'You' : 'Agent', text }))
      }
    },
    onTurnComplete() {
      send(ws, { type: 'turn_complete' })
    },
    async onToolCall(call) {
      // end_call is a gateway-only signal — no API roundtrip. We acknowledge
      // the tool call back to Gemini Live immediately, send an `ended` message
      // to the widget client, and close the WebSocket after a 2s delay so the
      // goodbye audio finishes playing on the visitor's end.
      if (call.name === 'end_call') {
        const reason = (call.args as { reason?: string })?.reason ?? 'wrapping_up_generic'
        console.log(`[session] end_call invoked by agent (reason=${reason})`)
        gemini.sendToolResponse(call.id, call.name, { ok: true, reason })
        send(ws, { type: 'ended' })
        setTimeout(() => {
          try { ws.close() } catch { /* already closed */ }
        }, 2000)
        return
      }

      // See inbound.ts for the rationale — Gemini Live can emit a
      // toolCallCancellation after the API has already committed a side
      // effect (most importantly: book_appointment writes a row + Google
      // event). The widget session reuses the same compensating logic.
      toolCallTracker.set(call.id, { name: call.name, cancelled: false })
      try {
        const result = await executeTool(call.name, call.args, {
          tenantId:       session.tenantId,
          conversationId: conversationId,
        })
        const tracker = toolCallTracker.get(call.id)
        if (tracker) tracker.result = result
        gemini.sendToolResponse(call.id, call.name, result)
        if (tracker?.cancelled) {
          await rollbackToolCall(call.name, result, {
            tenantId:       session.tenantId,
            conversationId: conversationId,
          })
        }
      } catch (err) {
        console.error(`[session] tool ${call.name} failed:`, err)
        gemini.sendToolResponse(call.id, call.name, {
          ok: false,
          error: (err as Error).message ?? 'Internal tool error',
        })
      }
    },
    onToolCallCancellation(ids) {
      for (const id of ids) {
        const tracker = toolCallTracker.get(id)
        if (!tracker) {
          toolCallTracker.set(id, { name: '?', cancelled: true })
          continue
        }
        tracker.cancelled = true
        if (tracker.result) {
          rollbackToolCall(tracker.name, tracker.result, {
            tenantId:       session.tenantId,
            conversationId: conversationId,
          }).catch(err => console.warn('[session] rollback failed:', err))
        }
      }
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
  }, { apiKeyOverride: effectiveGeminiKey, voiceName, tools: [...TOOL_DECLARATIONS] })

  send(ws, { type: 'ready' })

  // 5. Relay browser → Gemini
  ws.on('message', (raw) => {
    try {
      const msg: ClientMsg = JSON.parse(raw.toString('utf8'))
      if (msg.type === 'audio') {
        gemini.sendAudio(Buffer.from(msg.data, 'base64'))
      } else if (msg.type === 'mic_stop') {
        // Explicit end-of-turn — bypass VAD and tell Gemini the user is done speaking
        gemini.signalTurnComplete()
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
