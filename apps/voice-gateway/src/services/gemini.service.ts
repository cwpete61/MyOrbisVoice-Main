import { env } from '../lib/env.js'
import type { TranscriptEntry } from './conversation.service.js'

// Gemini Live uses a WebSocket-based streaming API.
// We connect server-side and relay audio chunks between the visitor's browser and Gemini.

const GEMINI_LIVE_HOST = 'generativelanguage.googleapis.com'
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-latest'

export type GeminiSessionCallbacks = {
  onAudioChunk: (chunk: Buffer) => void
  onTranscriptDelta: (role: 'user' | 'assistant', text: string) => void
  onTurnComplete: () => void
  onError: (err: Error) => void
  onClose: () => void
}

export type GeminiSession = {
  sendAudio: (pcm16: Buffer) => void
  sendText: (text: string) => void
  close: () => void
}

export function openGeminiLiveSession(
  systemPrompt: string,
  callbacks: GeminiSessionCallbacks,
): GeminiSession {
  // Gemini Live WebSocket URL
  const url =
    `wss://${GEMINI_LIVE_HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` +
    `?key=${env.GEMINI_API_KEY}`

  let ws: import('ws').WebSocket | null = null
  let closed = false

  async function connect() {
    const { WebSocket } = await import('ws')
    ws = new WebSocket(url)

    ws.on('open', () => {
      console.log('[gemini] WebSocket connected')
      // Send setup message with model and system prompt
      ws!.send(JSON.stringify({
        setup: {
          model: GEMINI_MODEL,
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: { prebuilt_voice_config: { voice_name: 'Aoede' } },
            },
          },
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
        },
      }))
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString('utf8'))

        // Audio output from Gemini
        const audioParts = msg?.serverContent?.modelTurn?.parts ?? []
        for (const part of audioParts) {
          // Skip thinking/reasoning tokens — they are internal to the model
          if (part.thought === true) continue

          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            const audioBuffer = Buffer.from(part.inlineData.data, 'base64')
            callbacks.onAudioChunk(audioBuffer)
          }
          if (part.text) {
            callbacks.onTranscriptDelta('assistant', part.text)
          }
        }

        // User transcript from Gemini's transcription
        const inputTranscript = msg?.serverContent?.inputTranscription?.text
        if (inputTranscript) {
          callbacks.onTranscriptDelta('user', inputTranscript)
        }

        if (msg?.serverContent?.turnComplete) {
          callbacks.onTurnComplete()
        }

        // Tool calls — reserved for Phase 5+
        const toolCalls = msg?.toolCall?.functionCalls ?? []
        for (const call of toolCalls) {
          // TODO Phase 5+: route tool calls to API
          console.log('[gemini] tool call received:', call.name)
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
    sendAudio(pcm16: Buffer) {
      if (!ws || ws.readyState !== 1) return
      ws.send(JSON.stringify({
        realtime_input: {
          media_chunks: [{
            mime_type: 'audio/pcm;rate=16000',
            data: pcm16.toString('base64'),
          }],
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

    close() {
      closed = true
      ws?.close()
    },
  }
}
