/**
 * Webinar Marketing worker — single-instance setInterval tick that drives the
 * pipeline forward one stage at a time.
 *
 * Stage machine (Phase 2 scope):
 *   DRAFT          → no work
 *   DISCOVERING    → pick one PENDING SearchQuery, hit its provider, insert
 *                    DiscoveredUrl rows, mark DONE. When all queries done,
 *                    advance list to EXTRACTING.
 *   EXTRACTING     → pick one PENDING DiscoveredUrl per polite domain budget,
 *                    crawl contact pages, extract emails, insert
 *                    ExtractedEmail rows. When all URLs done, advance list
 *                    to VERIFYING (Phase 3).
 *   VERIFYING      → Phase 3 (classify + Reoon + promotion gate)
 *   READY/ARCHIVED → no work
 *
 * Concurrency: one tick at a time. Per-provider rate limits enforced via
 * lastCalledAt timestamp map. Per-domain politeness baked into crawler.
 *
 * Re-entrancy: a `ticking` flag guards overlapping ticks. If the worker
 * stalls (e.g. a hung fetch), tick continues to next interval after
 * controller.abort() in fetchWithTimeout.
 */

import { prisma } from '../../lib/prisma.js'
import { getProvider, providerRateLimitMs } from './search/index.js'
import type { SearchResult } from './search/index.js'
import { generateQueries } from './query-generator.service.js'
import { crawlDomain } from './crawler.service.js'
import { log as auditLog } from './audit.service.js'
import { classifyEmail } from './classifier.service.js'
import { pickVerifier } from './verifier/index.js'
import { attemptAutoPromote } from './promotion.service.js'
import { checkDomainDns } from './dns-checker.service.js'
import {
  isCoolingDown,
  recordBlock,
  recordSuccess,
  ProviderBlockedError,
} from './search/provider-state.js'

/** Daily cap of search queries that may complete per partner. Prevents one
 *  aggressive partner from cooking the master IP for everyone else. Rolling
 *  24h window. */
const PARTNER_DAILY_QUERY_CAP = 200

/** Counts DONE + FAILED + currently-RUNNING WebinarSearchQuery rows in the
 *  last 24h for this partner. Returns true when over the cap. The cap is
 *  intentionally inclusive of FAILED so retry storms can't dodge it. */
async function partnerExceededDailyCap(partnerId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const completed = await prisma.webinarSearchQuery.count({
    where: {
      leadList: { partnerId },
      status: { in: ['DONE', 'FAILED', 'RUNNING'] },
      OR: [
        { completedAt: { gte: since } },
        { completedAt: null }, // currently RUNNING — still counts
      ],
    },
  })
  return completed >= PARTNER_DAILY_QUERY_CAP
}

const WORKER_INTERVAL_MS = 10_000
let timer: NodeJS.Timeout | null = null
let ticking = false

// In-memory per-provider rate-limit guard. Map<providerSlug, lastCallEpochMs>.
const providerLastCall = new Map<string, number>()

export function startWebinarMarketingWorker(): void {
  if (timer) return
  console.log(`[webinar-marketing-worker] starting, tick = ${WORKER_INTERVAL_MS}ms`)
  timer = setInterval(() => {
    void runTick()
  }, WORKER_INTERVAL_MS)
}

export function stopWebinarMarketingWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export async function runTick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    await stepDiscoveringLists()
    await stepExtractingLists()
    await stepVerifyingLists()
  } catch (err) {
    console.error('[webinar-marketing-worker] tick failed', err)
  } finally {
    ticking = false
  }
}

// ─── DISCOVERING stage ───────────────────────────────────────────────────────

async function stepDiscoveringLists(): Promise<void> {
  // Pick a PENDING query that ISN'T on a cooling-down provider. Failover
  // works by passing over queries whose provider is currently cooling
  // (they'll get picked up when cooldown expires). Oldest-first within
  // the eligible set.
  //
  // We can't push the `isCoolingDown` check into Prisma — it's in-memory
  // state — so we pull a small batch and filter in-app. Batch size of 50
  // is plenty since the worker only acts on one row per tick anyway.
  const candidates = await prisma.webinarSearchQuery.findMany({
    where: {
      status: 'PENDING',
      leadList: { status: 'DISCOVERING', deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { leadList: true },
    take: 50,
  })
  if (candidates.length === 0) {
    await advanceExhaustedDiscoveryLists()
    return
  }

  // Find first candidate whose provider is NOT cooling and whose partner
  // hasn't exceeded the daily cap. Other candidates wait for next tick.
  let pending: (typeof candidates)[number] | null = null
  for (const c of candidates) {
    if (isCoolingDown(c.provider)) continue
    if (await partnerExceededDailyCap(c.leadList.partnerId)) continue
    pending = c
    break
  }
  if (!pending) {
    // Every PENDING query is gated. Nothing to do this tick.
    return
  }

  const now = Date.now()
  const minDelay = providerRateLimitMs(pending.provider)
  const last = providerLastCall.get(pending.provider) ?? 0
  if (now - last < minDelay) return // skip; another provider will tick

  providerLastCall.set(pending.provider, now)

  await prisma.webinarSearchQuery.update({
    where: { id: pending.id },
    data: { status: 'RUNNING' },
  })

  const provider = getProvider(pending.provider)
  if (!provider) {
    await prisma.webinarSearchQuery.update({
      where: { id: pending.id },
      data: { status: 'FAILED', errorMessage: 'unknown provider', completedAt: new Date() },
    })
    return
  }

  let results: SearchResult[] = []
  try {
    results = await provider.search(pending.queryText, pending.leadList.maxResultsPerQuery)
    recordSuccess(pending.provider)
  } catch (err) {
    // Block detection — re-queue the query (don't burn it) and bump the
    // provider's failure counter. After N consecutive blocks the provider
    // trips cooldown and the next tick will skip it.
    if (err instanceof ProviderBlockedError) {
      const { cooldownTrippedAt } = recordBlock(pending.provider)
      await prisma.webinarSearchQuery.update({
        where: { id: pending.id },
        data: {
          status: 'PENDING', // re-queue, will be retried after cooldown
          errorMessage: `blocked: ${err.signal}`.slice(0, 500),
        },
      })
      void auditLog({
        partnerId: pending.leadList.partnerId,
        action: 'discovery_started',
        entityType: 'WebinarSearchQuery',
        entityId: pending.id,
        details: {
          provider: pending.provider,
          blocked: true,
          signal: err.signal,
          cooldownTrippedAt,
        },
      })
      return
    }
    // Non-block error — fail the query, don't retry.
    await prisma.webinarSearchQuery.update({
      where: { id: pending.id },
      data: {
        status: 'FAILED',
        errorMessage: (err as Error).message.slice(0, 500),
        completedAt: new Date(),
      },
    })
    return
  }

  // Insert DiscoveredUrl rows. Dedup against existing rows for THIS list +
  // url to avoid the same homepage showing up across queries.
  const existing = await prisma.webinarDiscoveredUrl.findMany({
    where: {
      leadListId: pending.leadListId,
      url: { in: results.map((r) => r.url) },
    },
    select: { url: true },
  })
  const seen = new Set(existing.map((e) => e.url))

  const newRows = results
    .filter((r) => !seen.has(r.url))
    .map((r) => {
      let domain = ''
      try {
        domain = new URL(r.url).hostname.toLowerCase()
      } catch {
        return null
      }
      return {
        leadListId: pending.leadListId,
        searchQueryId: pending.id,
        url: r.url,
        domain,
        title: r.title || null,
        snippet: r.snippet || null,
        provider: r.provider,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (newRows.length > 0) {
    await prisma.webinarDiscoveredUrl.createMany({ data: newRows })
  }

  await prisma.webinarSearchQuery.update({
    where: { id: pending.id },
    data: {
      status: 'DONE',
      resultCount: newRows.length,
      completedAt: new Date(),
    },
  })

  void auditLog({
    partnerId: pending.leadList.partnerId,
    action: 'discovery_started', // reuse — log entry per query
    entityType: 'WebinarSearchQuery',
    entityId: pending.id,
    details: { provider: pending.provider, results: newRows.length },
  })
}

async function advanceExhaustedDiscoveryLists(): Promise<void> {
  // Find DISCOVERING lists where every SearchQuery has terminal status.
  const lists = await prisma.webinarLeadList.findMany({
    where: { status: 'DISCOVERING', deletedAt: null },
    select: { id: true, partnerId: true },
  })
  for (const list of lists) {
    const stillRunning = await prisma.webinarSearchQuery.count({
      where: { leadListId: list.id, status: { in: ['PENDING', 'RUNNING'] } },
    })
    if (stillRunning === 0) {
      await prisma.webinarLeadList.update({
        where: { id: list.id },
        data: { status: 'EXTRACTING' },
      })
      void auditLog({
        partnerId: list.partnerId,
        action: 'discovery_completed',
        entityType: 'WebinarLeadList',
        entityId: list.id,
      })
    }
  }
}

// ─── EXTRACTING stage ────────────────────────────────────────────────────────

async function stepExtractingLists(): Promise<void> {
  // One PENDING DiscoveredUrl per tick, oldest first. Crawler enforces its
  // own per-domain politeness so we don't double-throttle here.
  const pending = await prisma.webinarDiscoveredUrl.findFirst({
    where: {
      status: 'PENDING',
      leadList: { status: 'EXTRACTING', deletedAt: null },
    },
    orderBy: { discoveredAt: 'asc' },
    include: { leadList: true },
  })
  if (!pending) {
    await advanceExhaustedExtractionLists()
    return
  }

  // Skip if we've already crawled this domain to the per-domain page cap.
  // We track domain-level page count across all URLs in the same list.
  const sameDomainCount = await prisma.webinarDiscoveredUrl.count({
    where: {
      leadListId: pending.leadListId,
      domain: pending.domain,
      status: 'CRAWLED',
    },
  })
  if (sameDomainCount >= pending.leadList.maxPagesPerDomain) {
    await prisma.webinarDiscoveredUrl.update({
      where: { id: pending.id },
      data: { status: 'SKIPPED_RATE_LIMIT' },
    })
    return
  }

  let result: Awaited<ReturnType<typeof crawlDomain>>
  try {
    result = await crawlDomain({
      startUrl: pending.url,
      maxPagesPerDomain: Math.max(1, pending.leadList.maxPagesPerDomain - sameDomainCount),
    })
  } catch (err) {
    await prisma.webinarDiscoveredUrl.update({
      where: { id: pending.id },
      data: {
        status: 'FAILED',
        errorMessage: (err as Error).message.slice(0, 500),
        crawledAt: new Date(),
      },
    })
    return
  }

  // Map robots result to schema enum string.
  let nextStatus: 'CRAWLED' | 'SKIPPED_ROBOTS' | 'FAILED' = 'CRAWLED'
  if (result.robotsStatus === 'disallowed') nextStatus = 'SKIPPED_ROBOTS'
  if (result.robotsStatus === 'fetch_failed' && result.emails.length === 0)
    nextStatus = 'FAILED'

  await prisma.webinarDiscoveredUrl.update({
    where: { id: pending.id },
    data: {
      status: nextStatus,
      robotsCheck: result.robotsStatus,
      crawledAt: new Date(),
      errorMessage:
        result.errors.length > 0 ? result.errors.slice(0, 5).join('; ').slice(0, 500) : null,
    },
  })

  // Insert ExtractedEmail rows. Filter out duplicates by (leadListId,
  // normalizedEmail, discoveredUrlId).
  if (result.emails.length > 0) {
    const existing = await prisma.webinarExtractedEmail.findMany({
      where: {
        leadListId: pending.leadListId,
        discoveredUrlId: pending.id,
      },
      select: { normalizedEmail: true },
    })
    const dupes = new Set(existing.map((e) => e.normalizedEmail))

    const newEmailRows = result.emails
      .filter((e) => !dupes.has(e.email))
      .map((e) => ({
        leadListId: pending.leadListId,
        discoveredUrlId: pending.id,
        email: e.email,
        normalizedEmail: e.email, // already lowercased by extractor
        domain: e.email.split('@')[1] ?? '',
        sourceUrl: e.sourceUrl,
        sourcePageTitle: e.pageTitle,
        rawContextSnippet: e.context.slice(0, 500),
        classificationStatus: 'PENDING' as const,
      }))
    if (newEmailRows.length > 0) {
      await prisma.webinarExtractedEmail.createMany({ data: newEmailRows })
      void auditLog({
        partnerId: pending.leadList.partnerId,
        action: 'email_extracted',
        entityType: 'WebinarDiscoveredUrl',
        entityId: pending.id,
        details: { count: newEmailRows.length, domain: pending.domain },
      })
    }
  }

  void auditLog({
    partnerId: pending.leadList.partnerId,
    action: 'url_crawled',
    entityType: 'WebinarDiscoveredUrl',
    entityId: pending.id,
    details: {
      pagesVisited: result.pagesVisited,
      emails: result.emails.length,
      robots: result.robotsStatus,
    },
  })
}

async function advanceExhaustedExtractionLists(): Promise<void> {
  const lists = await prisma.webinarLeadList.findMany({
    where: { status: 'EXTRACTING', deletedAt: null },
    select: { id: true, partnerId: true },
  })
  for (const list of lists) {
    const stillPending = await prisma.webinarDiscoveredUrl.count({
      where: { leadListId: list.id, status: 'PENDING' },
    })
    if (stillPending === 0) {
      await prisma.webinarLeadList.update({
        where: { id: list.id },
        data: { status: 'VERIFYING' },
      })
    }
  }
}

// ─── VERIFYING stage ─────────────────────────────────────────────────────────

async function stepVerifyingLists(): Promise<void> {
  // One PENDING extracted email per tick. Strategy: classify first (cheap),
  // then verify only if the type warrants it (skip DISPOSABLE / NO_REPLY /
  // INVALID — they're rejected without spending verifier quota).
  const pending = await prisma.webinarExtractedEmail.findFirst({
    where: {
      classificationStatus: 'PENDING',
      leadList: { status: 'VERIFYING', deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
    include: { leadList: true },
  })
  if (!pending) {
    await advanceExhaustedVerificationLists()
    return
  }

  // 1. Classify (pure, no I/O)
  const classification = classifyEmail({ normalizedEmail: pending.normalizedEmail })

  // 2. Hard-reject classes — disposable/no-reply/invalid skip verification.
  if (
    classification.emailType === 'DISPOSABLE_DOMAIN' ||
    classification.emailType === 'NO_REPLY_OR_SUPPRESSED' ||
    classification.emailType === 'INVALID_FORMAT'
  ) {
    await prisma.webinarExtractedEmail.update({
      where: { id: pending.id },
      data: {
        emailType: classification.emailType,
        classificationStatus: 'REJECTED',
        reviewerNotes: classification.reason,
      },
    })
    void auditLog({
      partnerId: pending.leadList.partnerId,
      action: 'email_classified',
      entityType: 'WebinarExtractedEmail',
      entityId: pending.id,
      details: { emailType: classification.emailType, action: 'rejected' },
    })
    return
  }

  // 3. Free-mail — store classification but DO NOT auto-verify or auto-promote.
  //    Lands in QUARANTINED for operator review with consent + notes.
  if (classification.emailType === 'PERSONAL_FREE_MAIL') {
    await prisma.webinarExtractedEmail.update({
      where: { id: pending.id },
      data: {
        emailType: classification.emailType,
        classificationStatus: 'QUARANTINED',
        reviewerNotes: classification.reason,
      },
    })
    void auditLog({
      partnerId: pending.leadList.partnerId,
      action: 'email_classified',
      entityType: 'WebinarExtractedEmail',
      entityId: pending.id,
      details: { emailType: classification.emailType, action: 'quarantined' },
    })
    return
  }

  // 4a. In-house DNS+MX pre-filter (free). Skip the Reoon call when the
  //     domain doesn't even accept mail — saves ~30-50% of quota on cold
  //     scrapes where many domains are parked / dead / forwarded only.
  const dns = await checkDomainDns(classification.domain)
  if (!dns.hasA && !dns.hasMx) {
    // Domain doesn't resolve + no MX → undeliverable. Record an internal
    // verification row so the promotion gate has something to read.
    await prisma.webinarEmailVerification.create({
      data: {
        extractedEmailId: pending.id,
        normalizedEmail: pending.normalizedEmail,
        syntaxValid: true,
        mxValid: false,
        disposable: false,
        providerStatus: 'undeliverable',
        providerReason: 'in-house: no A and no MX',
        provider: 'internal_dns',
      },
    })
    await prisma.webinarExtractedEmail.update({
      where: { id: pending.id },
      data: {
        emailType: classification.emailType,
        classificationStatus: 'REJECTED',
        reviewerNotes: 'in-house dns: domain has no A or MX',
      },
    })
    void auditLog({
      partnerId: pending.leadList.partnerId,
      action: 'email_verified',
      entityType: 'WebinarExtractedEmail',
      entityId: pending.id,
      details: { stage: 'in-house-dns', result: 'undeliverable_no_dns', reoonSpent: false },
    })
    return
  }
  if (!dns.hasMx) {
    // Has A but no MX = unlikely to receive mail. Quarantine (don't spend
    // Reoon quota — operator can still approve via manual review).
    await prisma.webinarEmailVerification.create({
      data: {
        extractedEmailId: pending.id,
        normalizedEmail: pending.normalizedEmail,
        syntaxValid: true,
        mxValid: false,
        disposable: false,
        providerStatus: 'risky',
        providerReason: 'in-house: A record present but no MX',
        provider: 'internal_dns',
      },
    })
    await prisma.webinarExtractedEmail.update({
      where: { id: pending.id },
      data: {
        emailType: classification.emailType,
        classificationStatus: 'QUARANTINED',
        reviewerNotes: 'in-house dns: A only, no MX — needs human review',
      },
    })
    void auditLog({
      partnerId: pending.leadList.partnerId,
      action: 'email_verified',
      entityType: 'WebinarExtractedEmail',
      entityId: pending.id,
      details: { stage: 'in-house-dns', result: 'risky_no_mx', reoonSpent: false },
    })
    return
  }

  // 4b. DNS+MX passed. Now spend Reoon quota (or fall back to internal-DNS
  //     if quota exhausted) for actual mailbox check.
  const verifier = await pickVerifier(
    pending.leadList.partnerId,
    pending.leadList.verificationMode,
  )
  let result
  try {
    result = await verifier.verify(pending.normalizedEmail)
  } catch (err) {
    await prisma.webinarExtractedEmail.update({
      where: { id: pending.id },
      data: {
        emailType: classification.emailType,
        classificationStatus: 'QUARANTINED',
        reviewerNotes: `verifier error: ${(err as Error).message.slice(0, 200)}`,
      },
    })
    return
  }

  await prisma.webinarEmailVerification.create({
    data: {
      extractedEmailId: pending.id,
      normalizedEmail: pending.normalizedEmail,
      syntaxValid: result.syntaxValid,
      mxValid: result.mxValid,
      disposable: result.disposable,
      providerStatus: result.status,
      providerReason: result.reason,
      provider: result.provider,
    },
  })

  // 5. Set classification status based on verification outcome.
  let nextStatus: 'CLASSIFIED' | 'QUARANTINED' | 'REJECTED' = 'CLASSIFIED'
  if (result.status === 'undeliverable' || result.disposable) {
    nextStatus = 'REJECTED'
  } else if (result.status === 'risky' || result.status === 'unknown') {
    nextStatus = 'QUARANTINED'
  } else if (result.status === 'deliverable') {
    nextStatus = 'CLASSIFIED'
  }

  await prisma.webinarExtractedEmail.update({
    where: { id: pending.id },
    data: {
      emailType: classification.emailType,
      classificationStatus: nextStatus,
      reviewerNotes: classification.reason,
    },
  })

  void auditLog({
    partnerId: pending.leadList.partnerId,
    action: 'email_verified',
    entityType: 'WebinarExtractedEmail',
    entityId: pending.id,
    details: {
      emailType: classification.emailType,
      verifier: result.provider,
      providerStatus: result.status,
      nextStatus,
    },
  })

  // 6. If CLASSIFIED, attempt auto-promote per policy in promotion.service.ts.
  //    Falls through silently when not eligible (e.g. role-based prefix needs
  //    human approval per policy).
  if (nextStatus === 'CLASSIFIED') {
    await attemptAutoPromote(pending.id, pending.leadList)
  }
}

async function advanceExhaustedVerificationLists(): Promise<void> {
  const lists = await prisma.webinarLeadList.findMany({
    where: { status: 'VERIFYING', deletedAt: null },
    select: { id: true, partnerId: true },
  })
  for (const list of lists) {
    const stillPending = await prisma.webinarExtractedEmail.count({
      where: { leadListId: list.id, classificationStatus: 'PENDING' },
    })
    if (stillPending === 0) {
      await prisma.webinarLeadList.update({
        where: { id: list.id },
        data: { status: 'READY' },
      })
    }
  }
}

// ─── Kick-off helper used by POST /lists/:id/discover ────────────────────────

/**
 * Mark a DRAFT list as DISCOVERING and enqueue SearchQuery rows for each
 * (provider × generated-query) pair. Called from the route handler.
 *
 * Idempotent: re-running on an already-DISCOVERING list returns the same
 * counts without enqueueing duplicates (unique constraint on
 * (leadListId, queryText, provider) prevents that).
 */
export async function startDiscovery(leadListId: string): Promise<{
  queriesEnqueued: number
}> {
  const list = await prisma.webinarLeadList.findUnique({
    where: { id: leadListId },
  })
  if (!list || list.deletedAt) {
    throw new Error('list not found')
  }
  if (list.status !== 'DRAFT' && list.status !== 'DISCOVERING') {
    throw new Error(`cannot start discovery from status ${list.status}`)
  }

  const queries = generateQueries({
    niche: list.niche,
    location: list.location,
    optionalEmailDomainFilter: list.optionalEmailDomainFilter,
  })

  const rows = list.searchEngines.flatMap((provider) =>
    queries.map((queryText) => ({
      leadListId: list.id,
      queryText,
      provider,
    })),
  )

  // Postgres ON CONFLICT (leadListId, queryText, provider) DO NOTHING via
  // skipDuplicates flag.
  const result = await prisma.webinarSearchQuery.createMany({
    data: rows,
    skipDuplicates: true,
  })

  if (list.status === 'DRAFT') {
    await prisma.webinarLeadList.update({
      where: { id: list.id },
      data: { status: 'DISCOVERING' },
    })
    void auditLog({
      partnerId: list.partnerId,
      action: 'discovery_started',
      entityType: 'WebinarLeadList',
      entityId: list.id,
      details: { queries: rows.length },
    })
  }

  return { queriesEnqueued: result.count }
}
