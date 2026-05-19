// Pure, dependency-free helpers for the Bulk Email system. No Prisma, no AWS,
// no I/O — cheap to unit-test and safe to import anywhere. The send engine,
// the warmup runner, and the sequencer all draw from here.

/** CAN-SPAM fallback postal address — used when a partner has not set theirs. */
export const PLATFORM_POSTAL_ADDRESS =
  'MyOrbisVoice, 716 Washington St Suite 2, Allentown, PA 18102'

/** Warmup target — the full daily send cap a domain ramps up to. */
export const WARMUP_TARGET_CAP = 50

/** Warmup ramp: the daily send cap for a given day since warmup started.
 *  Gentle climb (5 → 50 over a week) protects a new domain's reputation. */
export function warmupCapForDay(day: number): number {
  if (day <= 1) return 5
  if (day === 2) return 10
  if (day === 3) return 15
  if (day === 4) return 20
  if (day === 5) return 30
  if (day === 6) return 40
  return WARMUP_TARGET_CAP
}

/** Escape the four HTML-significant characters for safe interpolation. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c =>
    (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }) as Record<string, string>)[c]!,
  )
}

export interface PartnerPostal {
  businessName: string | null
  displayName: string | null
  partnerStreet: string | null
  partnerUnit: string | null
  partnerCity: string | null
  partnerState: string | null
  partnerPostalCode: string | null
}

/** The CAN-SPAM postal line for an email footer — the partner's own address
 *  when they have set one, otherwise the platform's legal address. */
export function postalAddress(p: PartnerPostal): string {
  const parts = [
    [p.partnerStreet, p.partnerUnit].filter(Boolean).join(' '),
    p.partnerCity,
    [p.partnerState, p.partnerPostalCode].filter(Boolean).join(' '),
  ]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
  if (parts.length === 0) return PLATFORM_POSTAL_ADDRESS
  const name = p.businessName || p.displayName || 'MyOrbisVoice partner'
  return `${name}, ${parts.join(', ')}`
}

/** The date `days` days after `from`. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000)
}
