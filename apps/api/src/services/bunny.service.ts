import { getConfigValue } from './system-config.service.js'
import { prisma } from '../lib/prisma.js'

const REGION_HOSTS: Record<string, string> = {
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

export interface BunnyConfig {
  apiKey: string
  storageZone: string
  storagePassword: string
  cdnHostname: string
  storageRegion: string
}

export async function getBunnyConfig(): Promise<BunnyConfig | null> {
  const [dbApiKey, dbZone, dbPassword, dbCdn, dbRegion] = await Promise.all([
    getConfigValue('bunny_api_key'),
    getConfigValue('bunny_storage_zone'),
    getConfigValue('bunny_storage_password'),
    getConfigValue('bunny_cdn_hostname'),
    getConfigValue('bunny_storage_region'),
  ])

  const apiKey         = dbApiKey    || process.env['BUNNY_API_KEY']           || ''
  const storageZone    = dbZone      || process.env['BUNNY_STORAGE_ZONE']      || ''
  const storagePassword= dbPassword  || process.env['BUNNY_STORAGE_PASSWORD']  || ''
  const cdnHostname    = dbCdn       || process.env['BUNNY_CDN_HOSTNAME']      || ''
  const storageRegion  = dbRegion    || process.env['BUNNY_STORAGE_REGION']    || 'ny'

  if (!apiKey || !storageZone || !storagePassword || !cdnHostname) return null
  return { apiKey, storageZone, storagePassword, cdnHostname, storageRegion }
}

export function storageHostForRegion(region: string): string {
  return REGION_HOSTS[region] ?? REGION_HOSTS['ny']!
}

function storageHost(region: string): string {
  return storageHostForRegion(region)
}

export function buildBunnyPath(tenantId: string, conversationId: string, ext = 'mp3'): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `recordings/${tenantId}/${y}/${m}/${conversationId}.${ext}`
}

export async function uploadRecording(
  config: BunnyConfig,
  path: string,
  buffer: Buffer,
  contentType = 'audio/mpeg',
): Promise<{ url: string; sizeBytes: number }> {
  const host = storageHost(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey:      config.storagePassword,
      'Content-Type': contentType,
    },
    body: buffer,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bunny upload failed: ${res.status} ${text}`)
  }

  return {
    url:       `https://${config.cdnHostname}/${path}`,
    sizeBytes: buffer.byteLength,
  }
}

export async function deleteRecording(config: BunnyConfig, path: string): Promise<void> {
  const host = storageHost(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`
  await fetch(url, {
    method: 'DELETE',
    headers: { AccessKey: config.storagePassword },
  })
}

export function getSignedUrl(config: BunnyConfig, path: string, ttlSeconds = 900): string {
  // Bunny token auth requires a signing key set on the pull zone — for now return direct CDN URL
  // TODO: implement HMAC token signing once Bunny pull zone token auth is enabled
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  return `https://${config.cdnHostname}/${path}?expires=${expires}`
}

// ── Quota helpers ─────────────────────────────────────────────────────────────

const DEFAULT_QUOTA_BYTES = BigInt(1 * 1024 * 1024 * 1024) // 1 GB default until admin sets per-plan limits

export async function getStorageQuota(tenantId: string): Promise<{
  quotaBytes: bigint
  usedBytes: bigint
  pct: number
  canRecord: boolean
  nearLimit: boolean
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { storageQuotaBytes: true, storageUsedBytes: true },
  })

  const quotaBytes = tenant?.storageQuotaBytes ?? DEFAULT_QUOTA_BYTES
  const usedBytes  = tenant?.storageUsedBytes  ?? BigInt(0)
  const pct        = Number(usedBytes) / Number(quotaBytes) * 100

  return {
    quotaBytes,
    usedBytes,
    pct,
    canRecord:  pct < 100,
    nearLimit:  pct >= 90 && pct < 100,
  }
}

export async function incrementStorageUsed(tenantId: string, sizeBytes: number): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { storageUsedBytes: { increment: BigInt(sizeBytes) } },
  })
}

export async function decrementStorageUsed(tenantId: string, sizeBytes: number): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { storageUsedBytes: { decrement: BigInt(sizeBytes) } },
  })
}
