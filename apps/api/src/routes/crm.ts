import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as crmService from '../services/crm.service.js'
import { sendEmail } from '../services/email.service.js'
import { AppError } from '@voiceautomation/shared'
import { prisma } from '../lib/prisma.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

// ── Pipeline stages ─────────────────────────────────────────────────────────

router.get('/crm/pipeline-stages', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const stages = await crmService.listPipelineStages({ kind: 'tenant', tenantId })
    res.json({ data: stages })
  } catch (err) { next(err) }
})

const stageInputSchema = z.object({
  id:        z.string().optional(),
  name:      z.string().min(1).max(80),
  sortOrder: z.number().int().min(0),
  color:     z.string().max(40).nullable().optional(),
  isWon:     z.boolean().optional(),
  isLost:    z.boolean().optional(),
})

router.put('/crm/pipeline-stages', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const { stages, toDelete } = z.object({
      stages:   z.array(stageInputSchema).min(1),
      toDelete: z.array(z.string()).default([]),
    }).parse(req.body)
    const out = await crmService.upsertPipelineStages({ kind: 'tenant', tenantId }, stages, toDelete)
    res.json({ data: out })
  } catch (err) { next(err) }
})

// ── Pipeline list view (kanban-ready) ───────────────────────────────────────
// Returns contacts grouped by stage. Used by the kanban board.
router.get('/crm/board', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const [stages, contacts] = await Promise.all([
      crmService.listPipelineStages({ kind: 'tenant', tenantId }),
      prisma.contact.findMany({
        where: { tenantId, partnerId: null, pipelineStageId: { not: null } },
        select: {
          id: true, fullName: true, firstName: true, lastName: true,
          email: true, phoneE164: true, source: true,
          pipelineStageId: true, stageUpdatedAt: true, createdAt: true,
        },
        orderBy: { stageUpdatedAt: 'desc' },
        take: 500,
      }),
    ])
    res.json({ data: { stages, contacts } })
  } catch (err) { next(err) }
})

// ── Contact stage move ──────────────────────────────────────────────────────

router.patch('/crm/contacts/:id/stage', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const { stageId } = z.object({ stageId: z.string().min(1) }).parse(req.body)

    const stage = await prisma.pipelineStage.findFirst({
      where:  { id: stageId, tenantId, partnerId: null },
      select: { id: true },
    })
    if (!stage) throw new AppError('NOT_FOUND', 'Stage not found', 404)

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId, partnerId: null }, select: { id: true },
    })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)

    await crmService.setContactStage({ contactId, stageId })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// ── Contact notes ───────────────────────────────────────────────────────────

router.get('/crm/contacts/:id/notes', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const notes = await crmService.listContactNotes({ kind: 'tenant', tenantId }, contactId)
    res.json({ data: notes })
  } catch (err) { next(err) }
})

router.post('/crm/contacts/:id/notes', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const userId    = req.user!.id
    const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body)

    const note = await crmService.addContactNote({
      scope: { kind: 'tenant', tenantId },
      contactId,
      authorUserId: userId,
      body,
    })
    res.status(201).json({ data: note })
  } catch (err) { next(err) }
})

// ── Send email to contact ───────────────────────────────────────────────────
// Logs to MessageLog with channel=EMAIL so the timeline shows it alongside SMS.

router.post('/crm/contacts/:id/email', async (req, res, next) => {
  try {
    const tenantId  = req.user!.currentTenantId!
    const contactId = req.params.id!
    const { subject, body } = z.object({
      subject: z.string().min(1).max(200),
      body:    z.string().min(1).max(50_000),
    }).parse(req.body)

    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
    if (!contact) throw new AppError('NOT_FOUND', 'Contact not found', 404)
    if (!contact.email) throw new AppError('VALIDATION_ERROR', 'Contact has no email address', 422)

    // Wrap plain-text body in minimal HTML so the email renders correctly.
    // Keep the wrapper small — most tenants will send short follow-ups.
    const html = `<div style="font-family:sans-serif;max-width:640px;color:#222;line-height:1.55;white-space:pre-wrap">${
      body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }</div>`

    // F.4 — multi-transport. Returns provider + providerMessageId so the
    // bounce/complaint webhooks can later match this exact send.
    const sendResult = await sendEmail({
      to: contact.email,
      subject,
      html,
      text: body,
      kind: 'transactional',
      tenantId,
    })
    if (!sendResult.sent) {
      throw new AppError(
        sendResult.skipped === 'suppressed' ? 'VALIDATION_ERROR' : 'EXTERNAL_ERROR',
        sendResult.skipped === 'suppressed'
          ? `Recipient is on the suppression list (${sendResult.reason})`
          : `Email send failed: ${sendResult.reason ?? sendResult.skipped}`,
        sendResult.skipped === 'suppressed' ? 422 : 502,
      )
    }

    const log = await prisma.messageLog.create({
      data: {
        tenantId,
        contactId,
        channel:           'EMAIL',
        direction:         'OUTBOUND',
        sender:            req.user!.email || 'system',
        recipient:         contact.email,
        subject,
        bodyText:          body,
        deliveryStatus:    'sent',
        sentAt:            new Date(),
        providerMessageId: sendResult.providerMessageId ?? null,
      },
      select: { id: true },
    }).catch(err => {
      console.warn('[crm] email logged to MessageLog failed:', (err as Error).message)
      return null
    })

    res.json({ data: { ok: true, messageId: log?.id ?? null, provider: sendResult.provider } })
  } catch (err) { next(err) }
})

export default router
