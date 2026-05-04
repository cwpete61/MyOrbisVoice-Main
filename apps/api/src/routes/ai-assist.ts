import { Router, type IRouter } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import { AppError } from '@voiceautomation/shared'
import { writeAuditLog } from '../lib/audit.js'
import {
  generateDnaSection,
  type DnaSection,
} from '../services/ai-assist.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

const SUPPORTED_SECTIONS = [
  'identity',
  'sales',
  'appointment',
  'support',
  'language',
  'operations',
] as const

const bodySchema = z.object({
  section: z.enum(SUPPORTED_SECTIONS),
  contextSeed: z
    .object({
      businessName: z.string().trim().max(200).optional(),
      industry: z.string().trim().max(200).optional(),
      brief: z.string().trim().max(1000).optional(),
      tone: z.string().trim().max(200).optional(),
    })
    .default({}),
})

router.post('/ai-assist/generate-dna-section', async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError('BAD_REQUEST', 'Invalid section or seed.', 400)
    }
    const { section, contextSeed } = parsed.data
    const tenantId = req.user!.currentTenantId!

    const content = await generateDnaSection(
      tenantId,
      section as DnaSection,
      contextSeed,
    )

    // Audit on success only — failures already log via error handler.
    void writeAuditLog({
      tenantId,
      actorType: 'USER',
      actorUserId: req.user!.id,
      action: 'ai_assist.dna_section_generated',
      targetType: 'BusinessDNA',
      targetId: tenantId,
      metadataJson: {
        section,
        seedKeys: Object.entries(contextSeed)
          .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
          .map(([k]) => k),
      },
    })

    res.json({ data: { section, content } })
  } catch (err) {
    next(err)
  }
})

export default router
