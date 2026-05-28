/**
 * Webinar Marketing — list CRUD service (partner-scoped).
 *
 * Phase 1 stub. Phase 2 adds:
 *   - generateSearchQueries(leadList) — niche/location → query strings per provider
 *   - kickOffDiscovery(leadListId) — enqueues SearchQuery rows + advances status
 *
 * Tenant isolation: every read filtered by partnerId. Soft-delete via
 * deletedAt — default queries exclude deletedAt-set rows.
 */

import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import type { Prisma } from '@prisma/client'

// --- Validation schemas ------------------------------------------------------

export const createListSchema = z.object({
  name: z.string().min(1).max(120),
  niche: z.string().min(1).max(120),
  location: z.string().min(1).max(120),
  optionalEmailDomainFilter: z.string().max(253).nullable().optional(),
  searchEngines: z
    .array(
      z.enum([
        'duckduckgo',
        'bing_web_search',
        'google_scrape',
        'serpapi',
        'google_custom_search',
      ]),
    )
    .min(1)
    .max(5),
  maxResultsPerQuery: z.number().int().min(1).max(500).default(100),
  maxPagesPerDomain: z.number().int().min(1).max(50).default(5),
  verificationMode: z
    .enum(['SYNTAX_DNS_ONLY', 'EXTERNAL_PROVIDER'])
    .default('EXTERNAL_PROVIDER'),
  allowedEmailTypes: z
    .array(
      z.enum([
        'business_domain_only',
        'role_based_business',
        'manual_review_free_mail',
      ]),
    )
    .default(['business_domain_only', 'role_based_business']),
})

export type CreateListInput = z.infer<typeof createListSchema>

export const updateListSchema = createListSchema.partial()
export type UpdateListInput = z.infer<typeof updateListSchema>

// --- CRUD --------------------------------------------------------------------

export async function listForPartner(partnerId: string) {
  return prisma.webinarLeadList.findMany({
    where: { partnerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      niche: true,
      location: true,
      status: true,
      searchEngines: true,
      maxResultsPerQuery: true,
      maxPagesPerDomain: true,
      verificationMode: true,
      allowedEmailTypes: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          extractedEmails: true,
          inviteContacts: true,
        },
      },
    },
  })
}

export async function getById(partnerId: string, id: string) {
  const list = await prisma.webinarLeadList.findFirst({
    where: { id, partnerId, deletedAt: null },
    include: {
      _count: {
        select: {
          searchQueries: true,
          discoveredUrls: true,
          extractedEmails: true,
          inviteContacts: true,
        },
      },
    },
  })
  if (!list) throw new AppError('NOT_FOUND', 'Webinar list not found', 404)
  return list
}

export async function create(partnerId: string, input: CreateListInput) {
  return prisma.webinarLeadList.create({
    data: {
      partnerId,
      name: input.name,
      niche: input.niche.toLowerCase().trim(),
      location: input.location.toLowerCase().trim(),
      optionalEmailDomainFilter: input.optionalEmailDomainFilter ?? null,
      searchEngines: input.searchEngines,
      maxResultsPerQuery: input.maxResultsPerQuery,
      maxPagesPerDomain: input.maxPagesPerDomain,
      verificationMode: input.verificationMode,
      allowedEmailTypes: input.allowedEmailTypes,
    },
  })
}

export async function update(
  partnerId: string,
  id: string,
  input: UpdateListInput,
) {
  await getById(partnerId, id) // ownership check
  const data: Prisma.WebinarLeadListUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.niche !== undefined) data.niche = input.niche.toLowerCase().trim()
  if (input.location !== undefined)
    data.location = input.location.toLowerCase().trim()
  if (input.optionalEmailDomainFilter !== undefined)
    data.optionalEmailDomainFilter = input.optionalEmailDomainFilter
  if (input.searchEngines !== undefined) data.searchEngines = input.searchEngines
  if (input.maxResultsPerQuery !== undefined)
    data.maxResultsPerQuery = input.maxResultsPerQuery
  if (input.maxPagesPerDomain !== undefined)
    data.maxPagesPerDomain = input.maxPagesPerDomain
  if (input.verificationMode !== undefined)
    data.verificationMode = input.verificationMode
  if (input.allowedEmailTypes !== undefined)
    data.allowedEmailTypes = input.allowedEmailTypes
  return prisma.webinarLeadList.update({ where: { id }, data })
}

export async function archive(partnerId: string, id: string) {
  await getById(partnerId, id)
  return prisma.webinarLeadList.update({
    where: { id },
    data: { status: 'ARCHIVED', deletedAt: new Date() },
  })
}
