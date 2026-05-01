import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary, cleanTranscript } from './services/summary.service.js'
import { persistConversation, type TranscriptEntry } from './services/conversation.service.js'
import { mulawToPcm16, pcm16ToMulaw, resamplePcm16 } from './lib/mulaw.js'
import { getGeminiApiKey } from './lib/gemini-key.js'

const GOODBYE_PATTERN = /\b(goodbye|good-bye|bye|bye-bye|farewell|take care|have a good|have a great|talk (to you |with you )?(soon|later)|see you|thanks? (for calling|for your time)|thank you (for calling|for your time)|that('s| is) all|no (more )?questions|i('m| am) done|end the call|hang up)\b/i

async function hangUpCall(callSid: string, tenantId: string) {
  try {
    const conn = await prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'TWILIO', status: 'CONNECTED' },
      include: { twilioDetail: true },
    })
    if (!conn?.twilioDetail?.accountSid) return
    const { getTwilioAuthToken } = await import('./lib/twilio-auth.js')
    const authToken = await getTwilioAuthToken(tenantId)
    if (!authToken) return
    const accountSid = conn.twilioDetail.accountSid
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Status=completed',
    })
    console.log(`[inbound] hung up call ${callSid}`)
  } catch (err) {
    console.error('[inbound] hangup error:', err)
  }
}

// Twilio Media Stream message shapes
type TwilioMsg =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start';     start: { streamSid: string; callSid: string; customParameters: Record<string, string> } }
  | { event: 'media';     media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop';      stop: { accountSid: string; callSid: string } }

export async function handleInboundCall(ws: WebSocket) {
  console.log('[inbound] Twilio Media Stream connected')

  let streamSid  = ''
  let callSid    = ''
  let tenantId   = ''
  let channelConfigId = ''
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
  function sendAudioToTwilio(pcm24k: Buffer) {
    if (!streamSid || ws.readyState !== 1) return
    audioChunksSent++
    if (audioChunksSent === 1) console.log('[inbound] first audio chunk → Twilio')
    try {
      const pcm8k   = resamplePcm16(pcm24k, 24000, 8000)
      const mulaw   = pcm16ToMulaw(pcm8k)
      const payload = mulaw.toString('base64')
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload } }))
    } catch (err) {
      console.error('[inbound] sendAudioToTwilio error:', err)
    }
  }

  // Stop Twilio from playing buffered agent audio (barge-in)
  function clearTwilioAudio() {
    if (!streamSid || ws.readyState !== 1) return
    try { ws.send(JSON.stringify({ event: 'clear', streamSid })) } catch { /* ignore */ }
  }

  // In-call silence watchdog: 10s → check-in prompt, 20s → hang up
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let checkinSent = false

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer)
    checkinSent = false
    silenceTimer = setTimeout(() => {
      if (!initialized || !gemini) return
      console.log('[inbound] 10s silence — sending check-in')
      checkinSent = true
      gemini.sendText('The caller has been silent for 10 seconds. Politely ask if they are still there and need assistance.')
      silenceTimer = setTimeout(() => {
        console.log('[inbound] 20s silence — hanging up')
        hangUpCall(callSid, tenantId)
        setTimeout(() => gemini?.close(), 500)
      }, 10_000)
    }, 10_000)
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

    const channelCfgJson = (channelCfgRow?.configJson as Record<string, unknown> | null) ?? {}
    const voiceName = (channelCfgJson['voiceName'] as string | undefined) || 'Fenrir'

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

    const systemPrompt = resolveSystemPrompt(prompts as any[], dnaSnap)

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

    gemini = openGeminiLiveSession(systemPrompt, {
      onReady() {
        gemini?.sendText('The phone just connected. Greet the caller warmly and ask how you can help.')
        console.log('[inbound] sent opening greeting prompt to Gemini')
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
            setTimeout(() => hangUpCall(callSid, tenantId), 2000)
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
        console.log('[inbound] Gemini turn complete')
      },
      async onClose() {
        stopSilenceTimer()
        await finalize('COMPLETED')
      },
      async onError(err) {
        console.error('[inbound] Gemini error:', err.message)
        stopSilenceTimer()
        await finalize('FAILED')
        ws.close()
      },
    }, tenantGeminiKey, voiceName)

    initialized = true
    console.log('[inbound] session ready, Gemini connecting…')
  }

  async function finalize(status: 'COMPLETED' | 'FAILED') {
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
        })
      }
      // No widgetSession to update for inbound calls — CallLog is updated via status webhook
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
        await initSession(msg.start.customParameters)
        return
      }

      if (msg.event === 'media' && initialized && gemini) {
        if (msg.media.track !== 'inbound') return  // ignore outbound track echo
        const mulawBuf = Buffer.from(msg.media.payload, 'base64')
        const pcm8k    = mulawToPcm16(mulawBuf)
        const pcm16k   = resamplePcm16(pcm8k, 8000, 16000)  // Gemini expects 16kHz
        gemini.sendAudio(pcm16k)
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

  ws.on('close', () => {
    console.log('[inbound] WebSocket closed')
    stopSilenceTimer()
    gemini?.close()
  })

  ws.on('error', (err) => {
    console.error('[inbound] WebSocket error:', err.message)
    gemini?.close()
  })
}
