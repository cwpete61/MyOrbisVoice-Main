// Generate per-line talking-presenter clips via happyhorse-1.0-i2v (US region).
// presenter.png (first frame) + line audio (public mp3) -> lip-synced video.
// duration = ceil(audio sec) capped 15 (i2v max), watermark off, 720P.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'; import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../public/broll'); mkdirSync(OUT, { recursive: true })
const KEY = readFileSync('/tmp/.dashscope', 'utf8').trim()
const BASE = 'https://dashscope-us.aliyuncs.com/api/v1'
const WS = 'ws-8vfj7mp2npwclunj'
const IMG = 'https://myorbisresults.com/assets/av/presenter.png'

// line -> duration seconds (ceil of audio, capped 15)
const LINES = { '01':13,'02':8,'03':11,'04':12,'05':12,'06':11,'07':11,'08':12,'09':13,'10':12,'11':10,'12':10,'13':15,'14':8,'15':15,'16':9,'17':10,'19':9 }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function attempt(nn, dur) {
  const body = { model: 'happyhorse-1.0-i2v', input: { media: [{ url: IMG }], audio_url: `https://myorbisresults.com/assets/av/${nn}.mp3` }, parameters: { resolution: '720P', duration: dur, watermark: false } }
  const s = await (await fetch(`${BASE}/services/aigc/video-generation/video-synthesis`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-WorkSpace': WS }, body: JSON.stringify(body) })).json()
  const tid = s?.output?.task_id
  if (!tid) return { ok: false, err: 'submit:' + JSON.stringify(s).slice(0, 120) }
  for (let i = 0; i < 40; i++) {
    await sleep(10000)
    const t = await (await fetch(`${BASE}/tasks/${tid}`, { headers: { Authorization: `Bearer ${KEY}` } })).json()
    const st = t?.output?.task_status
    if (st === 'SUCCEEDED') return { ok: true, url: t.output.video_url }
    if (st === 'FAILED') return { ok: false, err: t?.output?.code || 'FAILED' }
  }
  return { ok: false, err: 'TIMEOUT' }
}

async function gen(nn, dur) {
  const dst = join(OUT, `presenter-${nn}.mp4`)
  if (existsSync(dst)) { console.log(nn, 'exists, skip'); return true }
  for (let r = 1; r <= 4; r++) {
    const res = await attempt(nn, dur)
    if (res.ok) {
      const buf = Buffer.from(await (await fetch(res.url)).arrayBuffer())
      writeFileSync(dst, buf)
      console.log(nn, 'OK', buf.length, 'bytes', `(try ${r})`)
      return true
    }
    console.log(nn, `try ${r} failed: ${res.err}`)
    await sleep(5000)
  }
  console.log(nn, 'GAVE UP after 4 tries')
  return false
}

const missing = []
for (const [nn, dur] of Object.entries(LINES)) {
  const ok = await gen(nn, dur)
  if (!ok) missing.push(nn)
}
console.log('ALL DONE. missing:', missing.join(',') || 'none')
