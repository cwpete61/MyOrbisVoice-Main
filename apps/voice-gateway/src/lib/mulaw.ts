// G.711 µ-law codec — Twilio sends and expects 8-bit µ-law at 8 kHz

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635

const EXP_LUT = [0, 132, 396, 924, 1980, 4092, 8316, 16764]

export function encodeMulaw(pcm16: number): number {
  let sample = pcm16
  let sign = (sample >> 8) & 0x80
  if (sign !== 0) sample = -sample
  if (sample > MULAW_CLIP) sample = MULAW_CLIP
  sample += MULAW_BIAS
  let exponent = 7
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (sample >> (exponent + 3)) & 0x0f
  return ~(sign | (exponent << 4) | mantissa) & 0xff
}

export function decodeMulaw(mulaw: number): number {
  mulaw = ~mulaw & 0xff
  const sign     = mulaw & 0x80
  const exponent = (mulaw >> 4) & 0x07
  const mantissa = mulaw & 0x0f
  let sample     = (EXP_LUT[exponent] ?? 0) + (mantissa << (exponent + 3))
  return sign !== 0 ? -sample : sample
}

/** Convert a Buffer of µ-law 8 kHz samples to PCM16 LE 8 kHz */
export function mulawToPcm16(input: Buffer): Buffer {
  const out = Buffer.allocUnsafe(input.length * 2)
  for (let i = 0; i < input.length; i++) {
    out.writeInt16LE(decodeMulaw(input[i]!), i * 2)
  }
  return out
}

/** Convert a Buffer of PCM16 LE samples to µ-law */
export function pcm16ToMulaw(input: Buffer): Buffer {
  const samples = input.length / 2
  const out     = Buffer.allocUnsafe(samples)
  for (let i = 0; i < samples; i++) {
    out[i] = encodeMulaw(input.readInt16LE(i * 2))
  }
  return out
}

/**
 * Resample a PCM16 buffer from srcRate to dstRate using linear interpolation.
 * Only handles integer ratios or simple cases needed here (8→24 and 24→8 kHz).
 */
export function resamplePcm16(input: Buffer, srcRate: number, dstRate: number): Buffer {
  const srcSamples = input.length / 2
  const dstSamples = Math.round((srcSamples * dstRate) / srcRate)
  const out        = Buffer.allocUnsafe(dstSamples * 2)
  const ratio      = srcSamples / dstSamples

  for (let i = 0; i < dstSamples; i++) {
    const pos  = i * ratio
    const lo   = Math.floor(pos)
    const hi   = Math.min(lo + 1, srcSamples - 1)
    const frac = pos - lo
    const sLo  = input.readInt16LE(lo * 2)
    const sHi  = input.readInt16LE(hi * 2)
    out.writeInt16LE(Math.round(sLo + frac * (sHi - sLo)), i * 2)
  }
  return out
}
