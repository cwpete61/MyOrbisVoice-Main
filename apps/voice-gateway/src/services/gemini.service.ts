import { env } from '../lib/env.js'

// Gemini Live uses a WebSocket-based streaming API.
// We connect server-side and relay audio chunks between the visitor's browser and Gemini.

const GEMINI_LIVE_HOST = 'generativelanguage.googleapis.com'
const GEMINI_API_VERSION = 'v1alpha'
const GEMINI_MODEL = process.env['GEMINI_LIVE_MODEL']
  ? `models/${process.env['GEMINI_LIVE_MODEL']}`
  : 'models/gemini-2.5-flash-native-audio-latest'

// Gemini tool function declaration. The full schema lives in services/tools.ts;
// we accept it here as a structural type so this file stays free of tool logic.
export type GeminiFunctionDeclaration = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type GeminiToolCall = {
  /** Stable id Gemini expects echoed back in the function_response. */
  id:   string
  name: string
  args: Record<string, unknown>
}

export type GeminiSessionCallbacks = {
  onReady?: () => void
  onAudioChunk: (chunk: Buffer) => void
  onTranscriptDelta: (role: 'user' | 'assistant', text: string) => void
  onTurnComplete: () => void
  onInterrupted?: () => void  // model output was cut off by user speech
  onToolCall?: (call: GeminiToolCall) => void
  onError: (err: Error) => void
  onClose: () => void
}

export type GeminiSession = {
  sendAudio: (pcm16: Buffer) => void
  sendText: (text: string) => void
  signalTurnComplete: () => void  // explicit end-of-turn — bypasses VAD silence wait
  /** Reply to a tool_call with a structured response. */
  sendToolResponse: (id: string, name: string, response: Record<string, unknown>) => void
  close: () => void
}

export type OpenSessionOptions = {
  apiKeyOverride?: string
  voiceName?:      string
  tools?:          GeminiFunctionDeclaration[]
}

export function openGeminiLiveSession(
  systemPrompt: string,
  callbacks: GeminiSessionCallbacks,
  apiKeyOrOpts?: string | OpenSessionOptions,
  voiceName?: string,
): GeminiSession {
  // Backwards-compat with the original positional signature
  // (systemPrompt, callbacks, apiKeyOverride?, voiceName?). New callers can
  // pass an OpenSessionOptions object as the 3rd arg to also supply tools.
  const opts: OpenSessionOptions = typeof apiKeyOrOpts === 'object' && apiKeyOrOpts !== null
    ? apiKeyOrOpts
    : { apiKeyOverride: apiKeyOrOpts, voiceName }

  const apiKey = opts.apiKeyOverride ?? env.GEMINI_API_KEY
  // Gemini Live WebSocket URL
  const url =
    `wss://${GEMINI_LIVE_HOST}/ws/google.ai.generativelanguage.${GEMINI_API_VERSION}.GenerativeService.BidiGenerateContent` +
    `?key=${apiKey}`

  let ws: import('ws').WebSocket | null = null
  let closed = false

  async function connect() {
    const { WebSocket } = await import('ws')
    ws = new WebSocket(url)

    ws.on('open', () => {
      console.log('[gemini] WebSocket connected')
      // Send setup message with model and system prompt
      const setup: Record<string, unknown> = {
        model: GEMINI_MODEL,
        generation_config: {
          response_modalities: ['AUDIO'],
          ...(opts.voiceName ? { speech_config: { voice_config: { prebuilt_voice_config: { voice_name: opts.voiceName } } } } : {}),
        },
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        realtime_input_config: {
          automatic_activity_detection: {
            disabled: false,
            start_of_speech_sensitivity: 'START_SENSITIVITY_HIGH',
            end_of_speech_sensitivity:   'END_SENSITIVITY_HIGH',
            prefix_padding_ms:           20,
            silence_duration_ms:         100,  // 100ms — explicit mic_stop signal is the primary trigger
          },
        },
        input_audio_transcription:  {},
        output_audio_transcription: {},
      }

      // Tools — only attach when the caller actually has any. Gemini accepts
      // an array of tool blocks, each containing function_declarations.
      if (opts.tools && opts.tools.length > 0) {
        setup['tools'] = [{ function_declarations: opts.tools }]
      }

      ws!.send(JSON.stringify({ setup }))
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString('utf8'))
        const keys = Object.keys(msg)
        if (!keys.includes('serverContent') || process.env['GEMINI_DEBUG'] === 'true') {
          console.log('[gemini] msg keys:', keys, JSON.stringify(msg).slice(0, 200))
        }

        // Setup complete — Gemini is ready to receive input
        if (msg?.setupComplete !== undefined) {
          console.log('[gemini] setup complete')
          callbacks.onReady?.()
        }

        // Model interrupted by user speech — tell caller to clear its audio buffer
        if (msg?.serverContent?.interrupted) {
          callbacks.onInterrupted?.()
        }

        // Audio output from Gemini
        const audioParts = msg?.serverContent?.modelTurn?.parts ?? []
        for (const part of audioParts) {
          if (part.thought === true) continue
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            callbacks.onAudioChunk(Buffer.from(part.inlineData.data, 'base64'))
          }
          if (part.text) {
            callbacks.onTranscriptDelta('assistant', part.text)
          }
        }

        // Real-time transcription (arrives faster than modelTurn.parts.text)
        const inputTranscript  = msg?.serverContent?.inputTranscription?.text
        const outputTranscript = msg?.serverContent?.outputTranscription?.text
        if (inputTranscript)  callbacks.onTranscriptDelta('user',      inputTranscript)
        if (outputTranscript) callbacks.onTranscriptDelta('assistant', outputTranscript)

        if (msg?.serverContent?.turnComplete) {
          callbacks.onTurnComplete()
        }

        // Tool calls — Gemini Live emits these on `toolCall.functionCalls[]`.
        const toolCalls = msg?.toolCall?.functionCalls ?? []
        for (const call of toolCalls) {
          if (!callbacks.onToolCall) {
            console.warn(`[gemini] tool call ${call?.name} ignored — no handler registered`)
            continue
          }
          const id   = String(call?.id ?? '')
          const name = String(call?.name ?? '')
          const args = (call?.args && typeof call.args === 'object') ? call.args as Record<string, unknown> : {}
          if (!id || !name) {
            console.warn('[gemini] malformed tool_call (missing id or name):', call)
            continue
          }
          console.log(`[gemini] tool call → ${name} (id=${id})`)
          callbacks.onToolCall({ id, name, args })
        }
      } catch {
        // binary frame or non-JSON — ignore
      }
    })

    ws.on('error', (err: Error) => {
      console.error('[gemini] WebSocket error:', err.message)
      if (!closed) callbacks.onError(err)
    })

    ws.on('close', (code: number, reason: Buffer) => {
      console.log('[gemini] WebSocket closed, code:', code, 'reason:', reason?.toString())
      if (!closed) {
        closed = true
        callbacks.onClose()
      }
    })
  }

  connect().catch(callbacks.onError)

  return {
    sendAudio(pcm16k: Buffer) {
      if (!ws || ws.readyState !== 1) return
      ws.send(JSON.stringify({
        realtime_input: {
          audio: {
            data: pcm16k.toString('base64'),
            mime_type: 'audio/pcm;rate=16000',
          },
        },
      }))
    },

    sendText(text: string) {
      if (!ws || ws.readyState !== 1) return
      ws.send(JSON.stringify({
        client_content: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turn_complete: true,
        },
      }))
    },

    signalTurnComplete() {
      if (!ws || ws.readyState !== 1) return
      // Send an empty realtime_input with activity_end to tell Gemini the user stopped speaking
      ws.send(JSON.stringify({
        realtime_input: { activity_end: {} },
      }))
    },

    sendToolResponse(id, name, response) {
      if (!ws || ws.readyState !== 1) return
      // Gemini Live expects: tool_response: { function_responses: [{ id, name, response }] }
      ws.send(JSON.stringify({
        tool_response: {
          function_responses: [{ id, name, response }],
        },
      }))
    },

    close() {
      // Do NOT set closed=true here — let the ws 'close' event fire so onClose() runs finalize
      ws?.close()
    },
  }
}
