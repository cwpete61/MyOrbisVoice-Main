import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

const jsonSection = z.record(z.unknown()).default({})

export const businessDNASchema = z.object({
  identityJson: jsonSection,
  servicesJson: jsonSection,
  pricingJson: jsonSection,
  operationsJson: jsonSection,
  salesJson: jsonSection,
  appointmentJson: jsonSection,
  supportJson: jsonSection,
  languageJson: jsonSection,
  complianceJson: jsonSection,
})

export type BusinessDNAInput = z.infer<typeof businessDNASchema>

const DEFAULT_DNA: BusinessDNAInput = {
  identityJson: { businessName: '', agentName: '', tagline: '', description: '', founded: '', type: '' },
  servicesJson: { services: [] },
  pricingJson: { pricingModel: '', startingPrice: '', notes: '' },
  operationsJson: { businessHours: {}, holidays: [], serviceArea: [] },
  salesJson: { qualificationCriteria: [], objectionResponses: [], callToAction: '' },
  appointmentJson: { appointmentTypes: [], duration: 30, buffer: 10, leadTime: 24 },
  supportJson: { escalationConditions: [], faqItems: [], fallbackBehavior: '' },
  languageJson: { primaryLanguage: 'en', tone: 'professional', prohibitedWords: [] },
  complianceJson: { disclaimers: [], regulations: [], recordingNotice: '' },
}

// ── Canonical DNA from the Account Hub (authored in MyOrbisResults) ──────────
// Flag-gated for safe rollout: DNA_FROM_HUB=all (every tenant) OR
// DNA_FROM_HUB_TENANTS=id1,id2 (gradual). Reads the Hub's effective VOICE DNA,
// adapts it to Voice's BusinessDNA shape, and falls back to the local record on
// any miss/error so live voice sessions never break.
const HUB_URL = process.env.HUB_URL
const HUB_SVC = process.env.HUB_SERVICE_TOKEN

function dnaFromHubEnabled(tenantId: string): boolean {
  if (process.env.DNA_FROM_HUB === 'all') return true
  const list = (process.env.DNA_FROM_HUB_TENANTS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return list.includes(tenantId)
}

const num = (v: unknown, d: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
const langCode = (v: unknown): string => {
  const s = String(v ?? '').toLowerCase()
  if (s.startsWith('es') || s.includes('span') || s.includes('español')) return 'es'
  if (s.startsWith('en') || s.includes('eng')) return 'en'
  return s.slice(0, 2) || 'en'
}

/** Adapt the Hub's effective DNA (core + VOICE overlay) to Voice's BusinessDNA shape. */
export function normalizeForVoice(effective: Record<string, unknown>): BusinessDNAInput {
  const e = effective ?? {}
  const appt = (e.appointment ?? {}) as Record<string, unknown>
  const lang = (e.language ?? {}) as Record<string, unknown>
  const types = Array.isArray(appt.appointmentTypes) ? appt.appointmentTypes : []
  return {
    identityJson: (e.identity ?? {}) as Record<string, unknown>,
    servicesJson: (e.services ?? {}) as Record<string, unknown>,
    pricingJson: (e.pricing ?? {}) as Record<string, unknown>,
    operationsJson: (e.operations ?? {}) as Record<string, unknown>,
    salesJson: (e.sales ?? {}) as Record<string, unknown>,
    appointmentJson: {
      ...appt,
      duration: num(appt.duration, 30),
      buffer: num(appt.buffer, 10),
      leadTime: num(appt.leadTime, 24),
      appointmentTypes: types.map((t) => (t && typeof t === 'object' ? { ...(t as object), duration: num((t as Record<string, unknown>).duration, 30) } : t)),
    },
    supportJson: (e.support ?? {}) as Record<string, unknown>,
    languageJson: { ...lang, primaryLanguage: langCode(lang.primaryLanguage) },
    complianceJson: (e.compliance ?? {}) as Record<string, unknown>,
  }
}

// Short cache + degrade-to-stale so the voice hot path never makes a Hub call per
// session and never breaks if the Hub blips.
type HubDNA = { id: string; tenantId: string; version: number; isActive: boolean; createdAt: Date; updatedAt: Date } & BusinessDNAInput
const HUB_TTL_MS = 30_000
const hubCache = new Map<string, { at: number; dna: HubDNA | null }>()

async function getHubDNA(tenantId: string): Promise<HubDNA | null> {
  const cached = hubCache.get(tenantId)
  if (cached && Date.now() - cached.at < HUB_TTL_MS) return cached.dna
  if (!HUB_URL || !HUB_SVC) return null
  try {
    const res = await fetch(`${HUB_URL}/v1/tenants/${tenantId}/dna/effective?product=VOICE`, {
      headers: { authorization: `Bearer ${HUB_SVC}` },
    })
    if (res.status === 404) { hubCache.set(tenantId, { at: Date.now(), dna: null }); return null }
    if (!res.ok) throw new Error(`hub ${res.status}`)
    const data = (await res.json()) as { effective?: Record<string, unknown>; version?: number }
    if (!data.effective) { hubCache.set(tenantId, { at: Date.now(), dna: null }); return null }
    const now = new Date()
    const dna: HubDNA = { id: 'hub', tenantId, version: data.version ?? 0, isActive: true, ...normalizeForVoice(data.effective), createdAt: now, updatedAt: now }
    hubCache.set(tenantId, { at: Date.now(), dna })
    return dna
  } catch {
    return cached ? cached.dna : null // serve stale rather than fail the session
  }
}

export async function getActiveDNA(tenantId: string) {
  if (dnaFromHubEnabled(tenantId)) {
    const hub = await getHubDNA(tenantId)
    if (hub) return hub as unknown as Awaited<ReturnType<typeof prisma.businessDNA.findFirst>>
  }
  const dna = await prisma.businessDNA.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { version: 'desc' },
  })
  return dna
}

export async function getDNAList(tenantId: string) {
  return prisma.businessDNA.findMany({
    where: { tenantId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, isActive: true, createdAt: true, updatedAt: true },
  })
}

export async function getDNA(tenantId: string, id: string) {
  const dna = await prisma.businessDNA.findFirst({ where: { id, tenantId } })
  if (!dna) throw new AppError('NOT_FOUND', 'Business DNA version not found', 404)
  return dna
}

export async function createDNADraft(tenantId: string, data?: Partial<BusinessDNAInput>) {
  const latest = await prisma.businessDNA.findFirst({
    where: { tenantId },
    orderBy: { version: 'desc' },
  })
  const nextVersion = (latest?.version ?? 0) + 1
  const base = latest ?? DEFAULT_DNA

  return prisma.businessDNA.create({
    data: {
      tenantId,
      version: nextVersion,
      isActive: false,
      identityJson: (data?.identityJson ?? base.identityJson) as object,
      servicesJson: (data?.servicesJson ?? base.servicesJson) as object,
      pricingJson: (data?.pricingJson ?? base.pricingJson) as object,
      operationsJson: (data?.operationsJson ?? base.operationsJson) as object,
      salesJson: (data?.salesJson ?? base.salesJson) as object,
      appointmentJson: (data?.appointmentJson ?? base.appointmentJson) as object,
      supportJson: (data?.supportJson ?? base.supportJson) as object,
      languageJson: (data?.languageJson ?? base.languageJson) as object,
      complianceJson: (data?.complianceJson ?? base.complianceJson) as object,
    },
  })
}

export async function updateDNADraft(tenantId: string, id: string, data: Partial<BusinessDNAInput>) {
  const dna = await prisma.businessDNA.findFirst({ where: { id, tenantId } })
  if (!dna) throw new AppError('NOT_FOUND', 'Business DNA version not found', 404)
  if (dna.isActive) throw new AppError('CONFLICT', 'Cannot edit a published DNA version — create a new draft', 409)

  return prisma.businessDNA.update({
    where: { id },
    data: {
      ...(data.identityJson !== undefined && { identityJson: data.identityJson as object }),
      ...(data.servicesJson !== undefined && { servicesJson: data.servicesJson as object }),
      ...(data.pricingJson !== undefined && { pricingJson: data.pricingJson as object }),
      ...(data.operationsJson !== undefined && { operationsJson: data.operationsJson as object }),
      ...(data.salesJson !== undefined && { salesJson: data.salesJson as object }),
      ...(data.appointmentJson !== undefined && { appointmentJson: data.appointmentJson as object }),
      ...(data.supportJson !== undefined && { supportJson: data.supportJson as object }),
      ...(data.languageJson !== undefined && { languageJson: data.languageJson as object }),
      ...(data.complianceJson !== undefined && { complianceJson: data.complianceJson as object }),
    },
  })
}

export async function publishDNA(tenantId: string, id: string, publishedByUserId: string) {
  const dna = await prisma.businessDNA.findFirst({ where: { id, tenantId } })
  if (!dna) throw new AppError('NOT_FOUND', 'Business DNA version not found', 404)
  if (dna.isActive) throw new AppError('CONFLICT', 'This version is already active', 409)

  return prisma.$transaction(async (tx) => {
    // Deactivate all other versions for this tenant
    await tx.businessDNA.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    })
    const published = await tx.businessDNA.update({
      where: { id },
      data: { isActive: true },
    })
    // Audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        actorType: 'USER',
        actorUserId: publishedByUserId,
        action: 'business_dna.published',
        targetType: 'BusinessDNA',
        targetId: id,
        metadataJson: { version: dna.version },
      },
    })
    return published
  })
}
