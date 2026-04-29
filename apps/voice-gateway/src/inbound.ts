import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt } from './lib/prompt-resolver.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { generateSummary } from './services/summary.service.js'
import { persistConversation, markSessionFailed, type TranscriptEntry } from './services/conversation.service.js'
import { mulawToPcm16, pcm16ToMulaw, resamplePcm16 } from './lib/mulaw.js'

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

  // Buffer Gemini audio (PCM16 24kHz) → downsample → mulaw 8kHz → send to Twilio
  function sendAudioToTwilio(pcm24k: Buffer) {
    if (!streamSid || ws.readyState !== 1) return
    try {
      const pcm8k   = resamplePcm16(pcm24k, 24000, 8000)
      const mulaw   = pcm16ToMulaw(pcm8k)
      const payload = mulaw.toString('base64')
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload } }))
    } catch (err) {
      console.error('[inbound] sendAudioToTwilio error:', err)
    }
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

    // Load active DNA and published prompts for this tenant
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

    gemini = openGeminiLiveSession(systemPrompt, {
      onAudioChunk(chunk) {
        sendAudioToTwilio(chunk)
      },
      onTranscriptDelta(role, text) {
        transcript.push({ role, text, timestamp: Date.now() })
      },
      onTurnComplete() {
        console.log('[inbound] Gemini turn complete')
      },
      async onClose() {
        await finalize('COMPLETED')
      },
      async onError(err) {
        console.error('[inbound] Gemini error:', err.message)
        await finalize('FAILED')
        ws.close()
      },
    })

    initialized = true
    console.log('[inbound] session ready, Gemini connecting…')
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
          channelType: 'INBOUND',
        })
      } else {
        await markSessionFailed(callSid).catch(() => null)
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
        await initSession(msg.start.customParameters)
        return
      }

      if (msg.event === 'media' && initialized && gemini) {
        if (msg.media.track !== 'inbound') return  // ignore outbound track echo
        const mulawBuf = Buffer.from(msg.media.payload, 'base64')
        const pcm8k    = mulawToPcm16(mulawBuf)
        const pcm24k   = resamplePcm16(pcm8k, 8000, 24000)
        gemini.sendAudio(pcm24k)
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
    gemini?.close()
  })

  ws.on('error', (err) => {
    console.error('[inbound] WebSocket error:', err.message)
    gemini?.close()
  })
}
