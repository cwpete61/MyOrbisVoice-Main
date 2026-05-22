/**
 * Brand-parameterized PDF report for a GMB Evaluation. Streamed, never buffered.
 *
 * Bilingual: the partner exports `?locale=en|es`. Report strings live in
 * REPORT_STRINGS below (en + es) — the engine stays language-neutral, so this
 * is the one place the report's prose is translated. Brand context (company
 * name, contact, phone, logo) is injected by the caller → white-label ready.
 */
import PDFDocument from 'pdfkit'
import type { AuditResult, DimensionScore, GmbDimensionKey, GmbSeverity } from './gmb-audit/index.js'

type Locale = 'en' | 'es'

export interface GmbReportBrand {
  companyName: string
  contactName: string | null
  phone: string | null
  logoUrl: string | null
}

export interface GmbEvaluationPdfInput {
  evaluation: {
    businessName: string
    city: string
    website: string | null
    overallScore: number
    createdAt: Date
    result: AuditResult
  }
  brand: GmbReportBrand
  locale: Locale
}

const PRIMARY = '#1a9898'
const TEXT = '#1a1a1a'
const MUTED = '#666666'
const BORDER = '#e5e5e5'
const GOOD = '#1a9d5a'
const WARN = '#c98a00'
const CRIT = '#c0392b'
const PAGE_MARGIN = 50

function sevColor(s: GmbSeverity): string {
  return s === 'good' ? GOOD : s === 'warn' ? WARN : CRIT
}

// ── Report strings (the only place report prose is translated) ───────────────

interface Strings {
  reportTitle: string
  preparedFor: string
  evaluatedOn: string
  overallScore: string
  mapPackHeadline: (pos: number) => string
  notRanking: string
  dimensionsHeader: string
  competitorsHeader: string
  competitorReviews: (n: number) => string
  preparedBy: string
  disclaimer: string
  dimLabel: Record<GmbDimensionKey, string>
  finding: Record<GmbDimensionKey, (sev: GmbSeverity, p: Record<string, string | number>) => string>
}

const EN: Strings = {
  reportTitle: 'Google Business Profile Evaluation',
  preparedFor: 'Prepared for',
  evaluatedOn: 'Evaluated on',
  overallScore: 'Overall Score',
  mapPackHeadline: (pos) => `Ranks #${pos} in the Google Map Pack`,
  notRanking: 'Not appearing in the Google Map Pack',
  dimensionsHeader: 'What we looked at',
  competitorsHeader: 'Who is winning the Map Pack',
  competitorReviews: (n) => `${n} reviews`,
  preparedBy: 'Prepared by',
  disclaimer:
    'Based on public Google Business Profile data at the time of evaluation. Map-pack position varies by searcher location and over time.',
  dimLabel: {
    mapPack: 'Map Pack ranking',
    reviews: 'Reviews',
    completeness: 'Profile completeness',
    categories: 'Categories',
    nap: 'Name / Address / Phone',
    photos: 'Photos',
  },
  finding: {
    mapPack: (sev, p) =>
      sev === 'critical'
        ? 'Not appearing in the top map-pack results for the target search — invisible to most nearby searchers.'
        : sev === 'warn'
          ? `Ranks #${p['position']} — outside the top 3, where most clicks and calls go.`
          : `Ranks #${p['position']} in the map pack — strong local visibility.`,
    reviews: (sev, p) =>
      sev === 'good'
        ? `${p['count']} reviews at ${p['rating']}★ — ahead of the market median of ${p['marketMedian']}.`
        : `${p['count']} reviews at ${p['rating']}★ vs a market median of ${p['marketMedian']}. More reviews lift both ranking and trust.`,
    completeness: (sev, p) =>
      sev === 'good'
        ? 'Profile is complete — website, phone, and hours are all present.'
        : `Profile is missing key fields (${p['present']}/${p['total']} present). Incomplete listings rank lower and convert worse.`,
    categories: (sev, p) =>
      sev === 'good'
        ? `${p['count']} categories set — good coverage of relevant searches.`
        : p['count'] === 0
          ? 'No categories detected. Categories decide which searches the listing can appear in.'
          : `Only ${p['count']} category set. Adding relevant secondary categories captures more searches.`,
    nap: (sev) =>
      sev === 'good'
        ? 'Name, address, and phone are present and consistent.'
        : 'Address or phone is missing from the listing — hurts trust and local ranking.',
    photos: (sev) =>
      sev === 'good'
        ? 'Photos are present on the listing.'
        : 'Few or no photos detected. Fresh photos drive more views and calls.',
  },
}

const ES: Strings = {
  reportTitle: 'Evaluación del Perfil de Negocio de Google',
  preparedFor: 'Preparado para',
  evaluatedOn: 'Evaluado el',
  overallScore: 'Puntuación general',
  mapPackHeadline: (pos) => `Aparece en el puesto #${pos} del paquete de mapas de Google`,
  notRanking: 'No aparece en el paquete de mapas de Google',
  dimensionsHeader: 'Qué revisamos',
  competitorsHeader: 'Quién domina el paquete de mapas',
  competitorReviews: (n) => `${n} reseñas`,
  preparedBy: 'Preparado por',
  disclaimer:
    'Basado en datos públicos del Perfil de Negocio de Google al momento de la evaluación. La posición en el paquete de mapas varía según la ubicación del buscador y el tiempo.',
  dimLabel: {
    mapPack: 'Posición en el paquete de mapas',
    reviews: 'Reseñas',
    completeness: 'Perfil completo',
    categories: 'Categorías',
    nap: 'Nombre / Dirección / Teléfono',
    photos: 'Fotos',
  },
  finding: {
    mapPack: (sev, p) =>
      sev === 'critical'
        ? 'No aparece en los primeros resultados del paquete de mapas para la búsqueda objetivo — invisible para la mayoría de los clientes cercanos.'
        : sev === 'warn'
          ? `Aparece en el puesto #${p['position']} — fuera del top 3, donde se concentran los clics y las llamadas.`
          : `Aparece en el puesto #${p['position']} del paquete de mapas — fuerte visibilidad local.`,
    reviews: (sev, p) =>
      sev === 'good'
        ? `${p['count']} reseñas con ${p['rating']}★ — por encima de la mediana del mercado de ${p['marketMedian']}.`
        : `${p['count']} reseñas con ${p['rating']}★ frente a una mediana de mercado de ${p['marketMedian']}. Más reseñas mejoran el posicionamiento y la confianza.`,
    completeness: (sev, p) =>
      sev === 'good'
        ? 'El perfil está completo — sitio web, teléfono y horario presentes.'
        : `Al perfil le faltan campos clave (${p['present']}/${p['total']} presentes). Los perfiles incompletos posicionan peor y convierten menos.`,
    categories: (sev, p) =>
      sev === 'good'
        ? `${p['count']} categorías configuradas — buena cobertura de búsquedas relevantes.`
        : p['count'] === 0
          ? 'No se detectaron categorías. Las categorías deciden en qué búsquedas puede aparecer el perfil.'
          : `Solo ${p['count']} categoría configurada. Agregar categorías secundarias relevantes capta más búsquedas.`,
    nap: (sev) =>
      sev === 'good'
        ? 'El nombre, la dirección y el teléfono están presentes y son consistentes.'
        : 'Falta la dirección o el teléfono en el perfil — afecta la confianza y el posicionamiento local.',
    photos: (sev) =>
      sev === 'good'
        ? 'El perfil tiene fotos.'
        : 'Pocas o ninguna foto detectada. Las fotos recientes generan más vistas y llamadas.',
  },
}

const STRINGS: Record<Locale, Strings> = { en: EN, es: ES }

async function fetchLogoBytes(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
    if (!res.ok) return null
    const ct = res.headers.get('Content-Type') ?? ''
    if (ct.includes('svg')) return null // PDFKit can't render SVG
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function streamGmbEvaluationPdf(
  input: GmbEvaluationPdfInput,
  out: NodeJS.WritableStream,
): Promise<void> {
  const { evaluation, brand, locale } = input
  const s = STRINGS[locale]
  const r = evaluation.result
  const logoBytes = brand.logoUrl ? await fetchLogoBytes(brand.logoUrl) : null

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `${s.reportTitle} — ${evaluation.businessName}`,
      Author: brand.companyName,
      Subject: s.reportTitle,
    },
  })
  doc.pipe(out)

  const contentWidth = doc.page.width - PAGE_MARGIN * 2

  // ── Header ────────────────────────────────────────────────────────────────
  if (logoBytes) {
    try { doc.image(logoBytes, PAGE_MARGIN, PAGE_MARGIN, { fit: [120, 48] }) } catch { /* ignore bad image */ }
  }
  doc.fontSize(18).fillColor(PRIMARY).font('Helvetica-Bold')
    .text(brand.companyName, PAGE_MARGIN, PAGE_MARGIN + (logoBytes ? 56 : 0))
  doc.moveDown(0.2)
  doc.fontSize(15).fillColor(TEXT).font('Helvetica-Bold').text(s.reportTitle)
  doc.moveDown(0.5)

  // ── Subject ─────────────────────────────────────────────────────────────
  doc.fontSize(13).fillColor(TEXT).font('Helvetica-Bold')
    .text(`${evaluation.businessName} — ${evaluation.city}`)
  doc.fontSize(9).fillColor(MUTED).font('Helvetica')
    .text(`${s.evaluatedOn} ${evaluation.createdAt.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US')}`)
  doc.moveDown(0.8)

  // ── Overall score band ────────────────────────────────────────────────────
  const bandY = doc.y
  doc.roundedRect(PAGE_MARGIN, bandY, contentWidth, 60, 6).fill('#f4fbfb')
  doc.fillColor(PRIMARY).fontSize(36).font('Helvetica-Bold')
    .text(`${evaluation.overallScore}`, PAGE_MARGIN + 16, bandY + 10, { continued: true })
  doc.fillColor(MUTED).fontSize(14).font('Helvetica').text(' / 100')
  doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold')
    .text(s.overallScore, PAGE_MARGIN + 120, bandY + 14)
  doc.fillColor(MUTED).fontSize(10).font('Helvetica')
    .text(
      r.mapPackPosition ? s.mapPackHeadline(r.mapPackPosition) : s.notRanking,
      PAGE_MARGIN + 120, bandY + 32, { width: contentWidth - 140 },
    )
  doc.y = bandY + 72
  doc.x = PAGE_MARGIN

  // ── Dimensions ────────────────────────────────────────────────────────────
  doc.moveDown(0.4)
  doc.fontSize(12).fillColor(TEXT).font('Helvetica-Bold').text(s.dimensionsHeader)
  doc.moveDown(0.3)

  const ordered: DimensionScore[] = [...r.dimensions].sort((a, b) => b.weight - a.weight)
  for (const d of ordered) {
    if (doc.y > doc.page.height - 120) doc.addPage()
    const rowY = doc.y
    doc.circle(PAGE_MARGIN + 5, rowY + 6, 4).fill(sevColor(d.severity))
    doc.fillColor(TEXT).fontSize(10.5).font('Helvetica-Bold')
      .text(`${s.dimLabel[d.key]}`, PAGE_MARGIN + 18, rowY, { continued: true })
    doc.fillColor(MUTED).font('Helvetica').text(`   ${d.score}/100`)
    doc.fillColor(MUTED).fontSize(9.5).font('Helvetica')
      .text(s.finding[d.key](d.severity, d.params), PAGE_MARGIN + 18, doc.y + 1, { width: contentWidth - 18 })
    doc.moveDown(0.5)
  }

  // ── Competitors ───────────────────────────────────────────────────────────
  if (r.competitors.length > 0) {
    if (doc.y > doc.page.height - 140) doc.addPage()
    doc.moveDown(0.4)
    doc.fontSize(12).fillColor(TEXT).font('Helvetica-Bold').text(s.competitorsHeader)
    doc.moveDown(0.3)
    for (const c of r.competitors) {
      doc.fillColor(TEXT).fontSize(10).font('Helvetica')
        .text(`#${c.position}  ${c.title}`, PAGE_MARGIN, doc.y, { continued: true })
      doc.fillColor(MUTED).text(
        c.ratingCount != null ? `   ${c.rating ?? ''}★ · ${s.competitorReviews(c.ratingCount)}` : '',
      )
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveDown(1)
  doc.strokeColor(BORDER).lineWidth(1)
    .moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke()
  doc.moveDown(0.5)
  const by = [s.preparedBy, brand.contactName || brand.companyName, brand.phone].filter(Boolean).join(' · ')
  doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(by)
  doc.moveDown(0.3)
  doc.fontSize(7.5).fillColor(MUTED).text(s.disclaimer, { width: contentWidth })

  doc.end()
}
