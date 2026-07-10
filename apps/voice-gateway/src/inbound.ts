import type { WebSocket } from 'ws'
import { prisma } from './lib/prisma.js'
import { resolveSystemPrompt, type PartnerContext } from './lib/prompt-resolver.js'
import { loadPartnerContext } from './lib/partner-context.js'
import { fetchKbForPrompt } from './lib/knowledge-base.js'
import { fetchListingsForPrompt } from './lib/listings.js'
import { verifyStreamAuth } from './lib/stream-auth.js'
import { findContactIdByPhone, getContactHistory, formatContactHistoryForPrompt } from './lib/contact-history.js'
import { openGeminiLiveSession } from './services/gemini.service.js'
import { analyzeConversation, cleanTranscript } from './services/summary.service.js'
import { persistConversation, type TranscriptEntry } from './services/conversation.service.js'
import { mulawToPcm16, pcm16ToMulaw, resamplePcm16, MulawFrameBuffer } from './lib/mulaw.js'
import { getGeminiApiKey, resolveGeminiApiKey } from './lib/gemini-key.js'
import { sendCallNotificationEmail } from './services/notify.service.js'
import { sendToTenant as sendPushToTenant } from './services/push.service.js'
import { TOOL_DECLARATIONS, buildToolGuidanceBlock, executeTool, rollbackToolCall, type ToolResult } from './services/tools.js'
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

// ---- Gateway-side call recording (demo) ----
// Mix two time-stamped PCM16 streams (caller + Orby, both 8kHz mono) into a
// single mono 8kHz WAV. Each chunk is placed on a shared timeline by its
// arrival time relative to session start, so gaps/overlaps land naturally and
// the two voices don't stack up at t=0.
type RecChunk = { t: number; pcm: Buffer }
function muxToWav(caller: RecChunk[], agent: RecChunk[], t0: number, rate = 8000): { wav: Buffer; durationSecs: number } | null {
  const all = [...caller, ...agent]
  if (all.length === 0 || t0 === 0) return null
  let maxSamples = 0
  for (const c of all) {
    const start = Math.max(0, Math.floor(((c.t - t0) * rate) / 1000))
    maxSamples = Math.max(maxSamples, start + c.pcm.length / 2)
  }
  if (maxSamples === 0) return null
  const mix = new Int16Array(maxSamples)
  const lay = (chunks: RecChunk[]) => {
    for (const c of chunks) {
      const start = Math.max(0, Math.floor(((c.t - t0) * rate) / 1000))
      const n = c.pcm.length / 2
      for (let i = 0; i < n; i++) {
        const idx = start + i
        if (idx >= maxSamples) break
        let s = mix[idx]! + c.pcm.readInt16LE(i * 2)
        if (s > 32767) s = 32767
        else if (s < -32768) s = -32768
        mix[idx] = s
      }
    }
  }
  lay(caller)
  lay(agent)
  const dataLen = mix.length * 2
  const wav = Buffer.alloc(44 + dataLen)
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataLen, 4); wav.write('WAVE', 8)
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(dataLen, 40)
  for (let i = 0; i < mix.length; i++) wav.writeInt16LE(mix[i]!, 44 + i * 2)
  return { wav, durationSecs: Math.round(mix.length / rate) }
}

const REC_API_BASE = (process.env['API_BASE_URL'] ?? 'http://localhost:4000').replace(/\/$/, '')
async function uploadGatewayRecording(callSid: string, tenantId: string, wav: Buffer, durationSecs: number): Promise<void> {
  const token = process.env['GATEWAY_INTERNAL_TOKEN']
  if (!token) { console.warn('[inbound] recording: GATEWAY_INTERNAL_TOKEN unset, skip upload'); return }
  const res = await fetch(`${REC_API_BASE}/api/internal/gateway/recording`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-gateway-token': token,
      'x-internal-tenant-id': tenantId,
    },
    body: JSON.stringify({ callSid, durationSecs, wavBase64: wav.toString('base64') }),
  })
  if (!res.ok) throw new Error(`recording upload ${res.status}: ${await res.text().catch(() => '')}`)
  console.log(`[inbound] recording uploaded callSid=${callSid} ${(wav.length / 1024).toFixed(0)}KB ${durationSecs}s`)
}

// Twilio Media Stream message shapes
type TwilioMsg =
  | { event: 'connected'; protocol: string; version: string }
  | { event: 'start';     start: { streamSid: string; callSid: string; accountSid?: string; customParameters: Record<string, string> } }
  | { event: 'media';     media: { track: string; chunk: string; timestamp: string; payload: string } }
  | { event: 'stop';      stop: { accountSid: string; callSid: string } }
  | { event: 'dtmf';      dtmf: { track?: string; digit: string }; streamSid?: string }

export async function handleInboundCall(ws: WebSocket) {
  console.log('[inbound] Twilio Media Stream connected')

  let streamSid  = ''
  let callSid    = ''
  let tenantId   = ''
  let channelConfigId = ''
  let demoSessionId: string | null = null
  // DEMO line (option A): Orby is held silent at answer until the caller's PIN
  // arrives (or a short timeout), so the whole call binds to the demo session
  // from the first word. Non-demo calls never hold.
  let demoPinCapture = false
  let demoRecord     = false
  let dtmfBuffer     = ''
  let dtmfTimer: ReturnType<typeof setTimeout> | null = null
  let pinHoldResolve: (() => void) | null = null
  function releasePinHold() {
    if (pinHoldResolve) { const r = pinHoldResolve; pinHoldResolve = null; r() }
  }
  function waitForPinOrTimeout(ms: number): Promise<void> {
    return new Promise(resolve => {
      pinHoldResolve = resolve
      setTimeout(() => releasePinHold(), ms)
    })
  }
  let ownerAccountSid: string | null = null

  // ── Raw audio capture (diagnostic) ─────────────────────────────────────────
  // When VG_CAPTURE_RAW=1, accumulate the raw 24 kHz PCM16 chunks Gemini emits
  // (BEFORE our downsample) so we can validate the resampler offline without
  // the MP3 transcode confound that Twilio's recording introduces. Written to
  // /tmp/vg-capture/<callSid>.pcm24k on call finalize. Off by default — no
  // perf or privacy impact in normal operation. See
  // infrastructure/scripts/analyze-resampler.mjs for the offline comparison.
  const CAPTURE_RAW = process.env['VG_CAPTURE_RAW'] === '1'
  const rawChunks: Buffer[] = []

  // Gateway-side call recording for DEMO calls. Twilio's call-recording API
  // crashes <Connect><Stream> calls, so we mux the media stream ourselves:
  // buffer caller audio (8kHz from Twilio) + Orby audio (resampled to 8kHz),
  // each time-stamped, then mix to a mono 8kHz WAV at session end and upload.
  // Passive (just copies audio we already handle) so it can't disrupt the call.
  let recT0 = 0
  const recCaller: { t: number; pcm: Buffer }[] = []
  const recAgent:  { t: number; pcm: Buffer }[] = []
  let initialized = false

  const transcript: TranscriptEntry[] = []
  // Diagnostic: count transcription deltas Gemini actually sends for this phone
  // call. If this is 0 at finalize, Gemini isn't transcribing the phone audio
  // (config/format), not a flush bug — that's why inbound saves no transcript.
  let deltaCount = 0
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
  // Frame normalizer — accumulates outbound μ-law into exact 160-byte (20ms)
  // frames so Twilio doesn't see boundary discontinuities. See mulaw.ts.
  const outboundFrameBuf = new MulawFrameBuffer()

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
  // Tool-call lifecycle tracker — keyed by Gemini's tool-call id. Lets us
  // compensate (e.g. cancel a freshly-booked appointment) when Gemini emits
  // a `toolCallCancellation` AFTER the API call already committed.
  type ToolCallEntry = { name: string; cancelled: boolean; result?: ToolResult }
  const toolCallTracker = new Map<string, ToolCallEntry>()

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
    if (CAPTURE_RAW) rawChunks.push(Buffer.from(pcm24k))
    try {
      const pcm8k = resamplePcm16(pcm24k, 24000, 8000)
      if (demoRecord) { if (!recT0) recT0 = Date.now(); recAgent.push({ t: Date.now(), pcm: Buffer.from(pcm8k) }) }
      const mulaw = pcm16ToMulaw(pcm8k)
      // Emit only whole 160-byte (20ms) frames to Twilio. Partial tail
      // stays buffered; flushes on call-end or onInterrupted.
      const frames = outboundFrameBuf.push(mulaw)
      for (const f of frames) {
        ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: f.toString('base64') } }))
      }
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
    // Drop any pending tail — barge-in means the user is cutting off the
    // agent; stale agent bytes shouldn't trickle onto the wire after clear.
    outboundFrameBuf.reset()
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

  // DEMO line (option C): accumulate keypad digits and bind the call to the
  // matching demo session once 6 digits arrive. Runs only when demoPinCapture
  // is set and no session is bound yet. Never interrupts Orby — the audio path
  // is untouched; this just tags the conversation for the cockpit session view.
  async function handleDtmfDigit(digit: string) {
    if (!demoPinCapture || demoSessionId) return
    if (digit === '#' || digit === '*') { dtmfBuffer = ''; return }
    if (!/^[0-9]$/.test(digit)) return
    dtmfBuffer += digit
    if (dtmfTimer) clearTimeout(dtmfTimer)
    dtmfTimer = setTimeout(() => { dtmfBuffer = '' }, 8000) // drop stale partial entries
    if (dtmfBuffer.length < 6) return
    const pin  = dtmfBuffer.slice(-6)
    dtmfBuffer = ''
    if (dtmfTimer) { clearTimeout(dtmfTimer); dtmfTimer = null }
    try {
      const session = await prisma.demoSession.findFirst({ where: { pin, expiresAt: { gt: new Date() } } })
      if (session) {
        demoSessionId = session.id
        await prisma.demoSession.update({
          where: { id: session.id },
          data:  { callCount: { increment: 1 }, lastCallAt: new Date() },
        }).catch(() => {})
        console.log(`[inbound] demo PIN matched → session ${session.id} bound callSid=${callSid}`)
      } else {
        console.log('[inbound] demo PIN entered but no active session matched — starting Orby unbound')
      }
    } catch (e) {
      console.warn('[inbound] demo PIN lookup failed:', (e as Error).message)
    }
    // Release the answer-time hold so Orby starts now (bound if the PIN matched,
    // unbound otherwise — a mistyped digit never leaves the caller in silence).
    releasePinHold()
  }

  async function initSession(params: Record<string, string>) {
    tenantId        = params['tenantId']        ?? ''
    channelConfigId = params['channelConfigId'] ?? ''
    callSid         = params['callSid']         ?? callSid
    const fromNumber = params['fromNumber'] ?? ''
    const partnerId  = params['partnerId']  ?? ''
    demoSessionId    = params['demoSessionId'] || null
    demoPinCapture   = params['demoPinCapture'] === '1'
    demoRecord       = params['demoRecord'] === '1' || demoPinCapture

    console.log(`[inbound] init session tenantId=${tenantId} callSid=${callSid} from=${fromNumber || '(blocked)'}${partnerId ? ` partner=${partnerId}` : ''}${demoSessionId ? ` demoSession=${demoSessionId}` : ''}`)

    if (!tenantId) {
      console.error('[inbound] missing tenantId in stream params')
      ws.close()
      return
    }

    // Reject forged streams: the tenantId must be backed by a valid signature
    // minted by the API at TwiML-build time (skipped only in dev without secret).
    if (!verifyStreamAuth(tenantId, params)) {
      console.error(`[inbound] stream auth failed for tenantId=${tenantId} callSid=${callSid} — rejecting`)
      ws.close(1008, 'Unauthorized stream')
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

    // Load active DNA, published prompts, channel config, and the tenant's
    // Orby-payment config for this tenant.
    const [dna, prompts, channelCfgRow, payCfg] = await Promise.all([
      prisma.businessDNA.findFirst({ where: { tenantId, isActive: true } }),
      prisma.promptVersion.findMany({
        where: { tenantId, status: 'PUBLISHED', scope: { in: ['TENANT', 'CHANNEL', 'ROLE'] } },
        select: { id: true, scope: true, channelType: true, agentRoleType: true, content: true },
      }),
      channelConfigId
        ? prisma.channelConfig.findUnique({ where: { id: channelConfigId }, select: { configJson: true } })
        : Promise.resolve(null),
      prisma.tenant.findUnique({
        where:  { id: tenantId },
        select: { orbyPaymentsEnabled: true, stripeChargesEnabled: true, orbyDepositCents: true },
      }),
    ])

    const channelCfgJson  = (channelCfgRow?.configJson as Record<string, unknown> | null) ?? {}
    const voiceName       = (channelCfgJson['voiceName']       as string  | undefined) || 'Aoede'
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

    const [kbBase, listingsText] = await Promise.all([
      fetchKbForPrompt(tenantId).catch(e => {
        console.error('[inbound] kb fetch failed (non-fatal):', e?.message ?? e)
        return null
      }),
      fetchListingsForPrompt(tenantId).catch(e => {
        console.error('[inbound] listings fetch failed (non-fatal):', e?.message ?? e)
        return null
      }),
    ])
    const kbText = [kbBase, listingsText].filter(Boolean).join('\n\n') || null
    // Phase E.7 — cross-session memory. If the caller ID matches a known
    // contact, fetch their prior conversations + CRM facts and inject as a
    // Caller Context layer in the system prompt. No-op when caller ID is
    // blocked or the number has never called before — first-time callers get
    // the normal cold-start flow.
    let callerHistoryBlock: string | null = null
    if (fromNumber) {
      try {
        const contactId = await findContactIdByPhone(tenantId, fromNumber)
        if (contactId) {
          const history = await getContactHistory(tenantId, contactId)
          callerHistoryBlock = formatContactHistoryForPrompt(history)
          if (callerHistoryBlock) {
            console.log(`[inbound] caller history loaded for ${fromNumber} (${history?.totalConversations ?? 0} prior interactions)`)
          }
        }
      } catch (e) {
        console.error('[inbound] caller history fetch failed (non-fatal):', (e as Error).message)
      }
    }

    // Partner-owned number — load the partner identity so Orby answers AS the
    // partner's agent (their name, their business). Null for platform/tenant
    // numbers, which keeps the generic platform agent path unchanged.
    let partnerContext: PartnerContext | null = null
    if (partnerId) {
      partnerContext = await loadPartnerContext(partnerId)
      if (partnerContext) {
        console.log(`[inbound] partner context loaded — Orby answering as ${partnerContext.displayName}`)
      }
    }

    let systemPrompt = resolveSystemPrompt(
      prompts as any[],
      dnaSnap,
      'INBOUND',
      buildToolGuidanceBlock(),
      kbText,
      partnerContext,        // partner — set for partner-owned inbound numbers
      callerHistoryBlock,    // E.7 — Caller Context layer
    )

    // Phase 2 — on-call payments. Only instruct Orby to offer/take payment when
    // the tenant has BOTH turned it on AND finished Stripe onboarding. Without
    // this block in the prompt, Orby never raises payment (the tool guidance
    // says to use collect_payment only when instructed or asked).
    if (payCfg?.orbyPaymentsEnabled && payCfg.stripeChargesEnabled) {
      const dep = payCfg.orbyDepositCents ? `$${(payCfg.orbyDepositCents / 100).toFixed(2)}` : null
      systemPrompt += '\n\n--- Payments enabled ---\n' +
        'This business accepts payments on calls via a texted Stripe link. ' +
        (dep
          ? `After you successfully book an appointment, offer to secure it with a ${dep} deposit. `
          : 'When a deposit or payment is appropriate after booking, offer it. ') +
        'If the caller agrees, or asks to pay at any point, call collect_payment to text them a secure link. ' +
        'Confirm the amount aloud before charging anything other than the default deposit. ' +
        'After it succeeds, tell the caller you have texted them the link.'
    }

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

    // Today's date stamp helps the agent disambiguate "Friday" vs "tomorrow"
    // when both refer to the same day. Captured server-side so the model
    // can't drift by guessing dates from training data.
    const todayLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

    // Caller-ID line — the agent reads this back when collecting contact info
    // instead of asking the caller to recite digits. Caller ID can be blocked
    // (empty / "Anonymous"); in that case the agent falls back to asking.
    const callerIdLine = fromNumber
      ? `Caller ID for this call: ${fromNumber}. Read this number back to the caller when confirming contact info — do not ask them to recite their phone number unless caller ID is missing.`
      : `Caller ID is blocked or unavailable for this call — you will need to ask the caller for their phone number.`

    // DEMO line (470): hold Orby silent for ~3s so the PIN binds the demo
    // session before the greeting — Orby must NOT greet before the PIN activates
    // the demo. 3s covers the mobile auto-PIN (tel: postdial lands ~2s after
    // answer) without a long dead-air wait. A PIN keyed during the window
    // releases the hold instantly; a later manual PIN still binds mid-call via
    // the DTMF handler (it just misses the greeting turn in the cockpit). The
    // instant, no-PIN public line lives on 929 (a separate route).
    if (demoPinCapture) {
      console.log('[inbound] demo: holding Orby until PIN or timeout (3s)')
      await waitForPinOrTimeout(3_000)
      console.log(`[inbound] demo hold released — session=${demoSessionId ?? '(unbound)'}`)
    }

    gemini = openGeminiLiveSession(systemPrompt, {
      onReady() {
        if (agentSpeaksFirst) {
          // Demo calls are not audio-recorded (Twilio call-recording breaks the
          // media stream), so no recording notice in the greeting.
          const demoRecordingLine = ''
          gemini?.sendText(
            `A call has just connected to ${businessName}. ` +
            `Today is ${todayLabel}. ` +
            `${callerIdLine} ` +
            `You must speak immediately — do not wait for the caller. ` +
            `Open with your professional greeting now. ${demoRecordingLine}In one short sentence after the greeting, briefly tell the caller what you can help them with — pull from the business's primaryServices, appointmentTypes, or services in your context (e.g. "I can help you book a demo or answer tech support questions"). Keep it to 1-2 things max — list more and the caller can't track them on a phone call. Then ask "What can I help you with today?" or similar.`
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
        deltaCount++
        // If the speaker switches, flush the previous speaker's buffer first
        if (lastRole && lastRole !== role) {
          flushBuffer(lastRole)
        }
        lastRole = role

        if (role === 'user') {
          userBuffer += (userBuffer ? ' ' : '') + text
          resetSilenceTimer()
          if (GOODBYE_PATTERN.test(text)) {
            console.log('[inbound] goodbye detected (user) — hanging up')
            stopSilenceTimer()
            setTimeout(() => hangUpCall(callSid, ownerAccountSid), 2000)
          }
        } else {
          agentBuffer += (agentBuffer ? ' ' : '') + text
          // Detect AGENT goodbyes too — added 2026-05-07 after the test
          // call showed agent + user trading goodbyes 3+ times before the
          // call dropped. Watching only user goodbyes left the agent
          // farewell unhandled until the silence watchdog timed out at
          // 60s. 3s delay gives the agent's farewell sentence time to
          // play out cleanly before Twilio drops the channel.
          if (GOODBYE_PATTERN.test(text)) {
            console.log('[inbound] goodbye detected (agent) — hanging up')
            stopSilenceTimer()
            setTimeout(() => hangUpCall(callSid, ownerAccountSid), 3000)
          }
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
        // Track this call so we can compensate if Gemini cancels it after
        // the API has already committed a side effect (book_appointment
        // creates real DB rows + Google Calendar events). Map entry:
        //   { name, cancelled, result? }
        // Cancelled before API returns → compensate after; cancelled after
        // API returned → the cancellation handler does the compensating.
        toolCallTracker.set(call.id, { name: call.name, cancelled: false })
        try {
          const result = await executeTool(call.name, call.args, {
            tenantId,
            externalCallId: callSid,
            callSid,
            ownerAccountSid,
          })
          const tracker = toolCallTracker.get(call.id)
          if (tracker) tracker.result = result
          gemini?.sendToolResponse(call.id, call.name, result)
          // If the cancellation arrived during the in-flight API call, the
          // onToolCallCancellation handler set `cancelled=true` but couldn't
          // compensate yet (no result). Now we have one — do it.
          if (tracker?.cancelled) {
            await rollbackToolCall(call.name, result, {
              tenantId, externalCallId: callSid, callSid, ownerAccountSid,
            })
          }
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
      onToolCallCancellation(ids) {
        // Roll back any side effect we already committed for cancelled calls.
        // If the API call is still in flight, we mark the tracker entry
        // cancelled and let onToolCall do the compensating once the result
        // lands.
        for (const id of ids) {
          const tracker = toolCallTracker.get(id)
          if (!tracker) {
            // Cancellation arrived for an unknown id — nothing to do, but
            // record it in case the tool call message is still on the wire.
            toolCallTracker.set(id, { name: '?', cancelled: true })
            continue
          }
          tracker.cancelled = true
          if (tracker.result) {
            rollbackToolCall(tracker.name, tracker.result, {
              tenantId, externalCallId: callSid, callSid, ownerAccountSid,
            }).catch(err => console.warn('[inbound] rollback failed:', err))
          }
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
    // Dump captured raw 24kHz agent PCM for offline resampler analysis.
    if (CAPTURE_RAW && rawChunks.length > 0) {
      try {
        const { promises: fsp } = await import('node:fs')
        await fsp.mkdir('/tmp/vg-capture', { recursive: true })
        const out = Buffer.concat(rawChunks)
        const fpath = `/tmp/vg-capture/${callSid || 'unknown'}.pcm24k`
        await fsp.writeFile(fpath, out)
        console.log(`[inbound] CAPTURE_RAW wrote ${out.length} bytes (${(out.length / 2 / 24000).toFixed(1)}s @ 24kHz) → ${fpath}`)
      } catch (err) {
        console.error('[inbound] CAPTURE_RAW write failed:', err)
      }
    }
    try {
      // Flush any incomplete turn buffers before persisting
      if (userBuffer.trim())  flushBuffer('user')
      if (agentBuffer.trim()) flushBuffer('assistant')

      if (status === 'COMPLETED' && transcript.length > 0) {
        const cleaned = await cleanTranscript(transcript)
        const analysis = await analyzeConversation(cleaned)
        await persistConversation({
          tenantId,
          sessionId: callSid,
          transcript: cleaned,
          summary: analysis.summary,
          attentionLevel: analysis.attentionLevel,
          attentionReason: analysis.attentionReason,
          showingBrief: analysis.showingBrief,
          channelType: 'INBOUND',
          turnLatenciesMs,
          demoSessionId,
        })
        if (turnLatenciesMs.length > 0) {
          const sorted = [...turnLatenciesMs].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          console.log(`[inbound] latency summary: turns=${turnLatenciesMs.length} median=${median}ms p95=${sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]}ms`)
        }
        console.log(`[inbound] conversation persisted callSid=${callSid} turns=${transcript.length} deltas=${deltaCount}`)

        // Best-effort: mux + upload the demo call recording. Gateway-side
        // because Twilio's recording API crashes <Connect><Stream> calls.
        // Runs after persist so the conversation row exists to attach to.
        if (demoRecord && (recCaller.length > 0 || recAgent.length > 0)) {
          try {
            const muxed = muxToWav(recCaller, recAgent, recT0)
            if (muxed) await uploadGatewayRecording(callSid, tenantId, muxed.wav, muxed.durationSecs)
          } catch (err) {
            console.error('[inbound] recording mux/upload failed:', err)
          }
        }
      } else {
        console.log(`[inbound] finalize ${status} — transcript len=${transcript.length} deltas=${deltaCount}, not persisting`)
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
          if (demoRecord) { if (!recT0) recT0 = Date.now(); recCaller.push({ t: Date.now(), pcm: Buffer.from(pcm8k) }) }
          const pcm16k   = resamplePcm16(pcm8k, 8000, 16000)  // Gemini expects 16kHz
          gemini.sendAudio(pcm16k)
          lastUserAudioAt = Date.now()
        }
        return
      }

      if (msg.event === 'dtmf') {
        await handleDtmfDigit(msg.dtmf?.digit ?? '')
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
