type LameEncoder = { encodeBuffer(l: Int16Array, r?: Int16Array): Int8Array; flush(): Int8Array }
type LameModule = {
  WavHeader: { readHeader(v: DataView): { channels: number; sampleRate: number; dataOffset: number; dataLen: number } }
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameEncoder
}

// Real ESM dynamic import that survives tsc's CommonJS lowering. With
// module:commonjs, tsc rewrites a plain `import()` into `require()`, and
// @breezystack/lamejs's CJS/IIFE build exports an empty object — so we hide the
// import in a Function body (a string tsc won't touch) to force Node's native
// ESM loader, which returns the real Mp3Encoder/WavHeader exports.
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<{ default?: LameModule } & LameModule>

/**
 * Transcode a PCM16 WAV buffer to MP3. Telephony recordings are stored as
 * 8kHz mono PCM WAV; the gateway's hand-written WAV headers don't reliably
 * decode in-browser (Chrome rejects them as NO_SOURCE / format error), so we
 * always serve MP3, which every browser plays. Small files, low volume — fine
 * on the fly. Shared by the demo microsite + the dashboard recording routes.
 */
export async function wavToMp3(wav: Buffer): Promise<Buffer> {
  const mod = await esmImport('@breezystack/lamejs')
  const lamejs = (mod.default ?? mod) as LameModule
  const ab = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer
  const header = lamejs.WavHeader.readHeader(new DataView(ab))
  const channels = header.channels || 1
  const sampleRate = header.sampleRate || 8000
  const samples = new Int16Array(ab, header.dataOffset, header.dataLen / 2)
  const enc = new lamejs.Mp3Encoder(channels, sampleRate, 64)
  const out: Buffer[] = []
  const BLOCK = 1152
  if (channels === 2) {
    const n = samples.length >> 1
    const left = new Int16Array(n), right = new Int16Array(n)
    for (let i = 0, j = 0; j < n; i += 2, j++) { left[j] = samples[i]!; right[j] = samples[i + 1]! }
    for (let i = 0; i < n; i += BLOCK) {
      const buf = enc.encodeBuffer(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK))
      if (buf.length) out.push(Buffer.from(buf))
    }
  } else {
    for (let i = 0; i < samples.length; i += BLOCK) {
      const buf = enc.encodeBuffer(samples.subarray(i, i + BLOCK))
      if (buf.length) out.push(Buffer.from(buf))
    }
  }
  const end = enc.flush()
  if (end.length) out.push(Buffer.from(end))
  return Buffer.concat(out)
}
