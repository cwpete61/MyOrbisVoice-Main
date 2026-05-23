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

export const VALID_INTENTS = ['pitch-product', 'recruit-partners', 'how-to-sell', 'social-cuts'] as const
export type Intent = typeof VALID_INTENTS[number]
export const VALID_ASPECT = ['horizontal', 'vertical'] as const
export type Aspect = typeof VALID_ASPECT[number]

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
  return !!row
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
}
function validateCreate(d: CreateInput) {
  if (!VALID_INTENTS.includes(d.intent)) throw new AppError('VALIDATION_ERROR', `intent must be one of: ${VALID_INTENTS.join(', ')}`, 422)
  if (!d.titleEn?.trim() || !d.titleEs?.trim()) throw new AppError('VALIDATION_ERROR', 'Both English and Spanish titles are required', 422)
  if (!d.descriptionEn?.trim() || !d.descriptionEs?.trim()) throw new AppError('VALIDATION_ERROR', 'Both English and Spanish descriptions are required', 422)
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
  // Best-effort delete of the Bunny object; tolerate failures so a broken
  // upstream doesn't strand the DB row.
  if (existing.filename) {
    try { await deleteBunnyObject(existing.filename) } catch (e) {
      console.error('[marketing-kit] bunny delete failed:', existing.filename, e)
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

export async function uploadVideoFile(id: string, buffer: Buffer, mime: string) {
  const row = await getVideo(id)
  if (!mime.startsWith('video/')) throw new AppError('VALIDATION_ERROR', 'file must be a video', 422)
  const config = await getBunnyConfig()
  if (!config) throw new AppError('STORAGE_UNAVAILABLE', 'Storage is not configured', 503)

  // Tie the filename to the row id so the bunny path is unambiguous and a
  // re-upload safely overwrites. Keep the existing filename if the row was
  // seeded with a legacy name (so partner deep-links stay working).
  const filename = row.filename ?? `${row.id}.mp4`
  const path = `marketing-kit/${filename}`
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`
  const res  = await fetch(url, {
    method:  'PUT',
    headers: { AccessKey: config.storagePassword, 'Content-Type': 'video/mp4' },
    body:    buffer,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('UPSTREAM_ERROR', `Bunny upload failed: ${res.status} ${text.slice(0, 200)}`, 502)
  }

  return prisma.marketingKitVideo.update({
    where: { id: row.id },
    data:  { filename, comingSoon: false },
  })
}

// Combined create + upload — one round-trip the admin UI uses as its only
// new-video path. The client supplies durationSec + aspectRatio (read from
// HTMLVideoElement before submitting) so the server doesn't need ffprobe.
// Bilingual + intent validation reuses validateCreate(). The row is created
// first, then the file is PUT to Bunny at marketing-kit/<row-id>.mp4. If the
// upload fails the row is rolled back so we never leave an orphan placeholder.
export async function createVideoWithFile(
  data: CreateInput,
  fileBuffer: Buffer,
  mime: string,
  userId?: string,
) {
  validateCreate(data)
  if (!mime.startsWith('video/')) throw new AppError('VALIDATION_ERROR', 'file must be a video', 422)
  const config = await getBunnyConfig()
  if (!config) throw new AppError('STORAGE_UNAVAILABLE', 'Storage is not configured', 503)

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
      createdById:   userId,
    },
  })

  const filename = `${created.id}.mp4`
  const url = `https://${storageHostForRegion(config.storageRegion)}/${config.storageZone}/marketing-kit/${filename}`
  try {
    const res = await fetch(url, {
      method:  'PUT',
      headers: { AccessKey: config.storagePassword, 'Content-Type': 'video/mp4' },
      body:    fileBuffer,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AppError('UPSTREAM_ERROR', `Bunny upload failed: ${res.status} ${text.slice(0, 200)}`, 502)
    }
  } catch (err) {
    // Roll back the orphan DB row if the file never made it to Bunny.
    await prisma.marketingKitVideo.delete({ where: { id: created.id } }).catch(() => undefined)
    throw err
  }

  return prisma.marketingKitVideo.update({
    where: { id: created.id },
    data:  { filename },
  })
}

async function deleteBunnyObject(filename: string) {
  const config = await getBunnyConfig()
  if (!config) return
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/marketing-kit/${filename}`
  await fetch(url, { method: 'DELETE', headers: { AccessKey: config.storagePassword } })
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
