// Marketing Kit routes — admin CRUD + public list (consumed by partner web).
//
// Mounted at /api. Splits into a public sub-router (no auth) and an admin
// sub-router (authenticate + requirePlatformAdmin). The public sub-router is
// declared first so the auth middleware doesn't intercept it.

import { Router, type IRouter } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import * as svc from '../services/marketing-kit.service.js'
import { translateText, generateMarketingDescription } from '../services/marketing-kit-ai.service.js'

const router: IRouter = Router()

// ── Public — partner web fetches this to render the kit ────────────────────
const publicRouter: IRouter = Router()
publicRouter.get('/marketing-kit/videos', async (_req, res, next) => {
  try {
    const [videos, settings] = await Promise.all([
      svc.listVideos(false),
      svc.getSettings(),
    ])
    res.json({ data: { videos, settings } })
  } catch (err) { next(err) }
})

// ── Admin — Platform Admin and above ──────────────────────────────────────
const adminRouter: IRouter = Router()
adminRouter.use(authenticate, requirePlatformAdmin)

adminRouter.get('/marketing-kit/videos', async (_req, res, next) => {
  try { res.json({ data: await svc.listVideos(true) }) } catch (err) { next(err) }
})

adminRouter.post('/marketing-kit/videos', async (req, res, next) => {
  try {
    const video = await svc.createVideo(req.body as svc.CreateInput, req.user!.id)
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

// Multipart upload — single 'file' field, video MIME, 100 MB cap.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      cb(new Error('file must be a video') as never)
      return
    }
    cb(null, true)
  },
})
adminRouter.post('/marketing-kit/videos/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'file required (multipart field name: "file")' }] }); return }
    const updated = await svc.uploadVideoFile(req.params['id']!, req.file.buffer, req.file.mimetype)
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// Combined create + upload — the admin UI's only "new video" entry point.
// Multipart body: 'file' (the MP4) + metadata fields. Two acceptable shapes:
//   A. Single-language (UI default): primaryLang + title + description. The
//      server translates to the other language to satisfy the bilingual rule.
//   B. Bilingual: titleEn + titleEs + descriptionEn + descriptionEs. No
//      translation step; persisted as-is.
// durationSec + aspectRatio come from the client's HTMLVideoElement metadata
// read before submit (the api container has no ffprobe).
adminRouter.post('/marketing-kit/videos/with-file', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ errors: [{ code: 'BAD_REQUEST', message: 'file required' }] }); return }
    const body = req.body as Record<string, string>
    const intent       = body['intent'] as svc.Intent
    const aspectRatio  = (body['aspectRatio'] as svc.Aspect) || 'horizontal'
    const durationSec  = parseInt(body['durationSec'] ?? '0', 10) || 0
    const visible      = body['visible'] === 'false' ? false : true

    let titleEn = body['titleEn'] ?? ''
    let titleEs = body['titleEs'] ?? ''
    let descriptionEn = body['descriptionEn'] ?? ''
    let descriptionEs = body['descriptionEs'] ?? ''

    const primaryLang = body['primaryLang'] as 'en' | 'es' | undefined
    if (primaryLang === 'en' || primaryLang === 'es') {
      const title       = body['title'] ?? ''
      const description = body['description'] ?? ''
      if (!title.trim() || !description.trim()) {
        throw new (await import('@voiceautomation/shared')).AppError('VALIDATION_ERROR', 'title and description are required', 422)
      }
      const [otherTitle, otherDesc] = await Promise.all([
        translateText(title, primaryLang),
        translateText(description, primaryLang),
      ])
      if (primaryLang === 'en') { titleEn = title; descriptionEn = description; titleEs = otherTitle; descriptionEs = otherDesc }
      else                      { titleEs = title; descriptionEs = description; titleEn = otherTitle; descriptionEn = otherDesc }
    }

    const data: svc.CreateInput = { intent, titleEn, titleEs, descriptionEn, descriptionEs, aspectRatio, durationSec, visible }
    const created = await svc.createVideoWithFile(data, req.file.buffer, req.file.mimetype, req.user!.id)
    res.status(201).json({ data: created })
  } catch (err) { next(err) }
})

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
