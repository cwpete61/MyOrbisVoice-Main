#!/usr/bin/env node
/**
 * Uploads pre-staged MP4s in /tmp to Bunny storage under marketing-kit/.
 * Runs INSIDE the myorbisvoice-api container so AUTH_SECRET (used to decrypt
 * the Bunny creds) and the decrypted creds never leave the box.
 *
 * Inputs (env, passed by the host orchestrator):
 *   AUTH_SECRET                — already in the container env (used by app)
 *   BUNNY_ZONE_CIPHER          — encrypted SystemConfig value for bunny_storage_zone
 *   BUNNY_PASS_CIPHER          — encrypted SystemConfig value for bunny_storage_password
 *   BUNNY_REGION               — plaintext region (e.g. "ny"); optional, defaults "ny"
 *
 *   docker exec -e BUNNY_ZONE_CIPHER=... myorbisvoice-api node /tmp/upload-marketing-assets.mjs
 */
import { createHash, createDecipheriv } from 'crypto'
import { readFileSync } from 'fs'

// (src basename in /tmp) → (dest filename in marketing-kit/ on Bunny)
const UPLOADS = [
  ['OrbyPitch-HORIZONTAL-en.mp4', 'orby-pitch-horizontal-en.mp4'],
  ['OrbyPitchHORIZONTAL-es.mp4',  'orby-pitch-horizontal-es.mp4'],
  ['orby-pitch-vertical-en.mp4',  'orby-pitch-vertical-en.mp4'],
  ['orby-pitch-vertical-es.mp4',  'orby-pitch-vertical-es.mp4'],
]

const REGION_HOSTS = {
  ny: 'storage.bunnycdn.com', la: 'la.storage.bunnycdn.com', sg: 'sg.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com', uk: 'uk.storage.bunnycdn.com', de: 'storage.bunnycdn.com',
  se: 'se.storage.bunnycdn.com', br: 'br.storage.bunnycdn.com', jh: 'jh.storage.bunnycdn.com',
}

function decrypt(ciphertext) {
  const key = createHash('sha256').update(process.env.AUTH_SECRET ?? '').digest()
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  d.setAuthTag(Buffer.from(tagHex, 'hex'))
  return d.update(Buffer.from(dataHex, 'hex')) + d.final('utf8')
}

// Storage zone + region are stored plaintext in SystemConfig (isSecret=false);
// only the password is encrypted.
const zone     = process.env.BUNNY_ZONE ?? ''
const password = decrypt(process.env.BUNNY_PASS_CIPHER ?? '')
const region   = process.env.BUNNY_REGION || 'ny'
if (!zone) throw new Error('BUNNY_ZONE missing')
const host = REGION_HOSTS[region] ?? REGION_HOSTS.ny

for (const [src, dest] of UPLOADS) {
  const buf = readFileSync(`/tmp/${src}`)
  const url = `https://${host}/${zone}/marketing-kit/${dest}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { AccessKey: password, 'Content-Type': 'video/mp4' },
    body: buf,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upload ${dest} failed: ${res.status} ${text.slice(0, 200)}`)
  }
  console.log(`uploaded marketing-kit/${dest} (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`)
}
