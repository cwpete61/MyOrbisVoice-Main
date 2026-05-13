/**
 * Partner bulk email campaign routes (Phase F.4 Batch 2).
 *
 * All mounted under /api and gated by requirePartnerContext. Wraps the
 * email-campaign.service.ts CRUD + state machine in a partner-scoped API.
 *
 * Recipient source today: partner's own CRM Contacts (by id). Future (F.5):
 * the scraped lead pool — the endpoint will accept a different source type.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePartnerContext } from '../middleware/rbac.js'
import * as campaignService from '../services/email-campaign.service.js'
import { getPartnerPolicy } from '../services/email-bulk-policy.service.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()

// Resolve a partner's hosting tenant — duplicated from partner-crm.ts because
// importing across route files invites churn. If we extract a third time,
// move it to apps/api/src/lib/partner-hosting.ts.
async function resolveHostingTenantId(partnerId: string): Promise<string> {
  const recent = await prisma.conversation.findFirst({
    where:   { partnerId },
    orderBy: { startedAt: 'desc' },
    select:  { tenantId: true },
  })
  if (recent?.tenantId) return recent.tenantId
  const platform = await prisma.tenant.findFirst({
    where:  { slug: 'orbis-platform' },
    select: { id: true },
  })
  if (platform) return platform.id
  const any = await prisma.tenant.findFirst({ select: { id: true } })
  if (!any) throw new AppError('SERVER_ERROR', 'No hosting tenant available for campaign', 500)
  return any.id
}

router.use('/partner', authenticate, requirePartnerContext)

function partnerId(req: Request): string {
  return (req as any).partnerAccountId as string
}

// ── List + create + detail + update + delete ───────────────────────────────

router.get('/partner/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const { status, limit, offset } = req.query as Record<string, string>
    const result = await campaignService.listCampaigns(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      {
        status: status ?? undefined,
        limit:  limit  ? parseInt(limit, 10)  : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    )
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.get('/partner/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const camp = await campaignService.getCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
    )
    if (!camp) throw new AppError('NOT_FOUND', 'Campaign not found', 404)
    res.json({ data: camp })
  } catch (err) { next(err) }
})

const createSchema = z.object({
  name:        z.string().min(1).max(120),
  subject:     z.string().min(1).max(200),
  bodyText:    z.string().min(1).max(100_000),
  bodyHtml:    z.string().max(200_000).optional(),
  fromName:    z.string().max(120).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

router.post('/partner/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)

    // Gate: bulk must be enabled by admin + not suspended.
    const policy = await getPartnerPolicy(pid)
    if (!policy) throw new AppError('NOT_FOUND', 'Partner profile not found', 404)
    if (!policy.bulkEnabled) {
      throw new AppError('FORBIDDEN', 'Bulk email is not enabled for your account yet. Contact your admin.', 403)
    }
    if (policy.suspended) {
      throw new AppError('FORBIDDEN', `Bulk email is suspended: ${policy.suspendedReason ?? 'admin action'}`, 403)
    }

    const data = createSchema.parse(req.body)
    const camp = await campaignService.createCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      {
        name:        data.name,
        subject:     data.subject,
        bodyText:    data.bodyText,
        bodyHtml:    data.bodyHtml,
        fromName:    data.fromName,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
    )
    res.status(201).json({ data: camp })
  } catch (err) { next(err) }
})

router.patch('/partner/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const patch = createSchema.partial().parse(req.body)
    const camp = await campaignService.updateCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
      {
        ...patch,
        scheduledAt: patch.scheduledAt === undefined
          ? undefined
          : (patch.scheduledAt ? new Date(patch.scheduledAt) : null),
      },
    )
    res.json({ data: camp })
  } catch (err) { next(err) }
})

router.delete('/partner/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    await campaignService.deleteDraftCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
    )
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Recipients ──────────────────────────────────────────────────────────────

router.post('/partner/campaigns/:id/recipients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const { contactIds } = z.object({
      contactIds: z.array(z.string()).min(1).max(5000),
    }).parse(req.body)
    const result = await campaignService.addRecipientsFromContacts(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
      contactIds,
    )
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.get('/partner/campaigns/:id/recipients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const { status, limit, offset } = req.query as Record<string, string>
    const result = await campaignService.listRecipients(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
      {
        status: status ?? undefined,
        limit:  limit  ? parseInt(limit, 10)  : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    )
    res.json({ data: result })
  } catch (err) { next(err) }
})

// ── State machine actions ──────────────────────────────────────────────────

router.post('/partner/campaigns/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    await campaignService.startCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
    )
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

router.post('/partner/campaigns/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {})
    await campaignService.pauseCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
      reason,
    )
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

router.post('/partner/campaigns/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    await campaignService.resumeCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
    )
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

router.post('/partner/campaigns/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pid = partnerId(req)
    const hostingTenantId = await resolveHostingTenantId(pid)
    await campaignService.cancelCampaign(
      { kind: 'partner', partnerId: pid, hostingTenantId },
      req.params.id!,
    )
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
