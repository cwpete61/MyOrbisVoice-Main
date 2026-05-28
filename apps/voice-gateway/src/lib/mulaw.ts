// G.711 µ-law codec — Twilio sends and expects 8-bit µ-law at 8 kHz

const MULAW_BIAS = 0x84
const MULAW_CLIP = 32635

const EXP_LUT = [0, 132, 396, 924, 1980, 4092, 8316, 16764]

export function encodeMulaw(pcm16: number): number {
  let sample = pcm16
  const sign = (sample >> 8) & 0x80
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
  const sample     = (EXP_LUT[exponent] ?? 0) + (mantissa << (exponent + 3))
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
 * Resample a PCM16 buffer from srcRate to dstRate.
 *
 * For UPSAMPLING (e.g. 8→16 kHz) we use linear interpolation. There's no
 * aliasing risk going up — only mild image artifacts above the source
 * Nyquist, which the receiver (Gemini) tolerates fine.
 *
 * For DOWNSAMPLING (e.g. 24→8 kHz) we MUST apply an anti-aliasing low-pass
 * filter BEFORE decimation. Otherwise frequencies between the destination
 * Nyquist (4 kHz at 8k) and source Nyquist (12 kHz at 24k) fold back into
 * the audible band as static / hiss / a "fuzzy" overlay on speech.
 *
 * 2026-05-27 incident: testers reported audible static on the agent's
 * voice. Spectral analysis of MP3 recordings showed -23.9 dB peak above
 * 4 kHz where a properly band-limited 8 kHz μ-law signal should be in
 * the -50 to -65 dB range. Diagnosed as missing LPF on the 24→8 kHz
 * downsample. This implementation replaces the naive linear-interp path
 * with a 32-tap windowed-sinc FIR LPF + decimation for downsampling.
 *
 * Filter spec: 32-tap Blackman-windowed sinc, cutoff ~3500 Hz (well
 * below the 4 kHz Nyquist with a margin to handle the transition band).
 * Group delay: 16 samples at the source rate. At 24 kHz that's ~0.67 ms,
 * imperceptible to listeners and dwarfed by network jitter.
 *
 * The filter coefficients are precomputed at module load — each call to
 * resamplePcm16 only does the convolution, no math allocation. Hot path.
 */
const FIR_TAPS = 32
const FIR_HALF = FIR_TAPS / 2 // 16

/** Precompute a windowed-sinc lowpass FIR for a given cutoff / source rate.
 *  Blackman window: 0.42 - 0.5 cos + 0.08 cos2 — gives ~-58 dB sidelobes,
 *  good rejection for the alias band. */
function buildLpfTaps(cutoffHz: number, srcRate: number): Float64Array {
  const taps = new Float64Array(FIR_TAPS)
  const fc = cutoffHz / srcRate // normalized cutoff (0..0.5)
  let sum = 0
  for (let n = 0; n < FIR_TAPS; n++) {
    const k = n - (FIR_TAPS - 1) / 2
    // sinc(2 fc k); the (FIR_TAPS-1)/2 centering keeps the filter symmetric.
    const sinc = k === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * k) / (Math.PI * k)
    // Blackman window — wider main lobe than Hamming, much better stopband.
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (FIR_TAPS - 1))
              + 0.08 * Math.cos((4 * Math.PI * n) / (FIR_TAPS - 1))
    const t = sinc * w
    taps[n] = t
    sum += t
  }
  // Normalize so DC gain = 1 (no level shift).
  for (let n = 0; n < FIR_TAPS; n++) taps[n]! /= sum
  return taps
}

// Pre-built filter for the 24→8 kHz path. We target a cutoff at ~3500 Hz
// so the transition band ends BEFORE 4 kHz (the destination Nyquist).
// Anything above 3500 Hz in the input will be attenuated >50 dB.
const LPF_24K_TO_8K = buildLpfTaps(3500, 24000)

/** Apply the precomputed FIR LPF to a PCM16 buffer at the source rate.
 *  Returns a Float64 array of filtered samples at the SAME rate.
 *  Convolution is "valid" — we use zero-padding at the boundaries which
 *  introduces ~16 samples of ringing at chunk start / end. That's ~0.67 ms
 *  on a 24 kHz chunk; below human transient detection threshold. */
function applyFir(input: Buffer, taps: Float64Array): Float64Array {
  const n = input.length / 2
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    for (let k = 0; k < FIR_TAPS; k++) {
      const idx = i + k - FIR_HALF
      if (idx < 0 || idx >= n) continue
      acc += input.readInt16LE(idx * 2) * taps[k]!
    }
    out[i] = acc
  }
  return out
}

export function resamplePcm16(input: Buffer, srcRate: number, dstRate: number): Buffer {
  // Upsample or equal-rate: linear interpolation. No aliasing risk.
  if (dstRate >= srcRate) {
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

  // Downsample path: LPF then decimate. Pick the right filter for the
  // common 24→8 case; for other rates rebuild on the fly (rare).
  const taps = srcRate === 24000 && dstRate === 8000
    ? LPF_24K_TO_8K
    : buildLpfTaps(dstRate * 0.45, srcRate)

  const filtered = applyFir(input, taps)
  const srcSamples = filtered.length
  const dstSamples = Math.round((srcSamples * dstRate) / srcRate)
  const out        = Buffer.allocUnsafe(dstSamples * 2)
  const ratio      = srcSamples / dstSamples
  for (let i = 0; i < dstSamples; i++) {
    const pos  = i * ratio
    const lo   = Math.floor(pos)
    const hi   = Math.min(lo + 1, srcSamples - 1)
    const frac = pos - lo
    const sLo  = filtered[lo]!
    const sHi  = filtered[hi]!
    let v = Math.round(sLo + frac * (sHi - sLo))
    // Clamp to int16 range — Blackman taps don't overshoot, but defend
    // against any future tap-set that does.
    if (v >  32767) v =  32767
    if (v < -32768) v = -32768
    out.writeInt16LE(v, i * 2)
  }
  return out
}

/**
 * Frame normalizer for Twilio outbound media. Twilio expects ~20 ms frames
 * (160 samples at 8 kHz). Gemini delivers irregular chunk sizes; sending
 * those verbatim can produce micro-discontinuities at chunk boundaries
 * that listeners hear as clicks/pops on top of the static.
 *
 * Usage: create one instance per call, feed every outbound 8 kHz μ-law
 * buffer through .push(), get back zero-or-more exact 160-sample frames
 * to send to Twilio. Any remainder stays buffered until the next push().
 *
 * Stateless across calls — instantiate per-session, discard at hangup.
 */
export class MulawFrameBuffer {
  private buf: Buffer = Buffer.alloc(0)
  /** Twilio frame size in BYTES at 8 kHz μ-law (1 byte per sample): 160. */
  static readonly FRAME_BYTES = 160

  push(chunk: Buffer): Buffer[] {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk])
    const frames: Buffer[] = []
    while (this.buf.length >= MulawFrameBuffer.FRAME_BYTES) {
      frames.push(this.buf.subarray(0, MulawFrameBuffer.FRAME_BYTES))
      this.buf = this.buf.subarray(MulawFrameBuffer.FRAME_BYTES)
    }
    return frames
  }

  /** Discard any pending tail without emitting. Use on barge-in: the user
   *  is cutting off the agent, stale agent bytes shouldn't trickle out. */
  reset(): void {
    this.buf = Buffer.alloc(0)
  }

  /** Emit any pending partial frame, zero-padded to 160 bytes. Call at
   *  end-of-turn or call-end so a trailing tail doesn't get dropped. */
  flush(): Buffer | null {
    if (this.buf.length === 0) return null
    if (this.buf.length === MulawFrameBuffer.FRAME_BYTES) {
      const f = this.buf
      this.buf = Buffer.alloc(0)
      return f
    }
    // μ-law silence byte is 0xFF. Pad the rest of the frame so Twilio gets
    // a clean 20 ms frame without a click at the tail.
    const padded = Buffer.alloc(MulawFrameBuffer.FRAME_BYTES, 0xff)
    this.buf.copy(padded, 0)
    this.buf = Buffer.alloc(0)
    return padded
  }
}
