// Marketing Kit — admin-managed partner-facing video library.
//
// Persists what was previously a hardcoded VIDEOS array in the partner web
// page, so platform admins can upload + edit + delete videos without a code
// deploy. The asset proxy (apps/api/src/routes/marketing-assets.ts) reads the
// list of allowed filenames from this service at request time, replacing the
// old hardcoded whitelist.

import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { getBunnyConfig, storageHostForRegion } from './bunny.service.js'

export const VALID_INTENTS = [
  'pitch-product', 'recruit-partners', 'how-to-sell', 'social-cuts',
  // Phase B (Social Content Engine) tabs:
  'social-posts', 'reels-shorts-tiktok', 'audio', 'youtube-longform',
] as const
export type Intent = typeof VALID_INTENTS[number]
export const VALID_ASPECT = ['horizontal', 'vertical'] as const
export type Aspect = typeof VALID_ASPECT[number]
export const VALID_MEDIA_TYPES = ['video', 'image', 'audio', 'carousel'] as const
export type MediaType = typeof VALID_MEDIA_TYPES[number]

// Map a MIME to a Bunny-storage file extension. Falls back to .bin so an
// unrecognized type never crashes — admin can still upload, just be cautious.
const MIME_EXT: Record<string, string> = {
  'video/mp4':       'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'image/png':       'png', 'image/jpeg': 'jpg',  'image/jpg':       'jpg',
  'image/webp':      'webp', 'image/gif': 'gif',
  'audio/mpeg':      'mp3', 'audio/mp3':  'mp3', 'audio/wav':       'wav',
  'audio/x-wav':     'wav', 'audio/ogg':  'ogg', 'audio/aac':       'aac',
}
export function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') ?? 'bin'
}

// Infer the MediaType from a MIME. Used when a route handler only has the
// file in its hands and needs to set the row's `mediaType` consistently.
export function mediaTypeFromMime(mime: string): MediaType {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  throw new AppError('VALIDATION_ERROR', `Unsupported media type: ${mime}`, 422)
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function listVideos(adminMode = false) {
  return prisma.marketingKitVideo.findMany({
    where: adminMode ? {} : { visible: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function getVideo(id: string) {
  const v = await prisma.marketingKitVideo.findUnique({ where: { id } })
  if (!v) throw new AppError('NOT_FOUND', 'Video not found', 404)
  return v
}

// The asset proxy calls this for every public-asset request. A row with the
// given filename = serveable. (We don't gate on `visible` here — a partner who
// already saw a link should still be able to play. Admin can DELETE the row to
// hard-revoke access.)
export async function isPublishableFilename(filename: string) {
  const row = await prisma.marketingKitVideo.findUnique({ where: { filename }, select: { id: true } })
  if (row) return true
  // Carousel slides aren't in `filename` (only the cover is) — check the
  // secondaryFilenames array via a raw filter.
  const slide = await prisma.marketingKitVideo.findFirst({
    where: { secondaryFilenames: { has: filename } },
    select: { id: true },
  })
  return !!slide
}

// Returns the row's stored mimeType so the asset proxy can serve the right
// Content-Type when Bunny doesn't return one. Checks the cover filename and
// every carousel-slide filename.
export async function getMimeForFilename(filename: string): Promise<string | null> {
  const row = await prisma.marketingKitVideo.findUnique({ where: { filename }, select: { mimeType: true } })
  if (row?.mimeType) return row.mimeType
  const slide = await prisma.marketingKitVideo.findFirst({
    where: { secondaryFilenames: { has: filename } },
    select: { mimeType: true },
  })
  return slide?.mimeType ?? null
}

// ── Write — metadata ────────────────────────────────────────────────────────

export interface CreateInput {
  intent:        Intent
  titleEn:       string
  titleEs:       string
  descriptionEn: string
  descriptionEs: string
  aspectRatio?:  Aspect
  durationSec?:  number
  comingSoon?:   boolean
  visible?:      boolean
  sortOrder?:    number
  mediaType?:    MediaType
  track?:        string
}
function validateCreate(d: CreateInput) {
  if (!VALID_INTENTS.includes(d.intent)) throw new AppError('VALIDATION_ERROR', `intent must be one of: ${VALID_INTENTS.join(', ')}`, 422)
  // Each video lives in ONE language by default — admin types copy in either
  // English or Spanish, not both. The partner page filters by locale, so a
  // row only appears for partners reading in its language. To satisfy that,
  // the row must carry a complete title+description pair on at least ONE
  // side. Both sides filled is also valid (legacy rows / dual-target).
  const hasEn = !!d.titleEn?.trim() && !!d.descriptionEn?.trim()
  const hasEs = !!d.titleEs?.trim() && !!d.descriptionEs?.trim()
  if (!hasEn && !hasEs) {
    throw new AppError('VALIDATION_ERROR', 'A title + description in at least one language is required', 422)
  }
  if (d.aspectRatio && !VALID_ASPECT.includes(d.aspectRatio)) throw new AppError('VALIDATION_ERROR', 'aspectRatio must be horizontal or vertical', 422)
}

export async function createVideo(data: CreateInput, userId?: string) {
  validateCreate(data)
  // Slot the new row at the end of its intent group by default.
  const last = await prisma.marketingKitVideo.findFirst({
    where: { intent: data.intent },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return prisma.marketingKitVideo.create({
    data: {
      intent:        data.intent,
      titleEn:       data.titleEn.trim(),
      titleEs:       data.titleEs.trim(),
      descriptionEn: data.descriptionEn.trim(),
      descriptionEs: data.descriptionEs.trim(),
      aspectRatio:   data.aspectRatio ?? 'horizontal',
      durationSec:   data.durationSec ?? 0,
      comingSoon:    data.comingSoon ?? true, // no file yet by default
      visible:       data.visible ?? true,
      sortOrder:     data.sortOrder ?? ((last?.sortOrder ?? 0) + 10),
      mediaType:     data.mediaType ?? 'video',
      track:         data.track ?? null,
      createdById:   userId,
    },
  })
}

export interface PatchInput {
  intent?:        Intent
  titleEn?:       string
  titleEs?:       string
  descriptionEn?: string
  descriptionEs?: string
  aspectRatio?:   Aspect
  durationSec?:   number
  comingSoon?:    boolean
  visible?:       boolean
  sortOrder?:     number
}
export async function patchVideo(id: string, patch: PatchInput) {
  const existing = await getVideo(id)
  if (patch.intent && !VALID_INTENTS.includes(patch.intent)) throw new AppError('VALIDATION_ERROR', 'invalid intent', 422)
  if (patch.aspectRatio && !VALID_ASPECT.includes(patch.aspectRatio)) throw new AppError('VALIDATION_ERROR', 'invalid aspectRatio', 422)
  // Trim string fields when present; reject empty bilingual values.
  const data: Record<string, unknown> = {}
  for (const k of ['titleEn', 'titleEs', 'descriptionEn', 'descriptionEs'] as const) {
    if (patch[k] !== undefined) {
      const v = patch[k]!.trim()
      if (!v) throw new AppError('VALIDATION_ERROR', `${k} cannot be empty`, 422)
      data[k] = v
    }
  }
  for (const k of ['intent', 'aspectRatio', 'durationSec', 'comingSoon', 'visible', 'sortOrder'] as const) {
    if (patch[k] !== undefined) data[k] = patch[k]
  }
  return prisma.marketingKitVideo.update({ where: { id: existing.id }, data })
}

export async function deleteVideo(id: string) {
  const existing = await getVideo(id)
  // Best-effort delete of every Bunny object (cover + carousel slides);
  // tolerate failures so a broken upstream doesn't strand the DB row.
  const toRemove = [existing.filename, ...(existing.secondaryFilenames ?? [])].filter(Boolean) as string[]
  for (const f of toRemove) {
    try { await deleteBunnyObject(f) } catch (e) {
      console.error('[marketing-kit] bunny delete failed:', f, e)
    }
  }
  await prisma.marketingKitVideo.delete({ where: { id: existing.id } })
}

export async function reorderVideos(orderedIds: string[]) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'order array required', 422)
  }
  // Re-stamp sortOrder in 10-step increments so future single-row edits have
  // room to slot in without renumbering everything.
  await prisma.$transaction(orderedIds.map((id, i) =>
    prisma.marketingKitVideo.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } }),
  ))
}

// ── File upload (Bunny PUT) ─────────────────────────────────────────────────

// Low-level: PUT a single buffer to Bunny at marketing-kit/<basename>. Used
// by every upload helper below.
async function putBunny(buffer: Buffer, basename: string, mime: string) {
  const config = await getBunnyConfig()
  if (!config) throw new AppError('STORAGE_UNAVAILABLE', 'Storage is not configured', 503)
  const url = `https://${storageHostForRegion(config.storageRegion)}/${config.storageZone}/marketing-kit/${basename}`
  const res = await fetch(url, {
    method:  'PUT',
    headers: { AccessKey: config.storagePassword, 'Content-Type': mime },
    body:    buffer,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPSTREAM_ERROR', `Bunny upload failed: ${res.status} ${text.slice(0, 200)}`, 502)
  }
}

// Replace / set the cover file on an existing row. Works for ANY media type
// (video / image / audio); the mediaType + mimeType on the row are updated
// to match the new file. Carousels use uploadCarouselFiles instead.
export async function uploadAssetFile(id: string, buffer: Buffer, mime: string) {
  const row = await getVideo(id)
  const mediaType = mediaTypeFromMime(mime)
  // Preserve the existing filename if there is one (deep-link stability);
  // otherwise generate <row.id>.<ext>.
  const filename = row.filename ?? `${row.id}.${extFromMime(mime)}`
  await putBunny(buffer, filename, mime)
  return prisma.marketingKitVideo.update({
    where: { id: row.id },
    data:  { filename, mimeType: mime, mediaType, comingSoon: false },
  })
}

// Back-compat alias — the admin "Replace" button still hits the old route
// name; preserve the old function so importers don't break.
export const uploadVideoFile = uploadAssetFile

// Carousel: N images uploaded in one go. First image becomes the cover
// (`filename`), rest land in `secondaryFilenames`. Bunny paths use the row
// id + a 1-based slide index so re-uploads overwrite predictably.
export async function uploadCarouselFiles(
  id: string,
  files: { buffer: Buffer; mime: string }[],
) {
  if (files.length < 2) throw new AppError('VALIDATION_ERROR', 'carousel requires 2 or more files', 422)
  if (files.length > 10) throw new AppError('VALIDATION_ERROR', 'carousel max is 10 slides', 422)
  const row = await getVideo(id)
  // Every slide must be an image.
  for (const f of files) {
    if (!f.mime.startsWith('image/')) throw new AppError('VALIDATION_ERROR', 'carousel slides must all be images', 422)
  }
  const cover = `${row.id}-1.${extFromMime(files[0]!.mime)}`
  await putBunny(files[0]!.buffer, cover, files[0]!.mime)
  const rest: string[] = []
  for (let i = 1; i < files.length; i++) {
    const name = `${row.id}-${i + 1}.${extFromMime(files[i]!.mime)}`
    await putBunny(files[i]!.buffer, name, files[i]!.mime)
    rest.push(name)
  }
  return prisma.marketingKitVideo.update({
    where: { id: row.id },
    data:  {
      filename:           cover,
      secondaryFilenames: rest,
      mimeType:           files[0]!.mime,
      mediaType:          'carousel',
      comingSoon:         false,
    },
  })
}

// Combined create + upload — single round-trip the admin UI uses as its only
// new-asset path for single-file media (video / image / audio). Carousels
// use createCarouselWithFiles below. durationSec + aspectRatio come from the
// client (HTMLVideoElement / Image / Audio metadata read before submit). If
// the Bunny upload fails the row is rolled back so no orphan placeholder is
// left behind.
export async function createVideoWithFile(
  data: CreateInput,
  fileBuffer: Buffer,
  mime: string,
  userId?: string,
) {
  validateCreate(data)
  const mediaType = data.mediaType ?? mediaTypeFromMime(mime)

  const last = await prisma.marketingKitVideo.findFirst({
    where: { intent: data.intent },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const created = await prisma.marketingKitVideo.create({
    data: {
      intent:        data.intent,
      titleEn:       data.titleEn.trim(),
      titleEs:       data.titleEs.trim(),
      descriptionEn: data.descriptionEn.trim(),
      descriptionEs: data.descriptionEs.trim(),
      aspectRatio:   data.aspectRatio ?? 'horizontal',
      durationSec:   data.durationSec ?? 0,
      comingSoon:    false,
      visible:       data.visible ?? true,
      sortOrder:     data.sortOrder ?? ((last?.sortOrder ?? 0) + 10),
      mediaType,
      mimeType:      mime,
      track:         data.track ?? null,
      createdById:   userId,
    },
  })

  const filename = `${created.id}.${extFromMime(mime)}`
  try {
    await putBunny(fileBuffer, filename, mime)
  } catch (err) {
    await prisma.marketingKitVideo.delete({ where: { id: created.id } }).catch(() => undefined)
    throw err
  }
  return prisma.marketingKitVideo.update({ where: { id: created.id }, data: { filename } })
}

// Combined create + carousel upload — single round-trip. files[0] becomes
// the cover (`filename`); slides 2..N go into `secondaryFilenames`. Each
// slide must be an image; min 2, max 10. Rolls back the row if any PUT fails.
export async function createCarouselWithFiles(
  data: CreateInput,
  files: { buffer: Buffer; mime: string }[],
  userId?: string,
) {
  validateCreate(data)
  if (files.length < 2)  throw new AppError('VALIDATION_ERROR', 'carousel requires 2 or more slides', 422)
  if (files.length > 10) throw new AppError('VALIDATION_ERROR', 'carousel max is 10 slides', 422)
  for (const f of files) {
    if (!f.mime.startsWith('image/')) throw new AppError('VALIDATION_ERROR', 'carousel slides must all be images', 422)
  }
  const last = await prisma.marketingKitVideo.findFirst({
    where: { intent: data.intent },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const created = await prisma.marketingKitVideo.create({
    data: {
      intent:        data.intent,
      titleEn:       data.titleEn.trim(),
      titleEs:       data.titleEs.trim(),
      descriptionEn: data.descriptionEn.trim(),
      descriptionEs: data.descriptionEs.trim(),
      aspectRatio:   data.aspectRatio ?? 'horizontal',
      durationSec:   0,
      comingSoon:    false,
      visible:       data.visible ?? true,
      sortOrder:     data.sortOrder ?? ((last?.sortOrder ?? 0) + 10),
      mediaType:     'carousel',
      mimeType:      files[0]!.mime,
      track:         data.track ?? null,
      createdById:   userId,
    },
  })
  try {
    const cover = `${created.id}-1.${extFromMime(files[0]!.mime)}`
    await putBunny(files[0]!.buffer, cover, files[0]!.mime)
    const rest: string[] = []
    for (let i = 1; i < files.length; i++) {
      const name = `${created.id}-${i + 1}.${extFromMime(files[i]!.mime)}`
      await putBunny(files[i]!.buffer, name, files[i]!.mime)
      rest.push(name)
    }
    return prisma.marketingKitVideo.update({
      where: { id: created.id },
      data:  { filename: cover, secondaryFilenames: rest },
    })
  } catch (err) {
    await prisma.marketingKitVideo.delete({ where: { id: created.id } }).catch(() => undefined)
    throw err
  }
}

async function deleteBunnyObject(filename: string) {
  const config = await getBunnyConfig()
  if (!config) return
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/marketing-kit/${filename}`
  await fetch(url, { method: 'DELETE', headers: { AccessKey: config.storagePassword } })
}

// ── Generate post: AI copy + AI image + Remotion render → Bunny → DB row ───
//
// One-shot orchestrator the admin "✨ Generate" button calls. Steps:
//   1. Resolve angle from key (or use raw brief).
//   2. OpenAI gpt-4o-mini → SocialPostPayload (title, description, 4 caption
//      variants, imagePrompt).
//   3. OpenAI gpt-image-1 → background PNG bytes.
//   4. Render service POST /still with the AI bg passed as a data: URL prop
//      → composited final PNG (text on top of photo).
//   5. PUT final PNG to Bunny under marketing-kit/<row-id>.png.
//   6. Insert MarketingKitVideo row with filename + captionsJson populated.

import { generateSocialPost, generateAiImage, type SocialPostPayload } from './marketing-kit-ai.service.js'
import { findAngle, ANGLES, type SocialAngle, type CompositionId } from './social-angles.js'
import { renderStill, renderVideo } from './render.client.js'

export { ANGLES } from './social-angles.js'
export type { CompositionId } from './social-angles.js'

// Which compositions take an AI photographic background. Everything else is
// pure typography / animation and skips the gpt-image-1 step (saves $0.07 +
// ~5s per generation).
const NEEDS_AI_BG: CompositionId[] = ['Social-Imagery']
// Which compositions are videos (use renderVideo + image/png → video/mp4 row).
const IS_VIDEO: CompositionId[] = ['Social-Reel', 'Hook-Reel', 'Partner-LongForm']
// Default aspect ratio per composition (used to populate the DB row's
// aspectRatio so the partner card picks the right thumbnail frame).
const ASPECT_BY_COMP: Record<CompositionId, Aspect> = {
  'Social-Static':    'horizontal', // 1:1 — we treat square as horizontal for layout
  'Social-Imagery':   'vertical',   // 4:5 portrait
  'Social-Reel':      'vertical',   // 9:16
  'Stat-Card':        'horizontal', // 1:1
  'Hook-Card':        'horizontal', // 1:1
  'Quote-Card':       'vertical',   // 4:5
  'Comparison-Card':  'horizontal', // 1:1
  'Value-Pillars':    'vertical',   // 4:5
  'Hook-Reel':        'vertical',   // 9:16
  'Partner-LongForm': 'horizontal', // 16:9
}

// Map the AI payload onto each composition's prop shape. Every composition
// silently falls back to its own default for props it doesn't get.
function propsForComposition(comp: CompositionId, payload: SocialPostPayload, bgDataUrl?: string): Record<string, unknown> {
  const cta = 'myorbisvoice.com'
  switch (comp) {
    case 'Social-Imagery':
      return { bgUrl: bgDataUrl, kicker: payload.title.toUpperCase().slice(0, 60), title: payload.title, sub: payload.description, cta }
    case 'Social-Static':
      return {}
    case 'Stat-Card':
      // Description as supporting body; title used as the kicker. The AI is
      // told to put the stat itself in the title field for this composition.
      return { kicker: payload.title.toUpperCase().slice(0, 40), stat: payload.title, unit: '', body: payload.description, cta }
    case 'Hook-Card':
      return { kicker: payload.title.toUpperCase().slice(0, 40), hook: payload.description.split('.')[0] ?? payload.description, sub: payload.description, cta }
    case 'Quote-Card':
      return { quote: `"${payload.description}"`, author: payload.title, role: 'MyOrbisVoice', cta }
    case 'Comparison-Card':
      // Compare card needs structured bullets; the simple AI payload doesn't
      // produce them yet so we fall back to defaults baked into the comp.
      return { title: payload.title, cta }
    case 'Value-Pillars':
      return { kicker: payload.title.toUpperCase().slice(0, 40), title: payload.title, cta }
    case 'Social-Reel':
      return {}
    case 'Hook-Reel':
      return { kicker: payload.title.toUpperCase().slice(0, 40), hook: payload.title, ctaHeadline: payload.description.split('.')[0] ?? "Let's talk.", ctaSub: payload.description, ctaUrl: cta }
    case 'Partner-LongForm':
      return { topic: payload.title.toUpperCase().slice(0, 50), hookLine: payload.title, ctaHeadline: "Let's talk.", ctaUrl: cta }
  }
}

export interface GenerateInput {
  // EITHER angleKey (curated) OR brief (free prompt). At least one required.
  angleKey?:    string
  brief?:       string
  // Required. Tab the new row lands in.
  intent:       Intent
  // Required. Single-language model — partner sees this only in this locale.
  lang:         'en' | 'es'
  // Optional override of the angle's default composition.
  composition?: CompositionId
  visible?:     boolean
}

export async function generatePostAndRender(input: GenerateInput, userId?: string) {
  if (!input.angleKey && !input.brief?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'angleKey or brief is required', 422)
  }
  let angle: SocialAngle | undefined
  let brief: string
  let composition: CompositionId
  let imageStyle: string | undefined
  if (input.angleKey) {
    angle = findAngle(input.angleKey)
    if (!angle) throw new AppError('NOT_FOUND', `Unknown angle: ${input.angleKey}`, 404)
    brief = input.lang === 'es' ? angle.briefEs : angle.briefEn
    composition = input.composition ?? angle.composition
    imageStyle = angle.imageStyle
  } else {
    brief = input.brief!.trim()
    composition = input.composition ?? 'Social-Imagery'
  }

  // 1. AI copy + caption variants + image prompt
  const payload: SocialPostPayload = await generateSocialPost({
    brief, intent: input.intent, lang: input.lang, imageStyle, freeMode: !input.angleKey,
  })

  // 2. AI background only for compositions that consume one. Saves ~$0.07
  //    + ~5s per generation when the composition is text-only.
  let bgDataUrl: string | undefined
  if (NEEDS_AI_BG.includes(composition)) {
    const img = await generateAiImage({ prompt: payload.imagePrompt, size: '1024x1536', quality: 'high' })
    bgDataUrl = `data:${img.mime};base64,${img.bytes.toString('base64')}`
  }

  // 3. Render via the dedicated render service. Video comps render to MP4;
  //    everything else renders to PNG.
  const props = propsForComposition(composition, payload, bgDataUrl)
  const isVideo  = IS_VIDEO.includes(composition)
  const finalBuf = isVideo
    ? await renderVideo({ compositionId: composition, props })
    : await renderStill({ compositionId: composition, props })
  const ext  = isVideo ? 'mp4' : 'png'
  const mime = isVideo ? 'video/mp4' : 'image/png'

  // 4. Create row + upload (mirrors createVideoWithFile's rollback semantics)
  validateCreate({
    intent: input.intent,
    titleEn: input.lang === 'en' ? payload.title       : '',
    titleEs: input.lang === 'es' ? payload.title       : '',
    descriptionEn: input.lang === 'en' ? payload.description : '',
    descriptionEs: input.lang === 'es' ? payload.description : '',
  })
  const last = await prisma.marketingKitVideo.findFirst({
    where: { intent: input.intent }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true },
  })
  const created = await prisma.marketingKitVideo.create({
    data: {
      intent:        input.intent,
      titleEn:       input.lang === 'en' ? payload.title       : '',
      titleEs:       input.lang === 'es' ? payload.title       : '',
      descriptionEn: input.lang === 'en' ? payload.description : '',
      descriptionEs: input.lang === 'es' ? payload.description : '',
      aspectRatio:   ASPECT_BY_COMP[composition],
      durationSec:   0,
      comingSoon:    false,
      visible:       input.visible ?? true,
      sortOrder:     (last?.sortOrder ?? 0) + 10,
      mediaType:     isVideo ? 'video' : 'image',
      mimeType:      mime,
      captionsJson:  payload.captions as unknown as object,
      createdById:   userId,
    },
  })
  try {
    const filename = `${created.id}.${ext}`
    await putBunny(finalBuf, filename, mime)
    return prisma.marketingKitVideo.update({ where: { id: created.id }, data: { filename } })
  } catch (err) {
    await prisma.marketingKitVideo.delete({ where: { id: created.id } }).catch(() => undefined)
    throw err
  }
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getSettings() {
  return prisma.marketingKitSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
}

export interface SettingsPatch {
  columnsDesktop?: number
  columnsTablet?:  number
  columnsMobile?:  number
  defaultSort?:    string
  defaultTab?:     string
  hiddenTabs?:     string[]
}
export async function updateSettings(patch: SettingsPatch) {
  const data: Record<string, unknown> = {}
  for (const k of ['columnsDesktop', 'columnsTablet', 'columnsMobile'] as const) {
    if (patch[k] !== undefined) {
      const n = Number(patch[k])
      if (!Number.isFinite(n) || n < 1 || n > 6) throw new AppError('VALIDATION_ERROR', `${k} must be 1-6`, 422)
      data[k] = Math.round(n)
    }
  }
  if (patch.defaultSort !== undefined) {
    if (!['manual', 'newest', 'duration'].includes(patch.defaultSort)) throw new AppError('VALIDATION_ERROR', 'defaultSort must be manual|newest|duration', 422)
    data['defaultSort'] = patch.defaultSort
  }
  if (patch.defaultTab !== undefined) {
    const ok = ['all', ...VALID_INTENTS].includes(patch.defaultTab as never)
    if (!ok) throw new AppError('VALIDATION_ERROR', 'defaultTab must be all or a known intent', 422)
    data['defaultTab'] = patch.defaultTab
  }
  if (patch.hiddenTabs !== undefined) {
    if (!Array.isArray(patch.hiddenTabs)) throw new AppError('VALIDATION_ERROR', 'hiddenTabs must be an array', 422)
    const bad = patch.hiddenTabs.filter(t => !VALID_INTENTS.includes(t as never))
    if (bad.length) throw new AppError('VALIDATION_ERROR', `hiddenTabs contains unknown intent(s): ${bad.join(', ')}`, 422)
    // De-dupe defensively; order doesn't matter for set semantics.
    data['hiddenTabs'] = Array.from(new Set(patch.hiddenTabs))
  }
  return prisma.marketingKitSettings.upsert({
    where:  { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
}

// ── Seed on first boot ───────────────────────────────────────────────────────
//
// Migrates the previously hardcoded VIDEOS array into the DB on first run so
// the partner page sees an identical list the moment the DB-driven path
// goes live. Re-runs are no-ops (count > 0). Titles and descriptions are
// the strings the partner page used to read from the i18n dictionaries.

const SEED: Array<Omit<CreateInput, never> & { filename?: string; sortOrder: number }> = [
  { intent: 'recruit-partners', sortOrder: 10, comingSoon: false, durationSec: 65, aspectRatio: 'horizontal',
    filename: 'partner-recruiting-en.mp4',
    titleEn: 'Become a Partner',
    titleEs: 'Conviértete en Partner',
    descriptionEn: 'Pitches the partner program: 30% recurring, marketing kit included, you share the link, we do the rest.',
    descriptionEs: 'Presenta el programa de partners: 30% recurrente, kit de marketing incluido, tú compartes el enlace, nosotros hacemos el resto.',
  },
  { intent: 'pitch-product', sortOrder: 100, comingSoon: true, durationSec: 45, aspectRatio: 'horizontal',
    titleEn: 'Dental Practice Demo',
    titleEs: 'Demo para clínicas dentales',
    descriptionEn: 'Shows the agent answering after-hours dental calls — booking cleanings, handling new-patient questions, taking insurance info.',
    descriptionEs: 'Muestra al agente contestando llamadas dentales fuera de horario — agendando limpiezas, respondiendo preguntas de pacientes nuevos y tomando datos del seguro.',
  },
  { intent: 'pitch-product', sortOrder: 110, comingSoon: true, durationSec: 45, aspectRatio: 'horizontal',
    titleEn: 'Law Firm Demo',
    titleEs: 'Demo para bufetes de abogados',
    descriptionEn: 'Intake calls handled correctly — qualifying lead types, scheduling consults, capturing deadline-sensitive matters.',
    descriptionEs: 'Llamadas de captación manejadas correctamente — calificando tipos de casos, agendando consultas y registrando asuntos urgentes.',
  },
  { intent: 'pitch-product', sortOrder: 120, comingSoon: true, durationSec: 45, aspectRatio: 'horizontal',
    titleEn: 'Home Services Demo',
    titleEs: 'Demo para servicios para el hogar',
    descriptionEn: 'HVAC, plumbing, electrical — the agent dispatches urgent requests, books estimates, handles service-area filtering.',
    descriptionEs: 'HVAC, plomería, electricidad — el agente despacha solicitudes urgentes, agenda estimaciones y filtra el área de servicio.',
  },
  { intent: 'pitch-product', sortOrder: 130, comingSoon: true, durationSec: 45, aspectRatio: 'horizontal',
    titleEn: 'Fitness / Gym Demo',
    titleEs: 'Demo para gimnasios y fitness',
    descriptionEn: 'Class bookings, free-trial scheduling, membership inquiries — handled while staff are on the floor.',
    descriptionEs: 'Reservas de clases, agendar pruebas gratis y consultas de membresía — gestionadas mientras tu equipo está en la sala.',
  },
  { intent: 'pitch-product', sortOrder: 140, comingSoon: true, durationSec: 45, aspectRatio: 'horizontal',
    titleEn: 'Salon / Spa Demo',
    titleEs: 'Demo para salones y spas',
    descriptionEn: 'Service-specific bookings, stylist preferences, gift-card sales — the agent talks through pricing and availability.',
    descriptionEs: 'Reservas por servicio, preferencias de estilista y venta de gift cards — el agente explica precios y disponibilidad.',
  },
  { intent: 'how-to-sell', sortOrder: 200, comingSoon: true, durationSec: 150, aspectRatio: 'horizontal',
    titleEn: 'How to Sell MyOrbisVoice',
    titleEs: 'Cómo vender MyOrbisVoice',
    descriptionEn: 'Walks through the full kit: which video to send for which scenario, how to use the email templates, how to follow up.',
    descriptionEs: 'Recorre el kit completo: qué video enviar en cada escenario, cómo usar las plantillas de correo y cómo dar seguimiento.',
  },
  { intent: 'social-cuts', sortOrder: 300, comingSoon: false, durationSec: 18, aspectRatio: 'vertical',
    filename: 'social-cut-01-85-percent.mp4',
    titleEn: 'Hook — "85% don\'t call back"',
    titleEs: 'Gancho — "El 85% no devuelve la llamada"',
    descriptionEn: '18-sec stat-anchored opener for cold traffic. Cites Forbes / INA/Kelsey on the never-called-back rate. Lands the loss with: "Miss 5 calls today, 4 of them book your competitor."',
    descriptionEs: 'Apertura de 18 segundos anclada en estadística para tráfico frío. Cita Forbes / INA/Kelsey sobre las llamadas que nunca se devuelven. Cierra con: "Pierde 5 llamadas hoy y 4 reservan con tu competencia".',
  },
  { intent: 'social-cuts', sortOrder: 310, comingSoon: false, durationSec: 23, aspectRatio: 'vertical',
    filename: 'social-cut-02-five-minute.mp4',
    titleEn: 'Hook — "5-minute response rule"',
    titleEs: 'Gancho — "La regla de los 5 minutos"',
    descriptionEn: '23-sec urgency hook citing the Harvard Business Review / MIT study: wait 5 minutes and your conversion odds drop 80%. Voicemail isn\'t 5 minutes — it\'s hours.',
    descriptionEs: 'Gancho de urgencia de 23 segundos citando el estudio de Harvard / MIT: espera 5 minutos y tus probabilidades de conversión caen 80%. El buzón de voz no son 5 minutos — son horas.',
  },
  { intent: 'social-cuts', sortOrder: 320, comingSoon: false, durationSec: 20, aspectRatio: 'vertical',
    filename: 'social-cut-03-daily-math.mp4',
    titleEn: 'Hook — "Daily math"',
    titleEs: 'Gancho — "Las cuentas del día"',
    descriptionEn: '20-sec ROI breakdown: 5 missed calls × $210 = $17,100/month, $110,000/year walking to your competitor. Naked numbers, no fluff.',
    descriptionEs: 'Desglose de ROI de 20 segundos: 5 llamadas perdidas × $210 = $17.100/mes, $110.000/año caminando a tu competencia. Números crudos, sin relleno.',
  },
]

export async function ensureSeed() {
  const count = await prisma.marketingKitVideo.count()
  if (count > 0) return { seededVideos: 0 }
  for (const row of SEED) {
    await prisma.marketingKitVideo.create({
      data: {
        intent:        row.intent,
        titleEn:       row.titleEn,
        titleEs:       row.titleEs,
        descriptionEn: row.descriptionEn,
        descriptionEs: row.descriptionEs,
        aspectRatio:   row.aspectRatio ?? 'horizontal',
        durationSec:   row.durationSec ?? 0,
        comingSoon:    row.comingSoon ?? false,
        visible:       true,
        sortOrder:     row.sortOrder,
        filename:      row.filename ?? null,
      },
    })
  }
  await prisma.marketingKitSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
  return { seededVideos: SEED.length }
}
