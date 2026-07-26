#!/usr/bin/env node
/* Generate an Orby (Aoede) narration WAV from a script. Adapted from
 * capture-voice-samples.cjs. Usage:
 *   GEMINI_API_KEY=... node scripts/gen-narration.cjs <outfile.wav> "<script text>"
 * Output: 24kHz mono PCM16 WAV. */
const fs = require('fs')
const WebSocket = require('/run/media/orbis/Projects/Antigravity/OrbisVoice2026/node_modules/.pnpm/ws@8.20.0/node_modules/ws')

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY) { console.error('GEMINI_API_KEY required'); process.exit(1) }
const OUT = process.argv[2]
const SCRIPT = process.argv[3]
if (!OUT || !SCRIPT) { console.error('usage: gen-narration.cjs <out.wav> "<text>"'); process.exit(1) }

const MODEL = 'models/gemini-2.5-flash-native-audio-preview-09-2025'
const SR = 24000

function buildWav(pcm, sr) {
  const h = Buffer.alloc(44); const ds = pcm.length
  h.write('RIFF',0); h.writeUInt32LE(36+ds,4); h.write('WAVE',8); h.write('fmt ',12)
  h.writeUInt32LE(16,16); h.writeUInt16LE(1,20); h.writeUInt16LE(1,22); h.writeUInt32LE(sr,24)
  h.writeUInt32LE(sr*2,28); h.writeUInt16LE(2,32); h.writeUInt16LE(16,34); h.write('data',36); h.writeUInt32LE(ds,40)
  return Buffer.concat([h, pcm])
}

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`
const ws = new WebSocket(url)
const chunks = []
let setupDone = false, turnDone = false, timeout = null

ws.on('open', () => {
  ws.send(JSON.stringify({ setup: {
    model: MODEL,
    generation_config: { response_modalities: ['AUDIO'], speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Aoede' } } } },
    system_instruction: { parts: [{ text: 'You are Orby, a warm, upbeat, friendly female voice for a wellness brand. When the user sends a SCRIPT, read it aloud EXACTLY as written, word for word, at a natural marketing-narration pace — no preamble, no commentary, no extra words. Just narrate the script clearly and warmly.' }] },
  } }))
})

ws.on('message', (raw) => {
  let msg; try { msg = JSON.parse(raw.toString('utf8')) } catch { return }
  if (msg.setupComplete !== undefined && !setupDone) {
    setupDone = true
    ws.send(JSON.stringify({ client_content: { turns: [{ role: 'user', parts: [{ text: `SCRIPT: ${SCRIPT}` }] }], turn_complete: true } }))
    timeout = setTimeout(() => { turnDone = true; finish() }, 60000)
  }
  const parts = msg?.serverContent?.modelTurn?.parts ?? []
  for (const p of parts) if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('audio/')) chunks.push(Buffer.from(p.inlineData.data, 'base64'))
  if (msg?.serverContent?.turnComplete && !turnDone) { turnDone = true; finish() }
})
ws.on('error', (e) => { console.error('WS_ERR', e.message); process.exit(1) })
ws.on('close', (code,reason) => { if (!turnDone) { if (chunks.length) finish(); else { console.error('closed before audio code='+code+' reason='+(reason&&reason.toString()||'(none)')); process.exit(1) } } })

function finish() {
  if (timeout) clearTimeout(timeout)
  try { ws.close() } catch {}
  const pcm = Buffer.concat(chunks)
  if (!pcm.length) { console.error('no audio'); process.exit(1) }
  fs.writeFileSync(OUT, buildWav(pcm, SR))
  console.log(`OK ${OUT} ${(pcm.length/2/SR).toFixed(1)}s`)
  process.exit(0)
}
