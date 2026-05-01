import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary } from './services/summary.service.js'
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
    console.log(`[outbound] hung up call ${callSid}`)
  } catch (err) {
    console.error('[outbound] hangup error:', err)
  }
}

type TwilioMsg =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start';     start: { streamSid: string; callSid: string; customParameters: Record<string, string> } }
  | { event: 'media';     media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop';      stop: { accountSid: string; callSid: string } }

export async function handleOutboundCall(ws: WebSocket) {
  console.log('[outbound] Twilio Media Stream connected')

  let streamSid       = ''
  let callSid         = ''
  let tenantId        = ''
  let attemptId       = ''
  let campaignId      = ''
  let initialized     = false

  const transcript: TranscriptEntry[] = []
  let gemini: ReturnType<typeof openGeminiLiveSession> | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let userSpoke = false

  // If the called party never responds within 45s, hang up (voicemail fallback / no answer)
  function startSilenceWatchdog() {
    silenceTimer = setTimeout(() => {
      if (!userSpoke) {
        console.log('[outbound] silence watchdog — no user response, hanging up')
        hangUpCall(callSid, tenantId)
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
        hangUpCall(callSid, tenantId)
        setTimeout(() => gemini?.close(), 500)
      }, 10_000)
    }, 10_000)
  }

  function stopInCallSilenceTimer() {
    if (inCallSilenceTimer) { clearTimeout(inCallSilenceTimer); inCallSilenceTimer = null }
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

    const [dna, prompts] = await Promise.all([
      prisma.businessDNA.findFirst({ where: { tenantId, isActive: true } }),
      prisma.promptVersion.findMany({
        where: { tenantId, status: 'PUBLISHED', scope: { in: ['TENANT', 'CHANNEL', 'ROLE'] } },
        select: { id: true, scope: true, channelType: true, agentRoleType: true, content: true },
      }),
    ])

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

    const greeting = campaignDescription
      ? `The call just connected. Introduce yourself warmly and explain: ${campaignDescription}. Be concise and friendly.`
      : `The call just connected. Introduce yourself warmly and explain why you're calling. Be concise and friendly.`

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
        transcript.push({ role, text, timestamp: Date.now() })
        if (role === 'user') {
          if (!userSpoke) {
            userSpoke = true
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
          }
          resetInCallSilenceTimer()
          if (GOODBYE_PATTERN.test(text)) {
            console.log('[outbound] goodbye detected — hanging up')
            stopInCallSilenceTimer()
            setTimeout(() => hangUpCall(callSid, tenantId), 2000)
          }
        }
      },
      onTurnComplete() {
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
    }, tenantGeminiKey)

    initialized = true
    console.log('[outbound] session ready, Gemini connecting…')
  }

  async function finalize(status: 'COMPLETED' | 'FAILED') {
    try {
      if (status === 'COMPLETED' && transcript.length > 0) {
        const summary = await generateSummary(transcript)
        await persistConversation({
          tenantId,
          sessionId: callSid,
          transcript,
          summary,
          channelType: 'OUTBOUND',
        })
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

  ws.on('close', () => {
    console.log('[outbound] WebSocket closed')
    stopInCallSilenceTimer()
    gemini?.close()
  })

  ws.on('error', (err) => {
    console.error('[outbound] WebSocket error:', err.message)
    gemini?.close()
  })
}
