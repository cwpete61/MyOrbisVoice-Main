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
      (l.highlights.length ? `\n  Highlights: ${l.highlights.join('; ')}` : '')
    if (used + block.length > maxChars) { parts.push('\n\n(Additional listings omitted for length — ask the caller which property.)'); break }
    parts.push(block)
    used += block.length
  }
  parts.push('\n\nNever discuss who "should" live somewhere; describe the property and objective facts only.')
  return parts.join('')
}
