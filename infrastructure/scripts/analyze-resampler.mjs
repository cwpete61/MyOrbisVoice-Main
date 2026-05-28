#!/usr/bin/env node
/**
 * Offline resampler comparison — proves whether the FIR anti-aliasing fix
 * actually removes alias energy, with NO MP3 transcode confound.
 *
 * Input: a raw 24 kHz PCM16 mono dump captured by the gateway when
 * VG_CAPTURE_RAW=1 (the exact bytes Gemini emitted for the agent's voice,
 * before our downsample).
 *
 * Produces three 8 kHz WAVs from the same source:
 *   1. OLD  — naive linear interpolation (the buggy path, reconstructed here)
 *   2. NEW  — the deployed FIR-LPF + decimate path (imported from dist)
 *   3. GOLD — ffmpeg soxr very-high-quality resample (reference truth)
 *
 * Then prints, for each, the energy that folded ABOVE the alias-detection
 * test tone region. The cleanest measure: build a 24 kHz signal containing
 * ONLY tones above 4 kHz from the captured audio (high-passed), downsample
 * with each method, and measure how much leaks into the 8 kHz output. Less
 * leakage = better anti-aliasing.
 *
 * Usage:
 *   node infrastructure/scripts/analyze-resampler.mjs /tmp/vg-capture/<callSid>.pcm24k
 *
 * Requires: ffmpeg + ffprobe on PATH, and a built voice-gateway dist
 * (the NEW path is imported from apps/voice-gateway/dist/lib/mulaw.js).
 */
import { promises as fs } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../..')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('usage: node analyze-resampler.mjs <path-to.pcm24k>')
  process.exit(1)
}

// Reconstruct the OLD buggy linear-interp downsample (pre-fix code).
function oldLinearDownsample(input, srcRate, dstRate) {
  const srcSamples = input.length / 2
  const dstSamples = Math.round((srcSamples * dstRate) / srcRate)
  const out = Buffer.allocUnsafe(dstSamples * 2)
  const ratio = srcSamples / dstSamples
  for (let i = 0; i < dstSamples; i++) {
    const pos = i * ratio
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, srcSamples - 1)
    const frac = pos - lo
    const sLo = input.readInt16LE(lo * 2)
    const sHi = input.readInt16LE(hi * 2)
    out.writeInt16LE(Math.round(sLo + frac * (sHi - sLo)), i * 2)
  }
  return out
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44)
  const dataLen = pcm.length
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLen, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)         // PCM
  header.writeUInt16LE(1, 22)         // mono
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLen, 40)
  return Buffer.concat([header, pcm])
}

function meanDbAbove(wavPath, freq) {
  // volumedetect prints to stderr — capture it.
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-i', wavPath, '-af', `highpass=f=${freq},volumedetect`, '-f', 'null', '/dev/null',
  ], { encoding: 'utf8' })
  const out = (r.stderr ?? '') + (r.stdout ?? '')
  const m = out.match(/mean_volume:\s*(-?[0-9.]+) dB/)
  const x = out.match(/max_volume:\s*(-?[0-9.]+) dB/)
  return { mean: m ? parseFloat(m[1]) : null, max: x ? parseFloat(x[1]) : null }
}

async function main() {
  const pcm24k = await fs.readFile(inputPath)
  console.log(`input: ${inputPath} — ${pcm24k.length} bytes (${(pcm24k.length / 2 / 24000).toFixed(1)}s @ 24kHz)`)

  const { resamplePcm16 } = await import(path.join(REPO, 'apps/voice-gateway/dist/lib/mulaw.js'))

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rs-'))
  const srcWav = path.join(tmp, 'src24k.wav')
  await fs.writeFile(srcWav, pcmToWav(pcm24k, 24000))

  // OLD
  const oldPcm = oldLinearDownsample(pcm24k, 24000, 8000)
  const oldWav = path.join(tmp, 'old8k.wav')
  await fs.writeFile(oldWav, pcmToWav(oldPcm, 8000))

  // NEW (deployed FIR path)
  const newPcm = resamplePcm16(pcm24k, 24000, 8000)
  const newWav = path.join(tmp, 'new8k.wav')
  await fs.writeFile(newWav, pcmToWav(newPcm, 8000))

  // GOLD (ffmpeg soxr VHQ)
  const goldWav = path.join(tmp, 'gold8k.wav')
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-i', srcWav, '-af', 'aresample=resampler=soxr:precision=28', '-ar', '8000', goldWav], { stdio: 'ignore' })

  // The 8 kHz outputs have Nyquist 4 kHz, so "above 4 kHz" can't exist in
  // them. Aliasing instead shows as spurious energy folded into 2.5-4 kHz.
  // We measure energy in the top of the band (3.5-4 kHz) — clean resamplers
  // attenuate hard there; aliasing dumps fold-back energy into it.
  console.log('\nEnergy above 3500 Hz in the 8 kHz output (lower = less alias leakage):')
  for (const [tag, wav] of [['OLD (linear)', oldWav], ['NEW (FIR)', newWav], ['GOLD (soxr)', goldWav]]) {
    const r = meanDbAbove(wav, 3500)
    console.log(`  ${tag.padEnd(14)} mean=${String(r.mean).padStart(7)} dB  max=${String(r.max).padStart(7)} dB`)
  }

  // Also dump comparison spectrograms.
  for (const [tag, wav] of [['old', oldWav], ['new', newWav], ['gold', goldWav]]) {
    const png = path.join(path.dirname(inputPath), `spectrum-${tag}.png`)
    execFileSync('ffmpeg', ['-hide_banner', '-y', '-i', wav, '-lavfi', 'showspectrumpic=s=1000x400:legend=1', png], { stdio: 'ignore' })
    console.log(`  spectrogram: ${png}`)
  }

  // Keep the WAVs for listening.
  const keepDir = path.join(path.dirname(inputPath), 'resampled')
  await fs.mkdir(keepDir, { recursive: true })
  for (const [tag, wav] of [['old', oldWav], ['new', newWav], ['gold', goldWav]]) {
    await fs.copyFile(wav, path.join(keepDir, `${tag}.wav`))
  }
  console.log(`\nWAVs for listening: ${keepDir}/{old,new,gold}.wav`)
  console.log('Verdict: NEW should track GOLD closely; OLD should show higher 3.5-4kHz energy if aliasing was real.')
}

main().catch((err) => { console.error(err); process.exit(1) })
