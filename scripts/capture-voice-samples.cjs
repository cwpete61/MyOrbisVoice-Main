#!/usr/bin/env node
/**
 * Capture 7 short voice samples from Gemini Live, one per supported voice,
 * and save them as WAV files for the marketing site.
 *
 * Each sample is the same stock greeting in the agent's voice. The output
 * audio from Gemini Live arrives as 24kHz mono PCM16 base64 chunks; we
 * concatenate them and prepend a WAV header.
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node scripts/capture-voice-samples.cjs
 *
 * Outputs (relative to repo root):
 *   /tmp/voice-samples/zephyr.wav
 *   /tmp/voice-samples/despina.wav
 *   ...
 *
 * Then upload via:
 *   for f in /tmp/voice-samples/*.wav; do
 *     curl -X PUT "https://storage.bunnycdn.com/orbisvoice/voice-samples/$(basename $f)" \
 *       -H "AccessKey: <BUNNY_STORAGE_PASSWORD>" \
 *       -H "Content-Type: audio/wav" \
 *       --data-binary "@$f"
 *   done
 */

const fs = require('fs')
const path = require('path')
const WebSocket = require('/home/orbis/Antigravity/OrbisVoice2026/node_modules/.pnpm/ws@8.20.0/node_modules/ws')

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) {
  console.error('GEMINI_API_KEY env var is required')
  process.exit(1)
}

const MODEL = 'models/gemini-2.5-flash-native-audio-preview-09-2025'
const SAMPLE_RATE = 24000
const OUT_DIR = '/tmp/voice-samples'

// One greeting per voice — matches the marketing-site framing.
const VOICES = [
  { name: 'Zephyr',  pitch: 'a bright, clear voice'                 },
  { name: 'Despina', pitch: 'a smooth, polished voice'              },
  { name: 'Aoede',   pitch: 'a warm, breezy voice'                  },
  { name: 'Charon',  pitch: 'a deep, authoritative voice'           },
  { name: 'Fenrir',  pitch: 'a warm, approachable voice'            },
  { name: 'Puck',    pitch: 'an upbeat, conversational voice'       },
  { name: 'Sulafat', pitch: 'a warm, even voice'                    },
]

function buildWav(pcmBuffer, sampleRate) {
  const numSamples = pcmBuffer.length / 2
  const byteRate = sampleRate * 2
  const blockAlign = 2
  const dataSize = pcmBuffer.length
  const fileSize = 36 + dataSize
  const header = Buffer.alloc(44)
  header.write('RIFF',  0)
  header.writeUInt32LE(fileSize,  4)
  header.write('WAVE',  8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16,         16)  // fmt chunk size
  header.writeUInt16LE(1,          20)  // PCM format
  header.writeUInt16LE(1,          22)  // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate,   28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(16,         34)  // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(dataSize,   40)
  return Buffer.concat([header, pcmBuffer])
}

function captureOne(voiceName, pitchDescription) {
  return new Promise((resolve, reject) => {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`
    const ws = new WebSocket(url)
    const audioChunks = []
    let setupDone = false
    let turnDone = false
    let timeout = null

    const greeting = `Hi, I'm ${voiceName}, an AI receptionist for your business. I answer your phone, book appointments, and never miss a call. Have a great day.`

    function cleanup() {
      if (timeout) clearTimeout(timeout)
      try { ws.close() } catch (_) {}
    }

    ws.on('open', () => {
      const setup = {
        setup: {
          model: MODEL,
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: { prebuilt_voice_config: { voice_name: voiceName } },
            },
          },
          system_instruction: {
            parts: [{
              text: `You are an AI voice assistant with ${pitchDescription}. ` +
                    `When the user sends a "GREETING" message, speak the greeting ` +
                    `verbatim, no preamble, no commentary, just the greeting.`,
            }],
          },
        },
      }
      ws.send(JSON.stringify(setup))
    })

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString('utf8')) } catch { return }

      if (msg.setupComplete !== undefined && !setupDone) {
        setupDone = true
        // Send the greeting as a text user turn
        const text = {
          client_content: {
            turns: [{ role: 'user', parts: [{ text: `GREETING: ${greeting}` }] }],
            turn_complete: true,
          },
        }
        ws.send(JSON.stringify(text))
        // Hard cap: 15s after we ask. If turnComplete doesn't arrive
        // in that time we save what we have anyway.
        timeout = setTimeout(() => {
          console.warn(`  [${voiceName}] timeout — finishing with ${audioChunks.length} chunks`)
          turnDone = true
          finish()
        }, 15000)
      }

      const parts = msg?.serverContent?.modelTurn?.parts ?? []
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'))
        }
      }

      if (msg?.serverContent?.turnComplete && !turnDone) {
        turnDone = true
        finish()
      }
    })

    ws.on('error', (err) => {
      cleanup()
      reject(err)
    })

    ws.on('close', (code, reason) => {
      if (!turnDone) {
        const reasonStr = reason && reason.length ? reason.toString() : '(no reason)'
        if (audioChunks.length > 0) finish()
        else reject(new Error(`closed before any audio (voice=${voiceName}) code=${code} reason=${reasonStr}`))
      }
    })

    function finish() {
      cleanup()
      const pcm = Buffer.concat(audioChunks)
      if (pcm.length === 0) {
        reject(new Error(`no audio captured for ${voiceName}`))
        return
      }
      const wav = buildWav(pcm, SAMPLE_RATE)
      const outPath = path.join(OUT_DIR, voiceName.toLowerCase() + '.wav')
      fs.writeFileSync(outPath, wav)
      const seconds = (pcm.length / 2 / SAMPLE_RATE).toFixed(1)
      console.log(`  [${voiceName}] ✓ ${outPath} (${seconds}s, ${(wav.length / 1024).toFixed(1)} KB)`)
      resolve(outPath)
    }
  })
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Capturing ${VOICES.length} voice samples → ${OUT_DIR}`)
  for (const v of VOICES) {
    process.stdout.write(`▶ ${v.name}... `)
    try {
      await captureOne(v.name, v.pitch)
    } catch (err) {
      console.error(`\n  [${v.name}] FAILED: ${err.message}`)
    }
    // Small delay between sessions to avoid rate-limiting.
    await new Promise(r => setTimeout(r, 600))
  }
  console.log('\nDone.')
}

main()
