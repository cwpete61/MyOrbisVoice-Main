import { getConfigValue } from './system-config.service.js'

export type EmailStatus = 'valid' | 'invalid' | 'disposable' | 'risky' | 'role_based' | 'unchecked'

interface ReoonResponse {
  status: string
  result?: string
  email?: string
  mx_found?: boolean
  disposable?: boolean
  role_based?: boolean
}

async function getReoonConfig(): Promise<{ apiKey: string; mode: string } | null> {
  const [dbKey, dbMode] = await Promise.all([
    getConfigValue('reoon_api_key'),
    getConfigValue('reoon_mode'),
  ])
  const apiKey = dbKey || process.env['REOON_API_KEY'] || ''
  const mode   = dbMode || process.env['REOON_MODE'] || 'power'
  if (!apiKey) return null
  return { apiKey, mode }
}

export async function verifyEmail(email: string): Promise<{ status: EmailStatus; raw: string }> {
  if (!email) return { status: 'unchecked', raw: 'no_email' }

  const config = await getReoonConfig()
  if (!config) return { status: 'unchecked', raw: 'no_api_key' }

  try {
    const url = `https://emailverifier.reoon.com/api/v1/verify?email=${encodeURIComponent(email)}&key=${config.apiKey}&mode=${config.mode}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return { status: 'unchecked', raw: `http_${res.status}` }

    const data = (await res.json()) as ReoonResponse
    const raw = data.result ?? data.status ?? 'unknown'

    let status: EmailStatus
    if (data.disposable)               status = 'disposable'
    else if (data.role_based)          status = 'role_based'
    else if (raw === 'valid')          status = 'valid'
    else if (raw === 'invalid')        status = 'invalid'
    else if (raw === 'risky')          status = 'risky'
    else if (raw === 'disposable')     status = 'disposable'
    else if (raw === 'role_based')     status = 'role_based'
    else                               status = 'risky'

    return { status, raw }
  } catch {
    return { status: 'unchecked', raw: 'timeout_or_error' }
  }
}

export function emailStatusLabel(status: EmailStatus | string | null | undefined): string {
  switch (status) {
    case 'valid':      return 'Verified'
    case 'invalid':    return 'Invalid'
    case 'disposable': return 'Disposable'
    case 'risky':      return 'Risky'
    case 'role_based': return 'Role-based'
    default:           return 'Unchecked'
  }
}

export function isEmailSafeToContact(status: EmailStatus | string | null | undefined): boolean {
  return status === 'valid'
}
