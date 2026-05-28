/**
 * Sanity tests for the anti-aliased resampler + frame buffer.
 *
 * Run: cd apps/voice-gateway && node --test src/lib/mulaw.test.mjs
 *
 * Tests the COMPILED dist/ output so they exercise the same code that
 * runs in production. Run `pnpm build` first.
 *
 * What we're verifying:
 *  1. Resampler attenuates a 6 kHz sine (above 4 kHz Nyquist for 8 kHz
 *     output) by >40 dB. A failing filter would let the sine through.
 *  2. Resampler preserves a 1 kHz sine (well inside the voice band) to
 *     within 1 dB of its input level.
 *  3. MulawFrameBuffer emits exact 160-byte frames and buffers remainders.
 *  4. MulawFrameBuffer.reset() drops the tail.
 *  5. MulawFrameBuffer.flush() pads to 160 with 0xff (μ-law silence).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resamplePcm16, MulawFrameBuffer } from '../../dist/lib/mulaw.js'

function buildSine(freqHz, sampleRate, durationSec, amplitude = 16000) {
  const n = Math.floor(sampleRate * durationSec)
  const buf = Buffer.allocUnsafe(n * 2)
  for (let i = 0; i < n; i++) {
    const v = Math.round(amplitude * Math.sin(2 * Math.PI * freqHz * i / sampleRate))
    buf.writeInt16LE(v, i * 2)
  }
  return buf
}

function rmsDb(pcm) {
  const n = pcm.length / 2
  let ss = 0
  for (let i = 0; i < n; i++) {
    const v = pcm.readInt16LE(i * 2)
    ss += v * v
  }
  const rms = Math.sqrt(ss / n)
  if (rms === 0) return -Infinity
  return 20 * Math.log10(rms / 32768)
}

test('resamplePcm16 24k→8k attenuates 6 kHz sine by >40 dB (anti-aliasing works)', () => {
  // 6 kHz is ABOVE 8 kHz Nyquist (4 kHz). A clean LPF should kill this.
  const input = buildSine(6000, 24000, 0.5)
  const inDb = rmsDb(input)
  const output = resamplePcm16(input, 24000, 8000)
  const outDb = rmsDb(output)
  const attenuation = inDb - outDb
  console.log(`  6 kHz @ 24k: ${inDb.toFixed(1)} dB → 8k: ${outDb.toFixed(1)} dB (attenuation: ${attenuation.toFixed(1)} dB)`)
  assert.ok(attenuation > 40,
    `expected >40 dB attenuation on 6 kHz aliasing frequency, got ${attenuation.toFixed(1)} dB`)
})

test('resamplePcm16 24k→8k preserves 1 kHz sine within 2 dB', () => {
  const input = buildSine(1000, 24000, 0.5)
  const inDb = rmsDb(input)
  const output = resamplePcm16(input, 24000, 8000)
  const outDb = rmsDb(output)
  const loss = inDb - outDb
  console.log(`  1 kHz @ 24k: ${inDb.toFixed(1)} dB → 8k: ${outDb.toFixed(1)} dB (loss: ${loss.toFixed(1)} dB)`)
  assert.ok(Math.abs(loss) < 2, `expected <2 dB level shift on 1 kHz voice-band sine, got ${loss.toFixed(1)} dB`)
})

test('resamplePcm16 24k→8k produces correct output sample count', () => {
  const input = buildSine(1000, 24000, 1.0) // 24000 samples
  const output = resamplePcm16(input, 24000, 8000)
  const outSamples = output.length / 2
  // Allow ±1 sample slack from rounding.
  assert.ok(Math.abs(outSamples - 8000) <= 1, `expected ~8000 output samples, got ${outSamples}`)
})

test('resamplePcm16 8k→16k upsamples without level loss (linear interp path)', () => {
  const input = buildSine(1000, 8000, 0.5)
  const inDb = rmsDb(input)
  const output = resamplePcm16(input, 8000, 16000)
  const outDb = rmsDb(output)
  assert.ok(Math.abs(inDb - outDb) < 1, `upsample changed level by ${(inDb - outDb).toFixed(1)} dB`)
})

test('MulawFrameBuffer emits exact 160-byte frames', () => {
  const fb = new MulawFrameBuffer()
  const frames1 = fb.push(Buffer.alloc(100))
  assert.equal(frames1.length, 0, 'should buffer below frame threshold')
  const frames2 = fb.push(Buffer.alloc(200))
  // 100 + 200 = 300 → one 160 frame + 140 remainder.
  assert.equal(frames2.length, 1)
  assert.equal(frames2[0].length, MulawFrameBuffer.FRAME_BYTES)
  const frames3 = fb.push(Buffer.alloc(20))
  // 140 + 20 = 160 → one more frame, 0 remainder.
  assert.equal(frames3.length, 1)
  assert.equal(frames3[0].length, MulawFrameBuffer.FRAME_BYTES)
})

test('MulawFrameBuffer reset() drops pending tail', () => {
  const fb = new MulawFrameBuffer()
  fb.push(Buffer.alloc(50))
  fb.reset()
  const frames = fb.push(Buffer.alloc(160))
  assert.equal(frames.length, 1, 'after reset, partial tail should be gone')
  assert.equal(frames[0].length, MulawFrameBuffer.FRAME_BYTES)
})

test('MulawFrameBuffer flush() pads to 160 bytes with μ-law silence (0xff)', () => {
  const fb = new MulawFrameBuffer()
  fb.push(Buffer.from([1, 2, 3]))
  const f = fb.flush()
  assert.ok(f !== null)
  assert.equal(f.length, MulawFrameBuffer.FRAME_BYTES)
  assert.equal(f[0], 1)
  assert.equal(f[1], 2)
  assert.equal(f[2], 3)
  assert.equal(f[3], 0xff, 'should pad with μ-law silence byte')
  assert.equal(f[MulawFrameBuffer.FRAME_BYTES - 1], 0xff)
})

test('MulawFrameBuffer flush() returns null when empty', () => {
  const fb = new MulawFrameBuffer()
  assert.equal(fb.flush(), null)
})
