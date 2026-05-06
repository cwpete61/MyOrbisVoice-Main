import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary, cleanTranscript } from './services/summary.service.js'
import { persistConversation, type TranscriptEntry } from './services/conversation.service.js'
import { mulawToPcm16, pcm16ToMulaw, resamplePcm16 } from './lib/mulaw.js'
import { getGeminiApiKey, resolveGeminiApiKey } from './lib/gemini-key.js'
import { sendCallNotificationEmail } from './services/notify.service.js'
import { sendToTenant as sendPushToTenant } from './services/push.service.js'
import { TOOL_DECLARATIONS, buildToolGuidanceBlock, executeTool } from './services/tools.js'
import { hangUpTwilioCall } from './lib/twilio-call-control.js'

const GOODBYE_PATTERN = /\b(goodbye|good-bye|bye|bye-bye|farewell|take care|have a good|have a great|talk (to you |with you )?(soon|later)|see you|thanks? (for calling|for your time)|thank you (for calling|for your time)|that('s| is) all|no (more )?questions|i('m| am) done|end the call|hang up)\b/i

// Returns true when the tenant's voice minutes this period exceed
// `minutes_per_month` × HARD_CAP_MULTIPLIER. Beyond this point we refuse
// new sessions to prevent runaway charges (e.g. payment-failed tenants
// that keep dialing in). Below the cap, calls go through and overage
// bills normally via Stripe.
const HARD_CAP_MULTIPLIER = 1.5
async function isOverHardCap(tenantId: string): Promise<boolean> {
  try {
    const ent = await prisma.tenantEntitlement.findFirst({
      where:  { tenantId, key: 'minutes_per_month' },
      select: { integerValue: true },
    })
    const quota = ent?.integerValue ?? 0
    if (quota <= 0) return false  // no quota = no cap (e.g. enterprise unlimited)

    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const periodEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const agg = await prisma.conversation.aggregate({
      where: { tenantId, startedAt: { gte: periodStart, lt: periodEnd } },
      _sum:  { recordingDurationSecs: true },
    })
    const minutesUsed = Math.ceil((agg._sum.recordingDurationSecs ?? 0) / 60)
    return minutesUsed >= Math.ceil(quota * HARD_CAP_MULTIPLIER)
  } catch (err) {
    console.error('[inbound] hard-cap check failed, allowing call:', err)
    return false  // fail-open so a DB blip doesn't block calls
  }
}

// Local alias for backwards-compatible call sites in this file. Real
// implementation lives in lib/twilio-call-control.ts so it can be reused by
// the hangup_call tool handler.
function hangUpCall(callSid: string, ownerAccountSid: string | null) {
  return hangUpTwilioCall(callSid, ownerAccountSid, 'inbound')
}

// Twilio Media Stream message shapes
type TwilioMsg =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start';     start: { streamSid: string; callSid: string; accountSid?: string; customParameters: Record<string, string> } }
  | { event: 'media';     media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop';      stop: { accountSid: string; callSid: string } }

export async function handleInboundCall(ws: WebSocket) {
  console.log('[inbound] Twilio Media Stream connected')

  let streamSid  = ''
  let callSid    = ''
  let tenantId   = ''
  let channelConfigId = ''
  let ownerAccountSid: string | null = null
  let initialized = false

  const transcript: TranscriptEntry[] = []
  let gemini: ReturnType<typeof openGeminiLiveSession> | null = null

  // Accumulate streaming deltas into complete turns before pushing to transcript
  let userBuffer    = ''
  let agentBuffer   = ''
  let lastRole: 'user' | 'assistant' | null = null

  function flushBuffer(role: 'user' | 'assistant') {
    const text = role === 'user' ? userBuffer.trim() : agentBuffer.trim()
    if (text) {
      transcript.push({ role, text, timestamp: Date.now() })
    }
    if (role === 'user') userBuffer = ''
    else agentBuffer = ''
  }

  // Gemini outputs PCM16 24kHz → downsample to 8kHz → mulaw → Twilio
  let audioChunksSent = 0

  // Latency telemetry. We can't observe Gemini's internal "user stopped"
  // moment, but we CAN measure "user's last audio frame went to Gemini" →
  // "first agent audio came back to us." The delta is the perceived
  // turnaround time the caller feels. Captured per turn, persisted on
  // Conversation.metadataJson at finalize so we can plot the distribution
  // and decide whether VAD silence_duration_ms / prefix_padding_ms are
  // worth tuning further.
  let lastUserAudioAt: number | null = null
  let agentTurnStart:  number | null = null
  const turnLatenciesMs: number[] = []
  // One-shot diagnostic flags — see media-event handler below
  let firstMediaLogged       = false
  let firstTrackRejectLogged = false

  function sendAudioToTwilio(pcm24k: Buffer) {
    if (!streamSid || ws.readyState !== 1) return
    audioChunksSent++
    if (audioChunksSent === 1 || agentTurnStart === null) {
      agentTurnStart = Date.now()
      if (lastUserAudioAt !== null) {
        const ms = agentTurnStart - lastUserAudioAt
        turnLatenciesMs.push(ms)
        console.log(`[inbound] turnaround: ${ms}ms (user→agent)`)
      } else {
        console.log('[inbound] first audio chunk → Twilio')
      }
    }
    try {
      const pcm8k   = resamplePcm16(pcm24k, 24000, 8000)
      const mulaw   = pcm16ToMulaw(pcm8k)
      const payload = mulaw.toString('base64')
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload } }))
      // Agent audio counts as activity — caller is listening, not silent.
      // Without this, a long agent reply (or multi-tool sequence) trips the
      // watchdog right when the conversation is healthiest.
      resetSilenceTimer()
    } catch (err) {
      console.error('[inbound] sendAudioToTwilio error:', err)
    }
  }

  // Stop Twilio from playing buffered agent audio (barge-in)
  function clearTwilioAudio() {
    if (!streamSid || ws.readyState !== 1) return
    try { ws.send(JSON.stringify({ event: 'clear', streamSid })) } catch { /* ignore */ }
  }

  // 30s check-in, 60s total before hangup — caller may be thinking.
  // The timer resets on ANY audio activity (caller audio, agent audio) and
  // on tool-call lifecycle events (model is "doing something" during a tool
  // round-trip, even if the line is quiet). Earlier values of 10s/20s killed
  // calls during natural pauses.
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let checkinSent = false

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer)
    checkinSent = false
    silenceTimer = setTimeout(() => {
      if (!initialized || !gemini) return
      console.log('[inbound] 30s silence — sending check-in')
      checkinSent = true
      gemini.sendText('The caller has been silent for 30 seconds. Politely ask if they are still there and need assistance.')
      silenceTimer = setTimeout(() => {
        console.log('[inbound] 60s silence — hanging up')
        hangUpCall(callSid, ownerAccountSid)
        setTimeout(() => gemini?.close(), 500)
      }, 30_000)
    }, 30_000)
  }

  function stopSilenceTimer() {
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
  }

  async function initSession(params: Record<string, string>) {
    tenantId        = params['tenantId']        ?? ''
    channelConfigId = params['channelConfigId'] ?? ''
    callSid         = params['callSid']         ?? callSid

    console.log(`[inbound] init session tenantId=${tenantId} callSid=${callSid}`)

    if (!tenantId) {
      console.error('[inbound] missing tenantId in stream params')
      ws.close()
      return
    }

    // Hard-cap: refuse new calls when this tenant is already 1.5x past its
    // monthly minutes quota. Below the cap, calls go through and overage
    // bills via Stripe — the cap only kicks in for runaway usage (e.g.
    // payment failed and they kept calling). 1.5x grace ensures we don't
    // cut anyone off mid-conversation right on the boundary.
    if (await isOverHardCap(tenantId)) {
      console.warn(`[inbound] tenant ${tenantId} blocked — over voice minutes hard cap`)
      ws.close()
      return
    }

    // Load active DNA, published prompts, and channel config for this tenant
    const [dna, prompts, channelCfgRow] = await Promise.all([
      prisma.businessDNA.findFirst({ where: { tenantId, isActive: true } }),
      prisma.promptVersion.findMany({
        where: { tenantId, status: 'PUBLISHED', scope: { in: ['TENANT', 'CHANNEL', 'ROLE'] } },
        select: { id: true, scope: true, channelType: true, agentRoleType: true, content: true },
      }),
      channelConfigId
        ? prisma.channelConfig.findUnique({ where: { id: channelConfigId }, select: { configJson: true } })
        : Promise.resolve(null),
    ])

    const channelCfgJson  = (channelCfgRow?.configJson as Record<string, unknown> | null) ?? {}
    const voiceName       = (channelCfgJson['voiceName']       as string  | undefined) || 'Fenrir'
    const agentSpeaksFirst = channelCfgJson['agentSpeaksFirst'] !== false  // default true

    const dnaSnap = dna ? {
      identityJson:    dna.identityJson,
      servicesJson:    dna.servicesJson,
      pricingJson:     dna.pricingJson,
      operationsJson:  dna.operationsJson,
      salesJson:       dna.salesJson,
      appointmentJson: dna.appointmentJson,
      supportJson:     dna.supportJson,
      languageJson:    dna.languageJson,
      complianceJson:  dna.complianceJson,
    } : null

    const systemPrompt = resolveSystemPrompt(
      prompts as any[],
      dnaSnap,
      'INBOUND',
      buildToolGuidanceBlock(),
    )

    // Look up tenant's Gemini API key; fall back to platform env key
    const geminiConn = await prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'GEMINI', status: 'CONNECTED' },
    })
    let tenantGeminiKey: string | undefined
    if (geminiConn) {
      const meta = geminiConn.metadataJson as Record<string, string> | null
      const enc = meta?.['encryptedApiKey']
      if (enc) {
        try {
          tenantGeminiKey = getGeminiApiKey(enc) ?? undefined
        } catch { /* fallback to platform key */ }
      }
    }
    const effectiveGeminiKey = await resolveGeminiApiKey(tenantGeminiKey)

    // Build greeting trigger using business name from DNA if available
    const identityJson = dna?.identityJson as Record<string, unknown> | null | undefined
    const businessName = (identityJson?.['businessName'] as string | undefined)
      || (identityJson?.['name'] as string | undefined)
      || 'this business'

    // Fire call notification email — non-blocking
    sendCallNotificationEmail({ tenantId, channelType: 'INBOUND' }).catch(() => {})
    // Fire push to every browser/device subscribed by tenant members. Best-effort —
    // never blocks the call from connecting if push fails for some reason.
    sendPushToTenant(tenantId, {
      title: `Inbound call — ${businessName}`,
      body:  'Click to open the conversation.',
      url:   '/conversations',
      tag:   `call-${callSid}`,
    }).catch(() => {})

    gemini = openGeminiLiveSession(systemPrompt, {
      onReady() {
        if (agentSpeaksFirst) {
          gemini?.sendText(
            `A call has just connected to ${businessName}. ` +
            `You must speak immediately — do not wait for the caller. ` +
            `Open with your professional greeting now.`
          )
          console.log(`[inbound] agent speaks first — greeting sent for "${businessName}"`)
        }
        resetSilenceTimer()
      },
      onAudioChunk(chunk) {
        sendAudioToTwilio(chunk)
      },
      onInterrupted() {
        clearTwilioAudio()
      },
      onTranscriptDelta(role, text) {
        // If the speaker switches, flush the previous speaker's buffer first
        if (lastRole && lastRole !== role) {
          flushBuffer(lastRole)
        }
        lastRole = role

        if (role === 'user') {
          userBuffer += (userBuffer ? ' ' : '') + text
          resetSilenceTimer()
          if (GOODBYE_PATTERN.test(text)) {
            console.log('[inbound] goodbye detected — hanging up')
            stopSilenceTimer()
            setTimeout(() => hangUpCall(callSid, ownerAccountSid), 2000)
          }
        } else {
          agentBuffer += (agentBuffer ? ' ' : '') + text
        }
      },
      onTurnComplete() {
        // Agent finished speaking — flush the completed agent turn
        if (agentBuffer.trim()) flushBuffer('assistant')
        // Also flush any pending user turn (user finished before agent responded)
        if (userBuffer.trim()) flushBuffer('user')
        lastRole = null
        // Reset latency tracking so the NEXT turn measures the next
        // user→agent gap, not the time since this turn ended.
        agentTurnStart = null
        lastUserAudioAt = null
        console.log('[inbound] Gemini turn complete')
      },
      async onToolCall(call) {
        // Tool round-trips happen while the line is quiet — count them as
        // activity so the silence watchdog doesn't fire mid-tool.
        resetSilenceTimer()
        try {
          const result = await executeTool(call.name, call.args, {
            tenantId,
            externalCallId: callSid,
            callSid,
            ownerAccountSid,
          })
          gemini?.sendToolResponse(call.id, call.name, result)
        } catch (err) {
          console.error(`[inbound] tool ${call.name} failed:`, err)
          gemini?.sendToolResponse(call.id, call.name, {
            ok: false,
            error: (err as Error).message ?? 'Internal tool error',
          })
        } finally {
          // Reset again now that the response went back to Gemini — keeps
          // the timer fresh while the model formulates its next reply.
          resetSilenceTimer()
        }
      },
      async onClose() {
        // When Gemini's WebSocket closes (normal goodbye, agent hangup, OR
        // unexpected 1008/policy error), we MUST also tear down the Twilio
        // side of the call. Otherwise the gateway-side WS to Twilio stays
        // open with no audio, and the caller hears dead silence until they
        // manually hang up. Two-step:
        //   1. hangUpCall — POST Status=completed to Twilio's REST API,
        //      ending the phone call immediately from Twilio's side.
        //   2. ws.close — end our own WebSocket to Twilio so Twilio resumes
        //      executing the rest of the TwiML (which is empty after the
        //      <Stream>, so it falls through to hangup).
        // Both are idempotent and safe to call even if the call is already
        // ending for another reason.
        stopSilenceTimer()
        hangUpCall(callSid, ownerAccountSid)
        await finalize('COMPLETED')
        ws.close()
      },
      async onError(err) {
        console.error('[inbound] Gemini error:', err.message)
        stopSilenceTimer()
        hangUpCall(callSid, ownerAccountSid)
        await finalize('FAILED')
        ws.close()
      },
    }, { apiKeyOverride: effectiveGeminiKey, voiceName, tools: [...TOOL_DECLARATIONS] })

    initialized = true
    console.log('[inbound] session ready, Gemini connecting…')
  }

  let finalized = false
  async function finalize(status: 'COMPLETED' | 'FAILED') {
    if (finalized) return
    finalized = true
    try {
      // Flush any incomplete turn buffers before persisting
      if (userBuffer.trim())  flushBuffer('user')
      if (agentBuffer.trim()) flushBuffer('assistant')

      if (status === 'COMPLETED' && transcript.length > 0) {
        const cleaned = await cleanTranscript(transcript)
        const summary = await generateSummary(cleaned)
        await persistConversation({
          tenantId,
          sessionId: callSid,
          transcript: cleaned,
          summary,
          channelType: 'INBOUND',
          turnLatenciesMs,
        })
        if (turnLatenciesMs.length > 0) {
          const sorted = [...turnLatenciesMs].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          console.log(`[inbound] latency summary: turns=${turnLatenciesMs.length} median=${median}ms p95=${sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]}ms`)
        }
        console.log(`[inbound] conversation persisted callSid=${callSid} turns=${transcript.length}`)
      } else {
        console.log(`[inbound] finalize ${status} — transcript len=${transcript.length}, not persisting`)
      }
    } catch (err) {
      console.error('[inbound] finalize error:', err)
    }
  }

  ws.on('message', async (raw) => {
    try {
      const msg: TwilioMsg = JSON.parse(raw.toString('utf8'))

      if (msg.event === 'start') {
        streamSid = msg.start.streamSid
        callSid   = msg.start.callSid
        ownerAccountSid = msg.start.accountSid ?? null
        await initSession(msg.start.customParameters)
        return
      }

      if (msg.event === 'media') {
        // Diagnostic logging — fires only on the FIRST media event of each
        // call. Captures the track value Twilio is actually sending us and
        // the gating-flag state, so we can debug why latency telemetry
        // never fires (0/28 calls have metadataJson). Cheap (one log per
        // call) but answers the question conclusively.
        if (!firstMediaLogged) {
          firstMediaLogged = true
          console.log(`[inbound] first media event: track=${JSON.stringify(msg.media.track)} initialized=${initialized} gemini=${!!gemini}`)
        }
        if (initialized && gemini) {
          if (msg.media.track !== 'inbound') {
            // Diagnostic — log the FIRST track-mismatch reject per call so
            // we see what value Twilio is actually sending if it's not
            // 'inbound'. Without this we'd silently drop forever.
            if (!firstTrackRejectLogged) {
              firstTrackRejectLogged = true
              console.log(`[inbound] first track-rejection: track=${JSON.stringify(msg.media.track)} (expected 'inbound')`)
            }
            return
          }
          const mulawBuf = Buffer.from(msg.media.payload, 'base64')
          const pcm8k    = mulawToPcm16(mulawBuf)
          const pcm16k   = resamplePcm16(pcm8k, 8000, 16000)  // Gemini expects 16kHz
          gemini.sendAudio(pcm16k)
          lastUserAudioAt = Date.now()
        }
        return
      }

      if (msg.event === 'stop') {
        console.log('[inbound] Twilio stream stopped')
        gemini?.close()
      }
    } catch (err) {
      console.error('[inbound] message error:', err)
    }
  })

  ws.on('close', async () => {
    console.log('[inbound] WebSocket closed')
    stopSilenceTimer()
    gemini?.close()
    // Belt-and-suspenders: if Gemini's onClose hasn't fired (e.g. it never
    // connected, or the close event was lost), persist what we have anyway.
    await finalize('COMPLETED')
  })

  ws.on('error', async (err) => {
    console.error('[inbound] WebSocket error:', err.message)
    gemini?.close()
    await finalize('FAILED')
  })
}
