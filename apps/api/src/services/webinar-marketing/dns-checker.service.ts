/**
 * DNS + MX check for a domain. In-house deliverability hint — cheap, no
 * external dependency, gives medium-confidence signal that the domain at
 * least accepts mail. Runs BEFORE we spend Reoon quota on the address.
 *
 * Timeouts: 3s per lookup. Failure modes (NOTFOUND/TIMEOUT/NODATA/SERVFAIL)
 * all map to `false`. We never blame the user's email for our DNS flakiness;
 * worker can re-verify later if needed.
 */

import dns from 'dns/promises'

const TIMEOUT_MS = 3_000

export interface DnsCheckResult {
  domain: string
  hasA: boolean
  hasMx: boolean
}

export async function checkDomainDns(domain: string): Promise<DnsCheckResult> {
  const cleanDomain = domain.toLowerCase().trim()
  const [a, mx] = await Promise.all([resolveA(cleanDomain), resolveMx(cleanDomain)])
  return { domain: cleanDomain, hasA: a, hasMx: mx }
}

async function resolveA(domain: string): Promise<boolean> {
  try {
    const results = await withTimeout(dns.resolve4(domain).catch(() => dns.resolve6(domain)))
    return Array.isArray(results) && results.length > 0
  } catch {
    return false
  }
}

async function resolveMx(domain: string): Promise<boolean> {
  try {
    const results = await withTimeout(dns.resolveMx(domain))
    return Array.isArray(results) && results.length > 0
  } catch {
    return false
  }
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('dns timeout')), TIMEOUT_MS)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
