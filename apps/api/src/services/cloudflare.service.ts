import { getConfigValue } from './system-config.service.js'

// Cloudflare service — wraps the platform's master Cloudflare account.
// Used by the Bulk Email domain wizard to host a DNS zone for each partner's
// dedicated sending domain and write its SPF / DKIM / DMARC records.
//
// Scope note: Cloudflare hosts the DNS zone. It does NOT register the .com
// itself — Cloudflare has no public API for registering brand-new domains.
// The registrar step lives in a separate service (see sending-domain flow).

const CF_API = 'https://api.cloudflare.com/client/v4'

export interface CloudflareConfig {
  apiToken: string
  accountId: string
}

export async function getCloudflareConfig(): Promise<CloudflareConfig | null> {
  const [token, accountId] = await Promise.all([
    getConfigValue('cloudflare_api_token'),
    getConfigValue('cloudflare_account_id'),
  ])
  const apiToken = token || process.env['CLOUDFLARE_API_TOKEN'] || ''
  const acct = accountId || process.env['CLOUDFLARE_ACCOUNT_ID'] || ''
  if (!apiToken || !acct) return null
  return { apiToken, accountId: acct }
}

interface CfResponse<T> {
  success: boolean
  errors: { code: number; message: string }[]
  result: T
}

async function cfFetch<T>(cfg: CloudflareConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(CF_API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  let body: CfResponse<T>
  try {
    body = (await res.json()) as CfResponse<T>
  } catch {
    throw new Error(`Cloudflare API error: non-JSON response (HTTP ${res.status})`)
  }
  if (!body.success) {
    const msg = body.errors?.map(e => `${e.code} ${e.message}`).join('; ') || `HTTP ${res.status}`
    throw new Error(`Cloudflare API error: ${msg}`)
  }
  return body.result
}

export interface CloudflareZone {
  id: string
  name: string
  status: string // 'pending' until name servers are delegated, then 'active'
  nameServers: string[]
}

function toZone(z: any): CloudflareZone {
  return { id: z.id, name: z.name, status: z.status, nameServers: z.name_servers ?? [] }
}

async function findZoneByName(cfg: CloudflareConfig, domain: string): Promise<CloudflareZone | null> {
  const list = await cfFetch<any[]>(
    cfg,
    `/zones?name=${encodeURIComponent(domain)}&account.id=${cfg.accountId}`,
  )
  return list[0] ? toZone(list[0]) : null
}

/** Create a DNS zone for a domain under the platform account. Idempotent —
 *  returns the existing zone if one already exists for this domain. The
 *  returned nameServers are what the registrar must be pointed at. */
export async function createZone(domain: string): Promise<CloudflareZone> {
  const cfg = await getCloudflareConfig()
  if (!cfg) throw new Error('Cloudflare is not configured (Admin → System Settings)')
  const existing = await findZoneByName(cfg, domain)
  if (existing) return existing
  const result = await cfFetch<any>(cfg, '/zones', {
    method: 'POST',
    body: JSON.stringify({ name: domain, account: { id: cfg.accountId }, type: 'full' }),
  })
  return toZone(result)
}

/** Fetch a zone by id — used to poll for status === 'active' (name servers
 *  delegated and propagated). */
export async function getZone(zoneId: string): Promise<CloudflareZone> {
  const cfg = await getCloudflareConfig()
  if (!cfg) throw new Error('Cloudflare is not configured')
  return toZone(await cfFetch<any>(cfg, `/zones/${zoneId}`))
}

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT' | 'MX'
  name: string
  content: string
  ttl?: number
  priority?: number
}

/** Write a DNS record idempotently — updates in place if a record of the same
 *  type+name already exists, otherwise creates it. Safe to retry. */
export async function upsertDnsRecord(zoneId: string, rec: DnsRecord): Promise<void> {
  const cfg = await getCloudflareConfig()
  if (!cfg) throw new Error('Cloudflare is not configured')
  const existing = await cfFetch<any[]>(
    cfg,
    `/zones/${zoneId}/dns_records?type=${rec.type}&name=${encodeURIComponent(rec.name)}`,
  )
  const payload: Record<string, unknown> = {
    type: rec.type,
    name: rec.name,
    content: rec.content,
    ttl: rec.ttl ?? 3600,
    proxied: false,
  }
  if (rec.priority != null) payload['priority'] = rec.priority
  if (existing[0]) {
    await cfFetch(cfg, `/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  } else {
    await cfFetch(cfg, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
}

/** Write the full email-authentication record set for a sending domain:
 *  SPF (authorizes Amazon SES), the 3 DKIM CNAMEs from SES Easy DKIM, and a
 *  DMARC policy. With SES Easy DKIM the DKIM CNAMEs also satisfy domain
 *  identity verification — no separate _amazonses TXT is needed. Idempotent. */
export async function writeEmailDnsRecords(
  zoneId: string,
  domain: string,
  sesDkimTokens: string[],
): Promise<void> {
  await upsertDnsRecord(zoneId, {
    type: 'TXT',
    name: domain,
    content: 'v=spf1 include:amazonses.com ~all',
  })
  for (const token of sesDkimTokens) {
    await upsertDnsRecord(zoneId, {
      type: 'CNAME',
      name: `${token}._domainkey.${domain}`,
      content: `${token}.dkim.amazonses.com`,
    })
  }
  // p=none during warmup so a misconfiguration never silently drops mail;
  // tightened to quarantine/reject once the domain has a clean track record.
  await upsertDnsRecord(zoneId, {
    type: 'TXT',
    name: `_dmarc.${domain}`,
    content: 'v=DMARC1; p=none; adkim=r; aspf=r',
  })
}
