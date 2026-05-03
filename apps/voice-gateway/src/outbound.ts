import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary, cleanTranscript } from './services/summary.service.js'
import { persistConversation, type TranscriptEntry } from './services/conversation.service.js'
import { mulawToPcm16, pcm16ToMulaw, resamplePcm16 } from './lib/mulaw.js'
import { getGeminiApiKey, resolveGeminiApiKey } from './lib/gemini-key.js'

const GOODBYE_PATTERN = /\b(goodbye|good-bye|bye|bye-bye|farewell|take care|have a good|have a great|talk (to you |with you )?(soon|later)|see you|thanks? (for calling|for your time)|thank you (for calling|for your time)|that('s| is) all|no (more )?questions|i('m| am) done|end the call|hang up)\b/i

// `ownerAccountSid` is the subaccount sid that owns this call resource —
// captured from Twilio's Media Stream `start` event. Master credentials
// authenticate, but the URL path must use the owner sid or Twilio 404s.
async function hangUpCall(callSid: string, ownerAccountSid: string | null) {
  try {
    const { getTwilioAccountSid, getTwilioAuthToken } = await import('./lib/twilio-auth.js')
    const [masterSid, masterToken] = await Promise.all([getTwilioAccountSid(), getTwilioAuthToken()])
    if (!ownerAccountSid || !masterSid || !masterToken) {
      console.warn('[outbound] hangup skipped — missing master creds or owner sid')
      return
    }
    // Authenticate as master (basic-auth SID must match the token's owner);
    // subaccount sid goes in the URL path. Master can manage subaccount calls.
    const credentials = Buffer.from(`${masterSid}:${masterToken}`).toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ownerAccountSid}/Calls/${callSid}.json`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Status=completed',
    })
    if (!res.ok) {
      console.warn(`[outbound] hangup failed ${res.status}: ${await res.text().catch(() => '')}`)
      return
    }
    console.log(`[outbound] hung up call ${callSid}`)
  } catch (err) {
    console.error('[outbound] hangup error:', err)
  }
}

type TwilioMsg =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start';     start: { streamSid: string; callSid: string; accountSid?: string; customParameters: Record<string, string> } }
  | { event: 'media';     media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop';      stop: { accountSid: string; callSid: string } }

export async function handleOutboundCall(ws: WebSocket) {
  console.log('[outbound] Twilio Media Stream connected')

  let streamSid       = ''
  let callSid         = ''
  let tenantId        = ''
  let attemptId       = ''
  let campaignId      = ''
  let ownerAccountSid: string | null = null
  let initialized     = false

  const transcript: TranscriptEntry[] = []
  let gemini: ReturnType<typeof openGeminiLiveSession> | null = null

  // Accumulate streaming deltas into complete turns before pushing to transcript
  let userBuffer  = ''
  let agentBuffer = ''
  let lastRole: 'user' | 'assistant' | null = null

  function flushBuffer(role: 'user' | 'assistant') {
    const text = role === 'user' ? userBuffer.trim() : agentBuffer.trim()
    if (text) {
      transcript.push({ role, text, timestamp: Date.now() })
    }
    if (role === 'user') userBuffer = ''
    else agentBuffer = ''
  }

  let userSpoke = false
  let silenceWatchdog: ReturnType<typeof setTimeout> | null = null

  // If the called party never responds within 45s, hang up (voicemail fallback / no answer)
  function startSilenceWatchdog() {
    silenceWatchdog = setTimeout(() => {
      if (!userSpoke) {
        console.log('[outbound] silence watchdog — no user response, hanging up')
        hangUpCall(callSid, ownerAccountSid)
        setTimeout(() => gemini?.close(), 500)
      }
    }, 45_000)
  }

  let audioChunksSent = 0
  function sendAudioToTwilio(pcm24k: Buffer) {
    if (!streamSid || ws.readyState !== 1) return
    audioChunksSent++
    if (audioChunksSent === 1) console.log('[outbound] first audio chunk → Twilio')
    try {
      const pcm8k   = resamplePcm16(pcm24k, 24000, 8000)
      const mulaw   = pcm16ToMulaw(pcm8k)
      const payload = mulaw.toString('base64')
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload } }))
    } catch (err) {
      console.error('[outbound] sendAudioToTwilio error:', err)
    }
  }

  function clearTwilioAudio() {
    if (!streamSid || ws.readyState !== 1) return
    try { ws.send(JSON.stringify({ event: 'clear', streamSid })) } catch { /* ignore */ }
  }

  // In-call silence watchdog: 10s → check-in, 20s → hang up
  let inCallSilenceTimer: ReturnType<typeof setTimeout> | null = null

  function resetInCallSilenceTimer() {
    if (inCallSilenceTimer) clearTimeout(inCallSilenceTimer)
    inCallSilenceTimer = setTimeout(() => {
      if (!initialized || !gemini) return
      console.log('[outbound] 10s silence — sending check-in')
      gemini.sendText('The person has been silent for 10 seconds. Politely ask if they are still there.')
      inCallSilenceTimer = setTimeout(() => {
        console.log('[outbound] 20s silence — hanging up')
        hangUpCall(callSid, ownerAccountSid)
        setTimeout(() => gemini?.close(), 500)
      }, 10_000)
    }, 10_000)
  }

  function stopInCallSilenceTimer() {
    if (inCallSilenceTimer) { clearTimeout(inCallSilenceTimer); inCallSilenceTimer = null }
    if (silenceWatchdog)    { clearTimeout(silenceWatchdog);    silenceWatchdog = null }
  }

  async function initSession(params: Record<string, string>) {
    tenantId   = params['tenantId']   ?? ''
    attemptId  = params['attemptId']  ?? ''
    campaignId = params['campaignId'] ?? ''
    callSid    = params['callSid']    ?? callSid

    console.log(`[outbound] init session tenantId=${tenantId} attemptId=${attemptId} callSid=${callSid}`)

    if (!tenantId) {
      console.error('[outbound] missing tenantId in stream params')
      ws.close()
      return
    }

    // Load campaign context for the greeting
    let campaignDescription = ''
    if (campaignId) {
      try {
        const campaign = await prisma.outboundCampaign.findUnique({ where: { id: campaignId } })
        campaignDescription = campaign?.description ?? ''
      } catch { /* non-fatal */ }
    }

    // Load active DNA, published prompts, and outbound channel config
    const [dna, prompts, outboundChannel] = await Promise.all([
      prisma.businessDNA.findFirst({ where: { tenantId, isActive: true } }),
      prisma.promptVersion.findMany({
        where: { tenantId, status: 'PUBLISHED', scope: { in: ['TENANT', 'CHANNEL', 'ROLE'] } },
        select: { id: true, scope: true, channelType: true, agentRoleType: true, content: true },
      }),
      prisma.channelConfig.findFirst({
        where: { tenantId, channelType: 'OUTBOUND' },
        select: { configJson: true },
      }),
    ])

    const channelCfgJson = (outboundChannel?.configJson as Record<string, unknown> | null) ?? {}
    const voiceName      = (channelCfgJson['voiceName'] as string | undefined) || 'Fenrir'

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

    // Build greeting from DNA business name + campaign description
    const identityJson  = dna?.identityJson as Record<string, unknown> | null | undefined
    const businessName  = (identityJson?.['businessName'] as string | undefined)
      || (identityJson?.['name'] as string | undefined)
      || 'our company'

    const greeting = campaignDescription
      ? `The outbound call just connected on behalf of ${businessName}. Introduce yourself warmly and explain: ${campaignDescription}. Be concise and friendly — speak immediately.`
      : `The outbound call just connected on behalf of ${businessName}. Introduce yourself warmly and explain why you're calling. Be concise and friendly — speak immediately.`

    // Look up tenant Gemini API key; fall back to platform env key
    const geminiConn = await prisma.integrationConnection.findFirst({
      where: { tenantId, provider: 'GEMINI', status: 'CONNECTED' },
    })
    let tenantGeminiKey: string | undefined
    if (geminiConn) {
      const meta = geminiConn.metadataJson as Record<string, string> | null
      const enc = meta?.['encryptedApiKey']
      if (enc) {
        try { tenantGeminiKey = getGeminiApiKey(enc) ?? undefined } catch { /* fallback */ }
      }
    }
    const effectiveGeminiKey = await resolveGeminiApiKey(tenantGeminiKey)

    gemini = openGeminiLiveSession(systemPrompt, {
      onReady() {
        gemini?.sendText(greeting)
        console.log('[outbound] sent opening prompt to Gemini')
        startSilenceWatchdog()
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
          if (!userSpoke) {
            userSpoke = true
            if (silenceWatchdog) { clearTimeout(silenceWatchdog); silenceWatchdog = null }
          }
          resetInCallSilenceTimer()
          if (GOODBYE_PATTERN.test(text)) {
            console.log('[outbound] goodbye detected — hanging up')
            stopInCallSilenceTimer()
            setTimeout(() => hangUpCall(callSid, ownerAccountSid), 2000)
          }
        } else {
          agentBuffer += (agentBuffer ? ' ' : '') + text
        }
      },
      onTurnComplete() {
        // Agent finished speaking — flush the completed agent turn
        if (agentBuffer.trim()) flushBuffer('assistant')
        // Also flush any pending user turn
        if (userBuffer.trim()) flushBuffer('user')
        lastRole = null
        console.log('[outbound] Gemini turn complete')
      },
      async onClose() {
        stopInCallSilenceTimer()
        await finalize('COMPLETED')
      },
      async onError(err) {
        console.error('[outbound] Gemini error:', err.message)
        stopInCallSilenceTimer()
        await finalize('FAILED')
        ws.close()
      },
    }, effectiveGeminiKey, voiceName)

    initialized = true
    console.log('[outbound] session ready, Gemini connecting…')
  }

  let finalized = false
  async function finalize(status: 'COMPLETED' | 'FAILED') {
    if (finalized) return
    finalized = true
    try {
      // Flush any incomplete turn buffers
      if (userBuffer.trim())  flushBuffer('user')
      if (agentBuffer.trim()) flushBuffer('assistant')

      if (status === 'COMPLETED' && transcript.length > 0) {
        const cleaned     = await cleanTranscript(transcript)
        const summary     = await generateSummary(cleaned)
        const conversationId = await persistConversation({
          tenantId,
          sessionId: callSid,
          transcript: cleaned,
          summary,
          channelType: 'OUTBOUND',
        })

        // Link conversation back to the OutboundCallAttempt
        if (attemptId && conversationId) {
          await prisma.outboundCallAttempt.updateMany({
            where: { id: attemptId },
            data:  { conversationId },
          }).catch(err => console.warn('[outbound] could not link conversationId:', err))
        }
        console.log(`[outbound] conversation persisted callSid=${callSid} turns=${transcript.length}`)
      } else {
        console.log(`[outbound] finalize ${status} — transcript len=${transcript.length}, not persisting`)
      }
    } catch (err) {
      console.error('[outbound] finalize error:', err)
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

      if (msg.event === 'media' && initialized && gemini) {
        if (msg.media.track !== 'inbound') return
        const mulawBuf = Buffer.from(msg.media.payload, 'base64')
        const pcm8k    = mulawToPcm16(mulawBuf)
        const pcm16k   = resamplePcm16(pcm8k, 8000, 16000)  // Gemini expects 16kHz
        gemini.sendAudio(pcm16k)
        return
      }

      if (msg.event === 'stop') {
        console.log('[outbound] Twilio stream stopped')
        gemini?.close()
      }
    } catch (err) {
      console.error('[outbound] message error:', err)
    }
  })

  ws.on('close', async () => {
    console.log('[outbound] WebSocket closed')
    stopInCallSilenceTimer()
    gemini?.close()
    await finalize('COMPLETED')
  })

  ws.on('error', async (err) => {
    console.error('[outbound] WebSocket error:', err.message)
    gemini?.close()
    await finalize('FAILED')
  })
}
