import { prisma } from '../lib/prisma.js'
import { sendColdEmail } from './cold-email.service.js'
import { addDays } from '../lib/bulk-email-pure.js'

// Cold-email sequencer (Bulk Email Phase 4). Turns a static campaign into a
// running one: walks every enrolled lead through the campaign's touch
// sequence, one touch at a time, on schedule.
//
// Scheduling lives in the ColdEmailCampaignLead row (currentTouch +
// nextTouchAt). The actual send goes through sendColdEmail, which already
// enforces the cap / send window / drip / suppression / verification gate —
// so the sequencer never has to know those rules. It just reacts to the
// outcome: SENT advances the lead, SUPPRESSED/INVALID stops it, BLOCKED/FAILED
// is left for the next tick. Idempotent and safe to run on any interval.

export interface SequencerResult {
  campaigns: number
  processed: number
  sent: number
}

/** One sequencer pass over every ACTIVE campaign. */
export async function runSequencerTick(): Promise<SequencerResult> {
  const campaigns = await prisma.coldEmailCampaign.findMany({
    where: { status: 'ACTIVE' },
    include: { touches: { orderBy: { touchNumber: 'asc' } } },
  })

  let processed = 0
  let sent = 0

  for (const campaign of campaigns) {
    if (campaign.touches.length === 0) continue

    const leads = await prisma.coldEmailCampaignLead.findMany({
      where: { campaignId: campaign.id, status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
      include: { lead: { select: { email: true } } },
    })

    for (const cl of leads) {
      processed++

      // First pass for a freshly enrolled lead — schedule touch 1.
      if (cl.nextTouchAt == null) {
        await prisma.coldEmailCampaignLead.update({
          where: { id: cl.id },
          data: { nextTouchAt: addDays(cl.createdAt, campaign.touches[0]!.delayDays) },
        })
        continue
      }
      if (cl.nextTouchAt > new Date()) continue // not due yet

      const nextTouchNumber = cl.currentTouch + 1
      const touch = campaign.touches.find(t => t.touchNumber === nextTouchNumber)
      if (!touch) {
        // No further touch — the lead has finished the sequence.
        await prisma.coldEmailCampaignLead.update({
          where: { id: cl.id },
          data: { status: 'COMPLETED', nextTouchAt: null },
        })
        continue
      }
      if (!cl.lead.email) {
        await prisma.coldEmailCampaignLead.update({
          where: { id: cl.id },
          data: { status: 'STOPPED', nextTouchAt: null },
        })
        continue
      }

      const result = await sendColdEmail({
        partnerId: campaign.partnerId,
        to: cl.lead.email,
        subject: touch.subject,
        bodyHtml: touch.bodyHtml,
      })

      if (result.outcome === 'SENT') {
        sent++
        const following = campaign.touches.find(t => t.touchNumber === nextTouchNumber + 1)
        await prisma.coldEmailCampaignLead.update({
          where: { id: cl.id },
          data: {
            currentTouch: nextTouchNumber,
            status: following ? 'IN_PROGRESS' : 'COMPLETED',
            nextTouchAt: following ? addDays(new Date(), following.delayDays) : null,
          },
        })
      } else if (result.outcome === 'SUPPRESSED' || result.outcome === 'INVALID') {
        // Address is unreachable / opted out — stop this lead.
        await prisma.coldEmailCampaignLead.update({
          where: { id: cl.id },
          data: { status: 'STOPPED', nextTouchAt: null },
        })
      }
      // BLOCKED (cap / window / drip) or FAILED — leave the lead untouched;
      // the next tick retries once the gate clears.
    }

    // Campaign done when no lead is still ENROLLED or IN_PROGRESS.
    const remaining = await prisma.coldEmailCampaignLead.count({
      where: { campaignId: campaign.id, status: { in: ['ENROLLED', 'IN_PROGRESS'] } },
    })
    if (remaining === 0) {
      await prisma.coldEmailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }
  }

  return { campaigns: campaigns.length, processed, sent }
}
