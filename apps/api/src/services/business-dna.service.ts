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

export async function getActiveDNA(tenantId: string) {
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
