'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

type TenantContext = {
  brandName?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  twilioNumber?: string | null
  address?: string | null
}

type Profile = {
  brandName?: string
  fallbackNotificationEmail?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
}

type DnaIdentity = { businessName?: string; website?: string; phone?: string; email?: string } | null

let _cached: TenantContext | null = null

async function loadContext(): Promise<TenantContext> {
  if (_cached) return _cached

  const [profile, dna, phones] = await Promise.all([
    apiFetch<Profile>('/api/business-profile').catch(() => ({} as Profile)),
    apiFetch<{ identityJson?: DnaIdentity } | null>('/api/business-dna').catch(() => null),
    apiFetch<Array<{ e164Number: string }>>('/api/phone-numbers').catch(() => [] as Array<{ e164Number: string }>),
  ])

  const identity: DnaIdentity = (dna && (dna as { identityJson?: DnaIdentity }).identityJson) || null
  const addressParts = [profile.addressLine1, profile.addressLine2, profile.city, profile.region, profile.postalCode, profile.country].filter(Boolean) as string[]

  const ctx: TenantContext = {
    brandName: identity?.businessName || profile.brandName || null,
    email: identity?.email || profile.fallbackNotificationEmail || null,
    phone: identity?.phone || null,
    website: identity?.website || null,
    twilioNumber: phones?.[0]?.e164Number || null,
    address: addressParts.length ? addressParts.join(', ') : null,
  }
  _cached = ctx
  return ctx
}

const PLACEHOLDERS: Record<keyof TenantContext, string[]> = {
  brandName:    ['[CLIENT BUSINESS NAME]'],
  email:        ['[CLIENT EMAIL]'],
  phone:        ['[CLIENT PHONE NUMBER]', '[CLIENT PHONE]'],
  website:      ['[CLIENT WEBSITE URL]', '[CLIENT WEBSITE]'],
  twilioNumber: ['[CLIENT TWILIO NUMBER]'],
  address:      ['[CLIENT ADDRESS]'],
}

function fillPlaceholders(content: string, ctx: TenantContext): { filled: string; missing: string[] } {
  let out = content
  const missing: string[] = []
  for (const key of Object.keys(PLACEHOLDERS) as Array<keyof TenantContext>) {
    const value = ctx[key]
    for (const ph of PLACEHOLDERS[key]) {
      if (out.includes(ph)) {
        if (value) {
          out = out.split(ph).join(value)
        } else {
          if (!missing.includes(ph)) missing.push(ph)
        }
      }
    }
  }
  return { filled: out, missing }
}

export function HelpTemplateBlock({ label, content }: { label: string; content: string }) {
  const [ctx, setCtx] = useState<TenantContext | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadContext().then(setCtx).catch(() => setCtx({}))
  }, [])

  const { filled, missing } = ctx ? fillPlaceholders(content, ctx) : { filled: content, missing: [] }

  function copy() {
    navigator.clipboard.writeText(filled)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl mt-3 mb-2" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}>
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(45% 0.11 193)' }}>
            <rect x="4" y="3" width="9" height="11" rx="1" />
            <path d="M7 3V2h3v1" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
          {ctx && missing.length === 0 && (
            <span className="text-xs" style={{ color: 'oklch(50% 0.13 145)' }}>· auto-filled</span>
          )}
        </div>
        <button
          onClick={copy}
          className="text-xs px-3 py-1 rounded-md transition-colors"
          style={{
            background: copied ? 'oklch(55% 0.14 145)' : 'oklch(55% 0.11 193)',
            color: '#fff',
            border: 'none',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre
        className="px-3 py-3 text-xs whitespace-pre-wrap break-words"
        style={{ color: 'var(--text-primary)', fontFamily: 'inherit', margin: 0 }}
      >
        {filled}
      </pre>
      {missing.length > 0 && (
        <div className="px-3 py-2 text-xs" style={{ borderTop: '1px solid var(--border-subtle)', color: 'oklch(50% 0.15 60)', background: 'oklch(95% 0.05 60 / 0.4)' }}>
          ⚠ Still has placeholders: {missing.join(', ')}.{' '}
          {missing.includes('[CLIENT WEBSITE URL]') || missing.includes('[CLIENT WEBSITE]') || missing.includes('[CLIENT PHONE NUMBER]') || missing.includes('[CLIENT PHONE]')
            ? <>Add these in <a href="/business-dna" style={{ textDecoration: 'underline', color: 'inherit' }}>Business DNA → Identity</a> for auto-fill next time.</>
            : missing.includes('[CLIENT TWILIO NUMBER]')
              ? <>Add a Twilio phone number on the <a href="/phone-numbers" style={{ textDecoration: 'underline', color: 'inherit' }}>Phone Numbers</a> page first.</>
              : <>Replace each before pasting into Twilio.</>}
        </div>
      )}
    </div>
  )
}
