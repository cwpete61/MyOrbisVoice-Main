#!/usr/bin/env node
/**
 * Pull recent agent call recordings for offline analysis.
 *
 * Recordings are uploaded to Bunny CDN by the api's recording webhook
 * (apps/api/src/services/recording.service.ts) and indexed on the
 * Conversation row at `recordingBunnyPath`. Twilio API itself doesn't
 * retain them — this script reads Conversation, then fetches each MP3
 * from Bunny Storage using master AccessKey auth.
 *
 * Designed to run INSIDE the api container (deps + env there). The
 * companion .sh wrapper handles the docker hand-off + copyback.
 *
 *   ./infrastructure/scripts/pull-twilio-recordings.sh --hours 24 --limit 5
 *
 * Args:
 *   --hours N          window back from now (default 168 = 7d)
 *   --limit N          max conversations to fetch (default 10)
 *   --tenant <id>      restrict to one tenant
 *   --outdir <path>    write directory (default /tmp/twilio-recordings)
 *
 * No DB writes. No audio mutation. Pure pull + save.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REGION_HOSTS = {
  ny:  'storage.bunnycdn.com',
  la:  'la.storage.bunnycdn.com',
  sg:  'sg.storage.bunnycdn.com',
  syd: 'syd.storage.bunnycdn.com',
  uk:  'uk.storage.bunnycdn.com',
  de:  'storage.bunnycdn.com',
  se:  'se.storage.bunnycdn.com',
  br:  'br.storage.bunnycdn.com',
  jh:  'jh.storage.bunnycdn.com',
}

function parseArgs() {
  const a = { hours: 168, limit: 10, tenant: null, outdir: '/tmp/twilio-recordings' }
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i]
    const v = process.argv[i + 1]
    if (k === '--hours' && v) { a.hours = Number(v); i++ }
    else if (k === '--limit' && v) { a.limit = Number(v); i++ }
    else if (k === '--tenant' && v) { a.tenant = v; i++ }
    else if (k === '--outdir' && v) { a.outdir = v; i++ }
  }
  return a
}

// Mirror of apps/api/src/services/system-config.service.ts decrypt().
// AUTH_SECRET → sha256 → 32-byte AES-256-GCM key. Stored format:
//   "iv_hex:tag_hex:ciphertext_hex"
function decryptSysConfig(stored) {
  const secret = process.env.AUTH_SECRET ?? ''
  if (!secret) throw new Error('AUTH_SECRET missing (needed to decrypt SystemConfig.isSecret rows)')
  const key = crypto.createHash('sha256').update(secret).digest()
  const [ivHex, tagHex, dataHex] = stored.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid SystemConfig ciphertext format')
  const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  dec.setAuthTag(Buffer.from(tagHex, 'hex'))
  return dec.update(Buffer.from(dataHex, 'hex')) + dec.final('utf8')
}

async function readConfigValue(key) {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  if (!row) return null
  return row.isSecret ? decryptSysConfig(row.value) : row.value
}

async function getBunnyConfig() {
  const [zone, password, region] = await Promise.all([
    readConfigValue('bunny_storage_zone'),
    readConfigValue('bunny_storage_password'),
    readConfigValue('bunny_storage_region'),
  ])
  const storageZone     = zone     ?? process.env.BUNNY_STORAGE_ZONE     ?? ''
  const storagePassword = password ?? process.env.BUNNY_STORAGE_PASSWORD ?? ''
  const storageRegion   = region   ?? process.env.BUNNY_STORAGE_REGION   ?? 'ny'
  if (!storageZone || !storagePassword) throw new Error('Bunny storage creds missing (system_config or env)')
  return { storageZone, storagePassword, storageRegion }
}

async function main() {
  const args = parseArgs()
  const since = new Date(Date.now() - args.hours * 3600 * 1000)
  await fs.mkdir(args.outdir, { recursive: true })

  const cfg = await getBunnyConfig()
  const host = REGION_HOSTS[cfg.storageRegion] ?? REGION_HOSTS['ny']

  const where = {
    recordingBunnyPath: { not: null },
    startedAt: { gte: since },
    ...(args.tenant ? { tenantId: args.tenant } : {}),
  }
  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: args.limit,
    select: {
      id: true,
      tenantId: true,
      partnerId: true,
      recordingBunnyPath: true,
      startedAt: true,
      recordingDurationSecs: true,
      channelType: true,
      tenant:  { select: { displayName: true, slug: true } },
      partner: { select: { displayName: true, slug: true } },
    },
  })

  console.log(`[pull-recordings] zone=${cfg.storageZone} host=${host} window=${args.hours}h limit=${args.limit} matched=${conversations.length}`)

  const index = []
  let total = 0
  for (const c of conversations) {
    const url = `https://${host}/${cfg.storageZone}/${c.recordingBunnyPath}`
    const ext = c.recordingBunnyPath.endsWith('.wav') ? 'wav' : 'mp3'
    const ownerLabel = c.partner?.displayName ?? c.partner?.slug ?? c.tenant?.displayName ?? c.tenant?.slug ?? c.tenantId
    const subDir = path.join(args.outdir, c.partnerId ? `partner__${c.partnerId}` : `tenant__${c.tenantId}`)
    await fs.mkdir(subDir, { recursive: true })
    const fpath = path.join(subDir, `${c.id}.${ext}`)
    try {
      const resp = await fetch(url, { headers: { AccessKey: cfg.storagePassword } })
      if (!resp.ok) {
        console.warn(`[pull-recordings] ${c.id} HTTP ${resp.status} (${url})`)
        continue
      }
      const buf = Buffer.from(await resp.arrayBuffer())
      await fs.writeFile(fpath, buf)
      index.push({
        conversationId:    c.id,
        tenantId:          c.tenantId,
        partnerId:         c.partnerId,
        ownerLabel,
        channelType:       c.channelType,
        startedAt:         c.startedAt.toISOString(),
        durationSecs:      c.recordingDurationSecs,
        bunnyPath:         c.recordingBunnyPath,
        localPath:         fpath,
        sizeBytes:         buf.length,
      })
      total++
      console.log(`[pull-recordings] saved ${fpath} (${(buf.length / 1024).toFixed(0)} KB, ${c.recordingDurationSecs ?? '?'}s, ${ownerLabel})`)
    } catch (err) {
      console.warn(`[pull-recordings] ${c.id} — error: ${(err?.message ?? '').slice(0, 200)}`)
    }
  }

  const indexPath = path.join(args.outdir, 'index.json')
  await fs.writeFile(indexPath, JSON.stringify({ pulledAt: new Date().toISOString(), count: total, recordings: index }, null, 2))
  console.log(`[pull-recordings] DONE — ${total} recording(s) saved, index at ${indexPath}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
