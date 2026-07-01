/**
 * MyOrbisAgents — Listings (Step 3). The agent's property book (§17c). Each
 * Listing is a working unit Orby answers from.
 *
 * `formatListing` takes pasted MLS/Zillow text and returns a structured,
 * Fair-Housing-safe draft (gpt-4o-mini). The agent confirms/edits, then saves.
 * `renderListingsForPrompt` renders the active book into a knowledge block the
 * gateway concatenates onto Orby's prompt (mirrored gateway-side).
 */
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getOpenAiApiKey, getConfigValue } from './system-config.service.js'
import { checkEntitlement } from './entitlement.service.js'
import type { Prisma, ListingStatus } from '@prisma/client'

const OPENAI = 'https://api.openai.com/v1/chat/completions'

const STATUSES: ListingStatus[] = ['ACTIVE', 'COMING_SOON', 'PENDING', 'SOLD', 'POCKET', 'OFF_MARKET']

export interface ListingDraft {
  address: string
  headline: string | null
  priceUsd: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  propertyType: string | null
  description: string | null
  highlights: string[]
}

const FAIR_HOUSING_RULE =
  'FAIR HOUSING: describe the PROPERTY, never the people or who "should" live there. ' +
  'Do not mention or imply race, color, religion, sex, disability, familial status, national origin, ' +
  'or use coded terms ("safe neighborhood", "great for families", "exclusive", "walking distance to church", ' +
  '"perfect for a young couple"). Stick to objective property facts and nearby amenities stated as facts. ' +
  'Do not invent features not present in the source text.'

/**
 * AI-format pasted listing text into a Fair-Housing-safe structured draft.
 * Returns null on any failure (no key / bad JSON) so the UI can fall back to
 * a manual form.
 */
export async function formatListing(rawText: string): Promise<ListingDraft | null> {
  const key = await getOpenAiApiKey()
  if (!key) return null
  const model = (await getConfigValue('openai_model')) || 'gpt-4o-mini'
  const sys =
    'You convert a pasted real-estate listing (MLS/Zillow/agent notes) into strict JSON for a listing knowledge base. ' +
    'Fields: address (string), headline (short, <70 chars, property-focused), priceUsd (integer or null), ' +
    'beds (number or null), baths (number or null), sqft (integer or null), propertyType (e.g. "Single-family", "Condo", "Townhouse", or null), ' +
    'description (2-4 sentences, factual, Fair-Housing-safe), highlights (array of 3-6 short factual bullet strings). ' +
    FAIR_HOUSING_RULE + ' ' +
    'Return ONLY JSON: { "address": ..., "headline": ..., "priceUsd": ..., "beds": ..., "baths": ..., "sqft": ..., "propertyType": ..., "description": ..., "highlights": [...] }. ' +
    'Use null for unknowns; never invent numbers or features.'
  try {
    const r = await fetch(OPENAI, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: rawText.slice(0, 6000) }],
      }),
    })
    if (!r.ok) { console.error('[listing] openai', r.status); return null }
    const d = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const txt = d.choices?.[0]?.message?.content
    if (!txt) return null
    const p = JSON.parse(txt) as Partial<ListingDraft>
    if (!p.address || typeof p.address !== 'string') return null
    return {
      address: p.address,
      headline: typeof p.headline === 'string' ? p.headline : null,
      priceUsd: typeof p.priceUsd === 'number' ? Math.round(p.priceUsd) : null,
      beds: typeof p.beds === 'number' ? p.beds : null,
      baths: typeof p.baths === 'number' ? p.baths : null,
      sqft: typeof p.sqft === 'number' ? Math.round(p.sqft) : null,
      propertyType: typeof p.propertyType === 'string' ? p.propertyType : null,
      description: typeof p.description === 'string' ? p.description : null,
      highlights: Array.isArray(p.highlights) ? p.highlights.filter((h): h is string => typeof h === 'string').slice(0, 6) : [],
    }
  } catch (e) {
    console.error('[listing] format throw', e)
    return null
  }
}

export interface ListingInput extends ListingDraft {
  status?: ListingStatus
  rawText?: string | null
}

function coerceStatus(s?: string): ListingStatus {
  return s && (STATUSES as string[]).includes(s) ? (s as ListingStatus) : 'ACTIVE'
}

export async function createListing(tenantId: string, data: ListingInput) {
  // Tier gate — listing_limit entitlement. -1 (or absent → treated as unlimited
  // for legacy tenants without the key) means no cap; Solo Capture = 20.
  const limit = await checkEntitlement(tenantId, 'listing_limit')
  if (typeof limit === 'number' && limit >= 0) {
    const count = await prisma.listing.count({ where: { tenantId } })
    if (count >= limit) {
      throw new AppError('FORBIDDEN', `Your plan includes up to ${limit} listings. Upgrade to Solo Power for unlimited.`, 403)
    }
  }
  return prisma.listing.create({
    data: {
      tenantId,
      status: coerceStatus(data.status),
      isActive: coerceStatus(data.status) !== 'SOLD' && coerceStatus(data.status) !== 'OFF_MARKET',
      address: data.address.trim(),
      headline: data.headline?.trim() || null,
      priceUsd: data.priceUsd ?? null,
      beds: data.beds ?? null,
      baths: data.baths ?? null,
      sqft: data.sqft ?? null,
      propertyType: data.propertyType?.trim() || null,
      description: data.description?.trim() || null,
      highlights: data.highlights ?? [],
      rawText: data.rawText ?? null,
    },
  })
}

export async function listListings(tenantId: string) {
  const rows = await prisma.listing.findMany({
    where: { tenantId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: {
      phoneNumbers: { select: { id: true, e164Number: true, displayLabel: true } },
      _count: { select: { conversations: true } },
    },
  })
  // Flatten: expose the first tracking number, callCount, and a compact
  // enrichment summary (AVM) for the UI. Full enrichment via the enrich endpoint.
  return rows.map(({ phoneNumbers, _count, enrichmentJson, ...l }) => {
    const enr = (enrichmentJson ?? null) as { avmUsd?: number | null; comps?: unknown[] } | null
    return {
      ...l,
      trackingNumber: phoneNumbers[0] ?? null,
      callCount: _count.conversations,
      avmUsd: enr?.avmUsd ?? null,
      compsCount: Array.isArray(enr?.comps) ? enr!.comps!.length : 0,
    }
  })
}

/** PURCHASED, inbound-capable numbers not yet tied to a listing — the pick list. */
export async function listAvailableNumbers(tenantId: string) {
  return prisma.phoneNumber.findMany({
    where: { tenantId, purchaseStatus: 'PURCHASED', listingId: null },
    select: { id: true, e164Number: true, displayLabel: true, isInboundEnabled: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function assignTrackingNumber(tenantId: string, listingId: string, phoneNumberId: string) {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, tenantId }, select: { id: true } })
  if (!listing) throw new AppError('NOT_FOUND', 'Listing not found', 404)
  const number = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, tenantId, purchaseStatus: 'PURCHASED' },
    select: { id: true, listingId: true },
  })
  if (!number) throw new AppError('NOT_FOUND', 'Number not found or not purchased', 404)
  if (number.listingId && number.listingId !== listingId) {
    throw new AppError('CONFLICT', 'That number is already assigned to another listing', 409)
  }
  // A listing tracks with one number: clear any prior number on this listing first.
  await prisma.phoneNumber.updateMany({ where: { tenantId, listingId }, data: { listingId: null } })
  return prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { listingId, isInboundEnabled: true },
    select: { id: true, e164Number: true, displayLabel: true },
  })
}

export async function unassignTrackingNumber(tenantId: string, phoneNumberId: string) {
  const number = await prisma.phoneNumber.findFirst({ where: { id: phoneNumberId, tenantId }, select: { id: true } })
  if (!number) throw new AppError('NOT_FOUND', 'Number not found', 404)
  await prisma.phoneNumber.update({ where: { id: phoneNumberId }, data: { listingId: null } })
}

export async function updateListing(tenantId: string, id: string, data: Partial<ListingInput> & { isActive?: boolean }) {
  const existing = await prisma.listing.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Listing not found', 404)
  const update: Prisma.ListingUpdateInput = {
    ...(data.status !== undefined && { status: coerceStatus(data.status) }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
    ...(data.address !== undefined && { address: data.address.trim() }),
    ...(data.headline !== undefined && { headline: data.headline?.trim() || null }),
    ...(data.priceUsd !== undefined && { priceUsd: data.priceUsd }),
    ...(data.beds !== undefined && { beds: data.beds }),
    ...(data.baths !== undefined && { baths: data.baths }),
    ...(data.sqft !== undefined && { sqft: data.sqft }),
    ...(data.propertyType !== undefined && { propertyType: data.propertyType?.trim() || null }),
    ...(data.description !== undefined && { description: data.description?.trim() || null }),
    ...(data.highlights !== undefined && { highlights: data.highlights ?? [] }),
  }
  return prisma.listing.update({ where: { id }, data: update })
}

export async function deleteListing(tenantId: string, id: string) {
  const existing = await prisma.listing.findFirst({ where: { id, tenantId } })
  if (!existing) throw new AppError('NOT_FOUND', 'Listing not found', 404)
  await prisma.listing.delete({ where: { id } })
}

const STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: 'Active', COMING_SOON: 'Coming soon', PENDING: 'Pending',
  SOLD: 'Sold', POCKET: 'Pocket/private', OFF_MARKET: 'Off market',
}

function money(n: number | null): string {
  return n == null ? '' : `$${n.toLocaleString('en-US')}`
}

/**
 * Render the tenant's active book into a prompt knowledge block. Shared shape —
 * the gateway has an identical renderer over its own Prisma client. Caps size so
 * a huge book never blows the prompt budget.
 */
export async function renderListingsForPrompt(tenantId: string, maxChars = 40_000): Promise<string | null> {
  const rows = await prisma.listing.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })
  if (rows.length === 0) return null
  const parts: string[] = ['=== LISTINGS (properties this agent represents — answer buyer/seller questions from these) ===']
  let used = parts[0]!.length
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
