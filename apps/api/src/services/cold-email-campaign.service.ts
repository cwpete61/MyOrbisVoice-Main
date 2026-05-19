import type { ColdEmailCampaignStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

// Cold-email campaign service (Bulk Email Phase 3). A partner builds a
// multi-touch campaign: a named campaign, an ordered touch sequence (touch 1
// = the intro, then timed follow-ups), and a set of enrolled leads. Phase 4's
// sequencer then advances each enrolled lead through the touches.
//
// Every function is partner-scoped — a partner can only see and edit their
// own campaigns.

export async function createCampaign(partnerId: string, name: string) {
  return prisma.coldEmailCampaign.create({
    data: { partnerId, name: name.trim() || 'Untitled campaign', status: 'DRAFT' },
  })
}

/** All of a partner's campaigns, newest first, with touch + lead counts. */
export async function listCampaigns(partnerId: string) {
  return prisma.coldEmailCampaign.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { touches: true, leads: true } } },
  })
}

/** One campaign with its full touch sequence and enrolled leads. */
export async function getCampaign(partnerId: string, campaignId: string) {
  return prisma.coldEmailCampaign.findFirst({
    where: { id: campaignId, partnerId },
    include: {
      touches: { orderBy: { touchNumber: 'asc' } },
      leads: {
        include: {
          lead: { select: { id: true, businessName: true, email: true, ownerName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

async function requireCampaign(partnerId: string, campaignId: string) {
  const campaign = await prisma.coldEmailCampaign.findFirst({
    where: { id: campaignId, partnerId },
  })
  if (!campaign) throw new Error('Campaign not found')
  return campaign
}

/** Rename a campaign or change its status. Activation (→ ACTIVE) is gated on
 *  the campaign having at least one touch and one enrolled lead. */
export async function updateCampaign(
  partnerId: string,
  campaignId: string,
  patch: { name?: string; status?: ColdEmailCampaignStatus },
) {
  const campaign = await requireCampaign(partnerId, campaignId)

  if (patch.status === 'ACTIVE' && campaign.status !== 'ACTIVE') {
    const [touchCount, leadCount] = await Promise.all([
      prisma.coldEmailCampaignTouch.count({ where: { campaignId } }),
      prisma.coldEmailCampaignLead.count({ where: { campaignId } }),
    ])
    if (touchCount === 0) throw new Error('Add at least one touch before activating the campaign')
    if (leadCount === 0) throw new Error('Enroll at least one lead before activating the campaign')
  }

  const data: Prisma.ColdEmailCampaignUpdateInput = {}
  if (patch.name !== undefined) data.name = patch.name.trim() || 'Untitled campaign'
  if (patch.status !== undefined) {
    data.status = patch.status
    if (patch.status === 'ACTIVE' && !campaign.startedAt) data.startedAt = new Date()
    if (patch.status === 'COMPLETED') data.completedAt = new Date()
  }
  return prisma.coldEmailCampaign.update({ where: { id: campaignId }, data })
}

export interface TouchInput {
  delayDays: number
  subject: string
  bodyHtml: string
}

/** Replace a campaign's touch sequence. Touches are renumbered 1..N in the
 *  order given. Editable only while the campaign is a DRAFT. */
export async function saveTouches(partnerId: string, campaignId: string, touches: TouchInput[]) {
  const campaign = await requireCampaign(partnerId, campaignId)
  if (campaign.status !== 'DRAFT') {
    throw new Error('The touch sequence can only be edited while the campaign is a draft')
  }
  await prisma.$transaction([
    prisma.coldEmailCampaignTouch.deleteMany({ where: { campaignId } }),
    prisma.coldEmailCampaignTouch.createMany({
      data: touches.map((t, i) => ({
        campaignId,
        touchNumber: i + 1,
        delayDays: Math.max(0, Math.floor(t.delayDays)),
        subject: t.subject.trim(),
        bodyHtml: t.bodyHtml,
      })),
    }),
  ])
  return getCampaign(partnerId, campaignId)
}

/** Enroll leads into a campaign. Only the partner's own accepted leads
 *  (SAVED or PROMOTED) that have an email address are added; everything else
 *  is silently skipped, as are leads already enrolled. */
export async function enrollLeads(
  partnerId: string,
  campaignId: string,
  leadIds: string[],
): Promise<{ enrolled: number }> {
  await requireCampaign(partnerId, campaignId)
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      partnerId,
      reviewStatus: { in: ['SAVED', 'PROMOTED'] },
      email: { not: null },
    },
    select: { id: true },
  })
  if (leads.length === 0) return { enrolled: 0 }
  const result = await prisma.coldEmailCampaignLead.createMany({
    data: leads.map(l => ({ campaignId, leadId: l.id })),
    skipDuplicates: true,
  })
  return { enrolled: result.count }
}

/** The partner's accepted leads (SAVED or PROMOTED, with an email) — the pool
 *  a campaign's lead picker draws from. */
export async function listEligibleLeads(partnerId: string) {
  return prisma.lead.findMany({
    where: {
      partnerId,
      reviewStatus: { in: ['SAVED', 'PROMOTED'] },
      email: { not: null },
    },
    select: { id: true, businessName: true, email: true, ownerName: true, category: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

/** Remove one enrolled lead from a campaign. */
export async function removeLead(partnerId: string, campaignId: string, campaignLeadId: string) {
  await requireCampaign(partnerId, campaignId)
  await prisma.coldEmailCampaignLead.deleteMany({ where: { id: campaignLeadId, campaignId } })
}

/** Delete a campaign. Blocked while it is ACTIVE — pause it first. */
export async function deleteCampaign(partnerId: string, campaignId: string) {
  const campaign = await requireCampaign(partnerId, campaignId)
  if (campaign.status === 'ACTIVE') {
    throw new Error('Pause the campaign before deleting it')
  }
  await prisma.coldEmailCampaign.delete({ where: { id: campaignId } })
}
