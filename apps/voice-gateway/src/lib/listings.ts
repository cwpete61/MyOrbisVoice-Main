/**
 * Renders the tenant's active listing book into a prompt knowledge block.
 * Mirrors the API's renderListingsForPrompt — same shape, gateway-side Prisma
 * client. Concatenated onto kbText so Orby answers buyer/seller questions from
 * the agent's actual properties (§17c). Fair-Housing guardrail baked in.
 */
import { prisma } from './prisma.js'
import type { ListingStatus } from '@prisma/client'

const STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: 'Active', COMING_SOON: 'Coming soon', PENDING: 'Pending',
  SOLD: 'Sold', POCKET: 'Pocket/private', OFF_MARKET: 'Off market',
}

function money(n: number | null): string {
  return n == null ? '' : `$${n.toLocaleString('en-US')}`
}

// Render the free neighborhood enrichment (Census/OSM/FEMA/colleges) as neutral
// facts Orby can cite. Fair-Housing: facts + implicit source only, never a
// judgment about the area or who belongs there.
function renderNeighborhood(enrichmentJson: unknown): string {
  const nb = (enrichmentJson as { neighborhood?: {
    populationTract?: number | null; medianHouseholdIncomeUsd?: number | null
    floodZoneLabel?: string | null
    schoolDistrict?: string | null
    k12Schools?: { name: string; km: number; grades: string }[]
    hospitals?: { name: string; km: number }[]; schools?: { name: string; km: number }[]
    colleges?: { name: string; city: string | null }[]
  } } | null)?.neighborhood
  if (!nb) return ''
  const mi = (km: number) => `${(km * 0.621371).toFixed(1)} mi` // US market: report miles, not km
  const bits: string[] = []
  if (nb.populationTract != null) bits.push(`census-tract population ~${nb.populationTract.toLocaleString('en-US')}`)
  if (nb.medianHouseholdIncomeUsd != null) bits.push(`median household income ${money(nb.medianHouseholdIncomeUsd)}`)
  if (nb.floodZoneLabel) bits.push(`FEMA flood: ${nb.floodZoneLabel}`)
  // Real K-12 (NCES): the assigned public district + nearest public schools with
  // grade ranges. THIS is the correct answer to "what schools / K-12 / district".
  if (nb.schoolDistrict) bits.push(`assigned public school district: ${nb.schoolDistrict}`)
  if (nb.k12Schools?.length) bits.push(`nearest public K-12 schools in that district: ${nb.k12Schools.map(s => `${s.name}${s.grades ? ` (grades ${s.grades}, ${mi(s.km)})` : ` (${mi(s.km)})`}`).join(', ')} — still tell the caller to verify current attendance zones with the district`)
  if (nb.hospitals?.length) bits.push(`nearby hospitals: ${nb.hospitals.map(h => `${h.name} (${mi(h.km)})`).join(', ')}`)
  // OSM schools are secondary — only mention if asked about non-public/specialty.
  if (nb.schools?.length) bits.push(`other schools on the map (may include private/specialty — NOT the assigned public school): ${nb.schools.map(s => `${s.name} (${mi(s.km)})`).join(', ')}`)
  if (nb.colleges?.length) bits.push(`colleges/universities within ~15 miles (higher education — NOT K-12 school districts; do not call these "school districts"): ${nb.colleges.map(c => c.name).join(', ')}`)
  if (!bits.length) return ''
  return `\n  Area facts (state neutrally in MILES, cite as public data — never characterize the area or who should live there): ${bits.join('; ')}.`
}

export async function fetchListingsForPrompt(
  tenantId: string,
  maxChars = 40_000,
): Promise<string | null> {
  const rows = await prisma.listing.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })
  if (rows.length === 0) return null
  const head = '=== LISTINGS (properties this agent represents — answer buyer/seller questions from these) ==='
  const parts: string[] = [head]
  let used = head.length
  for (const l of rows) {
    const facts = [
      money(l.priceUsd),
      l.beds != null ? `${l.beds} bd` : '',
      l.baths != null ? `${l.baths} ba` : '',
      l.sqft != null ? `${l.sqft.toLocaleString('en-US')} sqft` : '',
      l.propertyType ?? '',
    ].filter(Boolean).join(' · ')
    const block =
      `\n\n• ${l.headline || l.address} [${STATUS_LABEL[l.status]}]\n` +
      `  ${l.address}${facts ? `\n  ${facts}` : ''}` +
      (l.description ? `\n  ${l.description}` : '') +
      (l.highlights.length ? `\n  Highlights: ${l.highlights.join('; ')}` : '') +
      renderNeighborhood(l.enrichmentJson)
    if (used + block.length > maxChars) { parts.push('\n\n(Additional listings omitted for length — ask the caller which property.)'); break }
    parts.push(block)
    used += block.length
  }
  parts.push('\n\nNever discuss who "should" live somewhere; describe the property and objective facts only.')
  return parts.join('')
}
