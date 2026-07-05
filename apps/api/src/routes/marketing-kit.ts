// Marketing Kit routes — admin CRUD + public list (consumed by partner web).
//
// Mounted at /api. Splits into a public sub-router (no auth) and an admin
// sub-router (authenticate + requirePlatformAdmin). The public sub-router is
// declared first so the auth middleware doesn't intercept it.

import { Router, type IRouter } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as svc from '../services/marketing-kit.service.js'
import { translateText, generateMarketingDescription } from '../services/marketing-kit-ai.service.js'
import { writeAuditLogFromRequest } from '../lib/audit.js'
// translateText is exposed via /ai/translate for ad-hoc admin use; the
// with-file path no longer calls it (each video lives in one language).

// /generate runs OpenAI + gpt-image-1 + Remotion render (~10-70s each) and
// costs money per call — cap each admin at 5/min so a stuck UI loop or a
// curious admin can't accidentally rack up $5+ of OpenAI charges.
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as { user?: { id?: string } }).user?.id ?? req.ip ?? 'anon',
  message: { errors: [{ code: 'RATE_LIMITED', message: 'Generate limit: 5 per minute. Slow down.' }] },
})

const router: IRouter = Router()

// MyOrbisAgents runs on its own hosts (api./app.myorbisagents.com). Its media
// surfaces list only real-estate 'AGENTS' assets; Voice surfaces list 'VOICE'.
const brandForHost = (req: { hostname: string }): 'VOICE' | 'AGENTS' =>
  req.hostname === 'api.myorbisagents.com' ? 'AGENTS' : 'VOICE'

// ── Public — partner web fetches this to render the kit ────────────────────
const publicRouter: IRouter = Router()
publicRouter.get('/marketing-kit/videos', async (req, res, next) => {
  try {
    const [videos, settings] = await Promise.all([
      svc.listVideos(false, brandForHost(req)),
      svc.getSettings(),
    ])
    res.json({ data: { videos, settings } })
  } catch (err) { next(err) }
})

// ── Admin — Platform Admin and above ──────────────────────────────────────
const adminRouter: IRouter = Router()
adminRouter.use(authenticate, requirePlatformAdmin)

adminRouter.get('/marketing-kit/videos', async (req, res, next) => {
  try { res.json({ data: await svc.listVideos(true, brandForHost(req)) }) } catch (err) { next(err) }
})

adminRouter.post('/marketing-kit/videos', async (req, res, next) => {
  try {
    const video = await svc.createVideo({ ...(req.body as svc.CreateInput), brand: brandForHost(req) }, req.user!.id)
    res.status(201).json({ data: video })
  } catch (err) { next(err) }
})

adminRouter.patch('/marketing-kit/videos/:id', async (req, res, next) => {
  try {
    const video = await svc.patchVideo(req.params['id']!, req.body as svc.PatchInput)
    res.json({ data: video })
  } catch (err) { next(err) }
})

adminRouter.delete('/marketing-kit/videos/:id', async (req, res, next) => {
  try {
    await svc.deleteVideo(req.params['id']!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

adminRouter.post('/marketing-kit/videos/reorder', async (req, res, next) => {
  try {
    const { order } = req.body as { order?: string[] }
    await svc.reorderVideos(order ?? [])
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

// Multipart upload — 'file' field, accepts video/image/audio MIMEs, up to 10
// files per request (carousels). 100 MB per file, 300 MB total.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const m = file.mimetype.toLowerCase()
    if (m.startsWith('video/') || m.startsWith('image/') || m.startsWith('audio/')) {
      cb(null, true); return
    }
    cb(new Error(`Unsupported MIME type: ${file.mimetype}. Allowed: video/*, image/*, audio/*`) as never)
  },
})
adminRouter.post('/marketing-kit/videos/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'file required (multipart field name: "file")' }] }); return }
    const updated = await svc.uploadAssetFile(req.params['id']!, req.file.buffer, req.file.mimetype)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// Combined create + upload — the admin UI's only "new video" entry point.
// Multipart body: 'file' (the MP4) + metadata. Two acceptable shapes:
//   A. Single-language (UI default): primaryLang + title + description.
//      The other language's columns are left EMPTY by design — videos are
//      scoped to one language, no auto-translation.
//   B. Bilingual (legacy): titleEn + titleEs + descriptionEn + descriptionEs.
// durationSec + aspectRatio come from the client's HTMLVideoElement metadata.
// Accepts EITHER a single 'file' field (video/image/audio) OR a 'files' array
// (carousel, 2-10 images). The handler picks the right service call based on
// what arrived in req.files.
adminRouter.post('/marketing-kit/videos/with-file',
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 10 }]),
  async (req, res, next) => {
    try {
      const filesMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>
      const single = filesMap['file']?.[0]
      const many   = filesMap['files'] ?? []
      if (!single && many.length === 0) {
        res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'file or files required' }] }); return
      }
      const body = req.body as Record<string, string>
      const intent       = body['intent'] as svc.Intent
      const aspectRatio  = (body['aspectRatio'] as svc.Aspect) || 'horizontal'
      const durationSec  = parseInt(body['durationSec'] ?? '0', 10) || 0
      const visible      = body['visible'] === 'false' ? false : true
      const track        = body['track'] || undefined

      let titleEn = body['titleEn'] ?? ''
      let titleEs = body['titleEs'] ?? ''
      let descriptionEn = body['descriptionEn'] ?? ''
      let descriptionEs = body['descriptionEs'] ?? ''
      const primaryLang = body['primaryLang'] as 'en' | 'es' | undefined
      if (primaryLang === 'en' || primaryLang === 'es') {
        const title       = (body['title'] ?? '').trim()
        const description = (body['description'] ?? '').trim()
        if (primaryLang === 'en') { titleEn = title; descriptionEn = description; titleEs = ''; descriptionEs = '' }
        else                      { titleEs = title; descriptionEs = description; titleEn = ''; descriptionEn = '' }
      }

      const data: svc.CreateInput = { intent, titleEn, titleEs, descriptionEn, descriptionEs, aspectRatio, durationSec, visible, track, brand: brandForHost(req) }
      let created
      if (many.length >= 2) {
        created = await svc.createCarouselWithFiles(
          data,
          many.map(f => ({ buffer: f.buffer, mime: f.mimetype })),
          req.user!.id,
        )
      } else {
        const f = single ?? many[0]!
        created = await svc.createVideoWithFile(data, f.buffer, f.mimetype, req.user!.id)
      }
      res.status(201).json({ data: created })
    } catch (err) { next(err) }
  },
)

// AI helpers used by the Upload modal — generate a description from a title,
// or translate copy to the OTHER language. Both gated by Platform Admin.
adminRouter.post('/marketing-kit/ai/describe', async (req, res, next) => {
  try {
    const { title, intent, lang } = req.body as { title?: string; intent?: string; lang?: 'en' | 'es' }
    if (!title?.trim()) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'title required' }] }); return }
    const description = await generateMarketingDescription({
      title: title.trim(),
      intent: intent ?? 'pitch-product',
      lang: lang === 'es' ? 'es' : 'en',
    })
    res.json({ data: { description } })
  } catch (err) { next(err) }
})

// AI generator — "✨ Generate" button. One round-trip = copy + AI image +
// Remotion render + Bunny upload + DB row. Slow (~10-20s end-to-end).
adminRouter.get('/marketing-kit/angles', async (_req, res, next) => {
  try { res.json({ data: svc.ANGLES }) } catch (err) { next(err) }
})

adminRouter.post('/marketing-kit/generate', generateLimiter, async (req, res, next) => {
  const started = Date.now()
  const body = { ...(req.body as svc.GenerateInput), brand: brandForHost(req) }
  try {
    const row = await svc.generatePostAndRender(body, req.user!.id)
    writeAuditLogFromRequest(req, {
      actorType: 'USER', actorUserId: req.user!.id,
      action:     'marketing_kit.generate.success',
      targetType: 'MarketingKitVideo', targetId: row.id,
      metadataJson: {
        angleKey:    body.angleKey,
        composition: body.composition,
        intent:      body.intent,
        lang:        body.lang,
        freePrompt:  !body.angleKey,
        durationMs:  Date.now() - started,
      },
    }).catch(() => null)
    res.status(201).json({ data: row })
  } catch (err) {
    writeAuditLogFromRequest(req, {
      actorType: 'USER', actorUserId: req.user!.id,
      action:    'marketing_kit.generate.failure',
      targetType: 'MarketingKitVideo', targetId: 'none',
      metadataJson: {
        angleKey: body.angleKey, composition: body.composition,
        intent:   body.intent,   lang:        body.lang,
        error:    err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
        durationMs: Date.now() - started,
      },
    }).catch(() => null)
    next(err)
  }
})

adminRouter.post('/marketing-kit/ai/translate', async (req, res, next) => {
  try {
    const { text, from } = req.body as { text?: string; from?: 'en' | 'es' }
    if (!text?.trim()) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'text required' }] }); return }
    const out = await translateText(text, from === 'es' ? 'es' : 'en')
    res.json({ data: { text: out } })
  } catch (err) { next(err) }
})

adminRouter.get('/marketing-kit/settings', async (_req, res, next) => {
  try { res.json({ data: await svc.getSettings() }) } catch (err) { next(err) }
})

adminRouter.patch('/marketing-kit/settings', async (req, res, next) => {
  try { res.json({ data: await svc.updateSettings(req.body as svc.SettingsPatch) }) } catch (err) { next(err) }
})

// Public mount FIRST so its routes aren't shadowed by the admin authenticate.
router.use('/api/public', publicRouter)
router.use('/api/admin', adminRouter)

export default router
