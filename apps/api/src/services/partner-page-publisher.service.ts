/**
 * Auto-publish per-partner landing pages.
 *
 * Runs in two steps:
 *   1. Generate — read the canonical sample templates from disk + substitute
 *      the partner's identity into each. Same substitution logic as the
 *      standalone scripts/generate-partner-pages.ts CLI; the two files share
 *      a small surface and need to stay aligned (`substitute` + identity vars).
 *   2. Upload — FTPS each of the 6 generated files (3 EN + 3 ES) up to the
 *      Spaceship docroot using curl with inline credentials. Skips the upload
 *      step (and logs a warning) when SPACESHIP_FTP_* env vars aren't set, so
 *      local dev still gets the regen but doesn't crash on missing secrets.
 *
 * Triggered from updatePartnerProfile when a partner saves their profile
 * AND partnerPageActive=true — so the prospect-facing pages reflect the
 * partner's latest name, photo, phone, and email within seconds. Failures are
 * non-fatal: the profile save itself never blocks on a slow FTP upload.
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client as FtpClient } from 'basic-ftp'
import { prisma } from '../lib/prisma.js'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const SITE_ROOT = path.join(REPO_ROOT, 'myorbisresults.com')

const VARIATIONS = [1, 2, 3] as const
const LOCALES = [
  { srcDir: 'p/sample',    destPrefix: 'p' },
  { srcDir: 'es/p/sample', destPrefix: 'es/p' },
] as const

interface PartnerPageData {
  slug:            string
  firstName:       string
  fullName:        string
  businessName:    string
  partnerPhone:    string
  partnerPhoneTel: string
  partnerEmail:    string
  avatarUrl:       string
}

function formatPhoneHuman(e164: string): string {
  const trimmed = e164.replace(/\s+/g, '')
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(trimmed)
  if (m) return `+1 (${m[1]}) ${m[2]}-${m[3]}`
  return trimmed
}

/** Same substitution sequence as scripts/generate-partner-pages.ts. Longest
 *  strings first to avoid corrupting longer forms when shorter ones overlap. */
function substitute(source: string, p: PartnerPageData): string {
  let out = source
  out = out.replaceAll('alex@myorbisresults.com', p.partnerEmail)
  out = out.replaceAll('+15551234567',            p.partnerPhoneTel)
  out = out.replaceAll('+1 (555) 123-4567',       p.partnerPhone)
  out = out.replaceAll('(555) 123-4567',          p.partnerPhone)
  out = out.replaceAll('../../../assets/images/partners/sample-partner.jpg', p.avatarUrl)
  out = out.replaceAll('/assets/images/partners/sample-partner.jpg',         p.avatarUrl)
  out = out.replaceAll('Alex Rivera',             p.fullName)
  out = out.replaceAll('Rivera Local Marketing',  p.businessName)
  out = out.replace(/\bAlex\b/g, p.firstName)
  out = out.replace(/\bALEX\b/g, p.firstName.toUpperCase())
  out = out.replaceAll('/p/sample/',    `/p/${p.slug}/`)
  out = out.replaceAll('/es/p/sample/', `/es/p/${p.slug}/`)
  out = out.replaceAll('alex.rivera',    p.slug)
  out = out.replace(
    /\s*if \(__orbisPartnerSlug === "[a-z0-9.-]+"\) __orbisPartnerSlug = "[a-z0-9.-]+";?\n?/g,
    '\n',
  )
  return out
}

async function loadPartnerData(partnerId: string): Promise<PartnerPageData | null> {
  const partner = await prisma.affiliateAccount.findUnique({
    where: { id: partnerId },
    select: {
      slug:         true,
      displayName:  true,
      partnerPhone: true,
      avatarUrl:    true,
      businessName: true,
      user:         { select: { firstName: true, lastName: true } },
    },
  })
  if (!partner || !partner.slug) return null

  const firstName = partner.user.firstName ?? ''
  const lastName  = partner.user.lastName  ?? ''
  const fullName  = (partner.displayName && partner.displayName.trim())
    || [firstName, lastName].filter(Boolean).join(' ').trim()
  if (!fullName) return null

  const partnerPhoneTel = (partner.partnerPhone ?? '').replace(/[^\d+]/g, '') || '+15551234567'

  return {
    slug:            partner.slug,
    firstName:       firstName || fullName.split(' ')[0]!,
    fullName,
    businessName:    (partner.businessName && partner.businessName.trim()) || fullName,
    partnerPhone:    formatPhoneHuman(partnerPhoneTel),
    partnerPhoneTel,
    partnerEmail:    `${partner.slug}@myorbisresults.com`,
    avatarUrl:       partner.avatarUrl ?? 'https://myorbisvoice.com/assets/images/partners/sample-partner.jpg',
  }
}

interface FtpConfig { host: string; user: string; pass: string }

function getFtpConfig(): FtpConfig | null {
  const host = process.env['SPACESHIP_FTP_HOST']
  const user = process.env['SPACESHIP_FTP_USER']
  const pass = process.env['SPACESHIP_FTP_PASS']
  if (!host || !user || !pass) return null
  return { host, user, pass }
}

/**
 * Open an FTPS connection to Spaceship and upload a batch of files in one
 * session — much cheaper than reconnecting per file (TLS handshake + login
 * dominate the latency, not the bytes). Returns a per-file success map.
 *
 * Transport: explicit FTPS (AUTH TLS), matching what deploy-marketing.sh +
 * deploy-partner-pages.sh have always used with curl --ssl-reqd. The -k
 * (insecure) flag in the curl version is reproduced as `secureOptions:
 * { rejectUnauthorized: false }` because Spaceship's shared-host cert
 * is self-signed for the per-account hostname.
 */
async function ftpUploadBatch(
  files: Array<{ localPath: string; remotePath: string }>,
  cfg: FtpConfig,
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  const client = new FtpClient(30_000)  // 30s timeout
  try {
    await client.access({
      host:           cfg.host,
      user:           cfg.user,
      password:       cfg.pass,
      secure:         true,
      secureOptions:  { rejectUnauthorized: false },
    })
    for (const f of files) {
      try {
        // ensureDir creates parent dirs as needed (server-side mkdir-p).
        const parent = path.posix.dirname(f.remotePath)
        if (parent && parent !== '.') await client.ensureDir(parent)
        await client.cd('/')  // reset so next ensureDir resolves from root
        await client.uploadFrom(f.localPath, f.remotePath)
        results.set(f.remotePath, true)
      } catch (err) {
        console.warn(`[partner-page-publisher] upload failed: ${f.remotePath} — ${(err as Error).message}`)
        results.set(f.remotePath, false)
      }
    }
  } catch (err) {
    console.warn(`[partner-page-publisher] FTPS session failed: ${(err as Error).message}`)
    for (const f of files) if (!results.has(f.remotePath)) results.set(f.remotePath, false)
  } finally {
    client.close()
  }
  return results
}

export interface PublishResult {
  ok:           boolean
  generated:    number
  uploaded:     number
  failed:       number
  skippedFtp:   boolean   // true when SPACESHIP_FTP_* not configured
  detail:       string[]  // human-readable per-file status, for audit log
}

/**
 * Generate + publish all 6 partner pages for a single partner.
 *
 * Fire-and-forget from callers like updatePartnerProfile — never throws,
 * always returns a result object. Detailed failures are logged on the server
 * and surfaced in the result.detail array for audit-log capture.
 */
export async function publishPartnerPages(partnerId: string): Promise<PublishResult> {
  const detail: string[] = []
  const result: PublishResult = { ok: false, generated: 0, uploaded: 0, failed: 0, skippedFtp: false, detail }

  const data = await loadPartnerData(partnerId)
  if (!data) {
    detail.push('partner not found or missing slug/name')
    return result
  }

  const ftp = getFtpConfig()
  if (!ftp) {
    result.skippedFtp = true
    detail.push('SPACESHIP_FTP_* env vars not set — generated to disk only')
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `partner-pages-${data.slug}-`))
  const pendingUploads: Array<{ localPath: string; remotePath: string }> = []
  try {
    for (const loc of LOCALES) {
      for (const n of VARIATIONS) {
        const srcPath = path.join(SITE_ROOT, loc.srcDir, `voice-${n}`, 'index.html')
        let source: string
        try {
          source = await fs.readFile(srcPath, 'utf8')
        } catch {
          detail.push(`template missing: ${loc.srcDir}/voice-${n}/index.html`)
          continue
        }
        const generated = substitute(source, data)
        result.generated++

        const remoteRel = `${loc.destPrefix}/${data.slug}/voice-${n}/index.html`
        const tmpPath = path.join(tmpDir, remoteRel.replace(/\//g, '_'))
        await fs.writeFile(tmpPath, generated, 'utf8')

        // Also persist to the on-disk source tree when running locally so
        // a developer can inspect the result. The API container's filesystem
        // is throwaway, so this is best-effort.
        try {
          const localDest = path.join(SITE_ROOT, remoteRel)
          await fs.mkdir(path.dirname(localDest), { recursive: true })
          await fs.writeFile(localDest, generated, 'utf8')
        } catch { /* container fs may be read-only — fine */ }

        if (ftp) pendingUploads.push({ localPath: tmpPath, remotePath: remoteRel })
      }
    }

    if (ftp && pendingUploads.length > 0) {
      const uploadResults = await ftpUploadBatch(pendingUploads, ftp)
      for (const f of pendingUploads) {
        if (uploadResults.get(f.remotePath)) {
          result.uploaded++
          detail.push(`✓ ${f.remotePath}`)
        } else {
          result.failed++
          detail.push(`✗ ${f.remotePath}`)
        }
      }
    }

    result.ok = result.failed === 0 && (ftp ? result.uploaded > 0 : result.generated > 0)
  } finally {
    // Tmp cleanup — never blocks the return.
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
  return result
}
