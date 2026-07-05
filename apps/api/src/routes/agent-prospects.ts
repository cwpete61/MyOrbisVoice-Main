/**
 * MyOrbisAgents — agent prospect scorer (operator outreach tooling). Platform-admin
 * only. Paste a raw Zillow agent blob → AI extract → deterministic fit rubric →
 * ranked target with a light pipeline. Moved here from MyOrbisBiz per plan §25.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import { prisma } from '../lib/prisma.js'
import { extractProspect, scoreProspect, type ProspectFields } from '../services/prospect-scorer.service.js'
import { createAgentDemoFromProspect } from '../services/agent-demo.service.js'

const router: IRouter = Router()
router.use(authenticate, requirePlatformAdmin)

// Paste → AI extract → deterministic score. Preview only (no save).
router.post('/agent-prospects/evaluate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = String((req.body as { rawText?: string }).rawText ?? '').trim()
    if (raw.length < 10) { res.status(400).json({ error: 'Paste the agent profile text first.' }); return }
    const ex = await extractProspect(raw)
    if (!ex) { res.status(502).json({ error: 'Could not read that (OpenAI key/credit). Check System Settings → OpenAI.' }); return }
    const sc = scoreProspect(ex.fields)
    res.json({ data: { fields: ex.fields, score: sc.score, tier: sc.tier, recommendedTier: sc.recommendedTier, reasons: sc.reasons, pitchAngle: ex.pitchAngle, redFlags: ex.redFlags } })
  } catch (err) { next(err) }
})

const saveSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
  score: z.number(), tier: z.string(), recommendedTier: z.string(),
  pitchAngle: z.string().optional(), redFlags: z.string().optional(), rawText: z.string().optional(),
})

router.post('/agent-prospects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = saveSchema.parse(req.body)
    const f = b.fields as unknown as ProspectFields
    const row = await prisma.agentProspect.create({
      data: {
        name: f.name, brokerage: f.brokerage ?? null, market: f.market ?? null, email: f.email ?? null, phone: f.phone ?? null,
        salesLast12: f.salesLast12 ?? null, totalSales: f.totalSales ?? null, isTeam: !!f.isTeam, teamSize: f.teamSize ?? null,
        avgPriceUsd: f.avgPriceUsd ?? null, priceRange: f.priceRange ?? null, yearsExp: f.yearsExp ?? null, reviews: f.reviews ?? null,
        premierAgent: !!f.premierAgent, language: f.language ?? null,
        score: b.score, tier: b.tier, recommendedTier: b.recommendedTier,
        pitchAngle: b.pitchAngle || null, redFlags: b.redFlags || null, rawText: (b.rawText ?? '').slice(0, 6000), status: 'TARGET',
      },
    })
    res.json({ data: { id: row.id } })
  } catch (err) { next(err) }
})

router.get('/agent-prospects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: { items: await prisma.agentProspect.findMany({ orderBy: [{ score: 'desc' }, { createdAt: 'desc' }], take: 300 }) } })
  } catch (err) { next(err) }
})

router.patch('/agent-prospects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String((req.body as { status?: string }).status ?? '')
    if (!['TARGET', 'CONTACTED', 'DEMO', 'WON', 'LOST', 'SKIP'].includes(status)) { res.status(400).json({ error: 'bad status' }); return }
    await prisma.agentProspect.update({ where: { id: req.params.id! }, data: { status } })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

router.delete('/agent-prospects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.agentProspect.delete({ where: { id: req.params.id! } })
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// Generate a demo for a prospect. Folds into the unified AgentDemo model: builds
// a real per-agent demo tenant (Orby from the profile, no listings) and returns
// the /agent-demo/<slug> microsite URL. Idempotent. Replaces the old §17b
// shared-widget /demo/[slug] page (retired).
router.post('/agent-prospects/:id/generate-demo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createAgentDemoFromProspect(req.params.id!, req.user!.id)
    res.json({ data: result })
  } catch (err) { next(err) }
})

export default router
