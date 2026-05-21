/**
 * Brevo sender-domain orchestration.
 *
 * Replaces the SES domain-identity flow for the Bulk Email engine. A partner
 * registers a sending domain via the wizard → we register it with Brevo,
 * fetch the DKIM/DMARC records Brevo needs us to publish, push those to
 * Cloudflare DNS, and finally tell Brevo to authenticate the domain. After
 * that, the cold-email engine can send `From: <slug>@<domain>` via Brevo's
 * REST API (`api.brevo.com/v3/smtp/email`) and Brevo carries the deliverability
 * load — IP reputation, complaint handling, bounce processing.
 *
 * The aws-ses.service.ts module stays in the codebase, untouched, as a future
 * option once AWS approves a quota increase. Provider choice is per-domain
 * via PartnerSendingDomain.provider — currently always `brevo`, future-proof
 * for the day SES becomes worth re-pursuing.
 *
 * All Brevo API calls go to api.brevo.com/v3. Key is the REST API key
 * (`xkeysib-…`) stored in SystemConfig as `email.brevo.api_key`.
 */

import { getConfigValue } from './system-config.service.js'

const BREVO_API = 'https://api.brevo.com/v3'

async function brevoKey(): Promise<string> {
  const k = await getConfigValue('email.brevo.api_key')
  if (!k) throw new Error('Brevo REST API key not configured (System Settings → Brevo)')
  return k
}

/** A single DNS record Brevo wants us to publish on the partner domain to
 *  prove ownership + authorise sending. Brevo returns a structured object
 *  with named record types — we normalise to the shape Cloudflare's
 *  writeEmailDnsRecords helper expects. */
export interface BrevoDnsRecord {
  /** "dkim" | "dmarc" | "brevo_code" | "spf" — used so the Cloudflare writer
   *  can dedupe + know how to merge (SPF in particular must merge, not
   *  replace, existing records). */
  kind:  string
  type:  'TXT' | 'CNAME' | 'MX'
  name:  string   // fully-qualified hostname Brevo wants the record on
  value: string   // record content
}

export interface BrevoDomainState {
  /** True once Brevo has confirmed the DKIM record. */
  verified:      boolean
  /** True once Brevo flags the domain as fully authenticated + ready to send. */
  authenticated: boolean
  /** Records Brevo needs us to publish. Empty once the domain is fully
   *  authenticated (Brevo stops returning them). */
  dnsRecords:    BrevoDnsRecord[]
  /** Raw response chunk for diagnostics if Brevo's shape changes. */
  raw:           Record<string, unknown>
}

/** Create a sender domain on Brevo. Idempotent — if Brevo already has the
 *  domain (e.g. from a previous attempt), the API returns 400; we treat that
 *  as success and just fetch the existing state. */
export async function createBrevoDomain(domain: string): Promise<BrevoDomainState> {
  const key = await brevoKey()
  const res = await fetch(`${BREVO_API}/senders/domains`, {
    method:  'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body:    JSON.stringify({ name: domain }),
  })
  // Brevo returns 400 with a "domain already exists" code when we re-add the
  // same domain after a partial setup. That's not an error — fetch the
  // current state and return it.
  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { code?: string; message?: string }
    if ((body.code ?? '').toLowerCase().includes('already') || (body.message ?? '').toLowerCase().includes('already')) {
      return getBrevoDomain(domain)
    }
    throw new Error(`Brevo create-domain rejected: ${body.message ?? res.statusText}`)
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Brevo create-domain ${res.status}: ${txt.slice(0, 200)}`)
  }
  return getBrevoDomain(domain)
}

/** Fetch current state for a sender domain. Used both to read out the DNS
 *  records we need to publish, and to poll for the verified/authenticated
 *  flags after DNS lands. */
export async function getBrevoDomain(domain: string): Promise<BrevoDomainState> {
  const key = await brevoKey()
  const res = await fetch(`${BREVO_API}/senders/domains/${encodeURIComponent(domain)}`, {
    headers: { 'api-key': key, accept: 'application/json' },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Brevo get-domain ${res.status}: ${txt.slice(0, 200)}`)
  }
  const body = await res.json() as {
    name?: string
    verified?: boolean
    authenticated?: boolean
    dns_records?: Record<string, { type?: string; host_name?: string; value?: string; status?: string }>
  }

  const records: BrevoDnsRecord[] = []
  for (const [kind, r] of Object.entries(body.dns_records ?? {})) {
    if (!r?.host_name || !r?.value || !r?.type) continue
    records.push({
      kind,
      type:  String(r.type).toUpperCase() as BrevoDnsRecord['type'],
      name:  r.host_name,
      value: r.value,
    })
  }

  return {
    verified:      Boolean(body.verified),
    authenticated: Boolean(body.authenticated),
    dnsRecords:    records,
    raw:           body as unknown as Record<string, unknown>,
  }
}

/** Trigger Brevo to (re-)check the DNS records and flip the domain to
 *  authenticated. Idempotent — safe to call repeatedly, the state in
 *  getBrevoDomain() reflects the latest check. */
export async function authenticateBrevoDomain(domain: string): Promise<BrevoDomainState> {
  const key = await brevoKey()
  const res = await fetch(`${BREVO_API}/senders/domains/${encodeURIComponent(domain)}/authenticate`, {
    method:  'PUT',
    headers: { 'api-key': key, accept: 'application/json' },
  })
  // 204 = success, 400 = DNS records not in place yet (we retry later)
  if (res.status !== 204 && res.status !== 200 && res.status !== 400) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Brevo authenticate ${res.status}: ${txt.slice(0, 200)}`)
  }
  return getBrevoDomain(domain)
}

/** Delete the sender domain on Brevo. Used when a partner cancels their
 *  sending-domain registration before it goes live (matches the existing
 *  DELETE /api/partner/sending-domain flow). */
export async function deleteBrevoDomain(domain: string): Promise<void> {
  const key = await brevoKey()
  const res = await fetch(`${BREVO_API}/senders/domains/${encodeURIComponent(domain)}`, {
    method:  'DELETE',
    headers: { 'api-key': key, accept: 'application/json' },
  })
  // 204 = deleted, 404 = already gone (idempotent), anything else = real error
  if (res.status !== 204 && res.status !== 200 && res.status !== 404) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Brevo delete-domain ${res.status}: ${txt.slice(0, 200)}`)
  }
}
