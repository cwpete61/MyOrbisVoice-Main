/**
 * Brand-parameterized PDF report for a V2 GMB Evaluation. Streamed, never
 * buffered. Bilingual via the shared catalog in @voiceautomation/types — the
 * one place audit prose lives, so the report and screen never drift. Brand
 * context (company, contact, phone, logo) is injected → white-label ready.
 */
import PDFDocument from 'pdfkit'
import {
  GMB_CATEGORY_LABELS, GMB_TIME_LABELS, GMB_STATUS_LABELS, GMB_UI,
  GMB_DATA_SOURCE_LABELS, gmbIssueText, gmbInterpolate, type GmbLocale,
} from '@voiceautomation/types'
import type { AuditResult, CategoryResult, Issue, Severity } from './gmb-audit/index.js'

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
  locale: GmbLocale
}

const PRIMARY = '#1a9898'
const TEXT = '#1a1a1a'
const MUTED = '#666666'
const BORDER = '#e5e5e5'
const GOOD = '#1a9d5a'
const WARN = '#c98a00'
const CRIT = '#c0392b'
const PAGE_MARGIN = 50

function sevColor(s: Severity): string {
  return s === 'critical' ? CRIT : s === 'warn' ? WARN : MUTED
}
function scoreColor(score: number): string {
  return score >= 75 ? GOOD : score >= 45 ? WARN : CRIT
}

async function fetchLogoBytes(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
    if (!res.ok) return null
    if ((res.headers.get('Content-Type') ?? '').includes('svg')) return null
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
  const r = evaluation.result
  const ui = (k: string, p: Record<string, string | number> = {}) => gmbInterpolate(GMB_UI[locale][k] ?? k, p)
  const catLabel = (k: string) => GMB_CATEGORY_LABELS[locale][k] ?? k
  const timeLabel = (t: string) => GMB_TIME_LABELS[locale][t] ?? t
  const statusLabel = (s: string) => GMB_STATUS_LABELS[locale][s] ?? s
  const logoBytes = brand.logoUrl ? await fetchLogoBytes(brand.logoUrl) : null

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: { Title: `GMB Evaluation — ${evaluation.businessName}`, Author: brand.companyName },
  })
  doc.pipe(out)
  const contentWidth = doc.page.width - PAGE_MARGIN * 2
  const ensureSpace = (need: number) => { if (doc.y > doc.page.height - need) doc.addPage() }

  // ── Header ────────────────────────────────────────────────────────────────
  if (logoBytes) { try { doc.image(logoBytes, PAGE_MARGIN, PAGE_MARGIN, { fit: [120, 48] }) } catch { /* bad image */ } }
  doc.fontSize(18).fillColor(PRIMARY).font('Helvetica-Bold')
    .text(brand.companyName, PAGE_MARGIN, PAGE_MARGIN + (logoBytes ? 56 : 0))
  doc.fontSize(13).fillColor(TEXT).font('Helvetica-Bold')
    .text(`${evaluation.businessName} — ${evaluation.city}`)
  doc.fontSize(9).fillColor(MUTED).font('Helvetica')
    .text(evaluation.createdAt.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US'))
  doc.moveDown(0.6)

  // ── Overall score band ────────────────────────────────────────────────────
  const bandY = doc.y
  doc.roundedRect(PAGE_MARGIN, bandY, contentWidth, 56, 6).fill('#f4fbfb')
  doc.fillColor(scoreColor(evaluation.overallScore)).fontSize(34).font('Helvetica-Bold')
    .text(`${evaluation.overallScore}`, PAGE_MARGIN + 16, bandY + 10, { continued: true })
  doc.fillColor(MUTED).fontSize(13).font('Helvetica').text(' / 100')
  doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(ui('overallScore'), PAGE_MARGIN + 120, bandY + 12)
  doc.fillColor(MUTED).fontSize(9.5).font('Helvetica')
    .text(r.mapPackPosition ? ui('mapPackHeadline', { position: r.mapPackPosition }) : ui('notRanking'),
      PAGE_MARGIN + 120, bandY + 30, { width: contentWidth - 140 })
  doc.y = bandY + 70
  doc.x = PAGE_MARGIN

  // ── Top priorities ────────────────────────────────────────────────────────
  if (r.topGaps.length) {
    doc.fontSize(12).fillColor(TEXT).font('Helvetica-Bold').text(ui('topGaps'))
    doc.moveDown(0.3)
    for (const g of r.topGaps) renderIssue(g, true)
    doc.moveDown(0.4)
  }

  // ── Categories ────────────────────────────────────────────────────────────
  for (const c of r.categories) renderCategory(c)

  // ── Competitors ───────────────────────────────────────────────────────────
  if (r.competitors.length) {
    ensureSpace(120)
    doc.moveDown(0.3)
    doc.fontSize(12).fillColor(TEXT).font('Helvetica-Bold').text(ui('competitors'))
    doc.moveDown(0.2)
    for (const cmp of r.competitors) {
      doc.fontSize(10).fillColor(TEXT).font('Helvetica').text(`#${cmp.position}  ${cmp.title}`, { continued: true })
      doc.fillColor(MUTED).text(cmp.ratingCount != null ? `   ${cmp.rating ?? ''}★ · ${ui('reviewsCount', { count: cmp.ratingCount })}` : '')
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  ensureSpace(80)
  doc.moveDown(0.8)
  doc.strokeColor(BORDER).lineWidth(1).moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke()
  doc.moveDown(0.4)
  const sources = r.meta.dataSources.map((s) => GMB_DATA_SOURCE_LABELS[locale][s] ?? s).join(' · ')
  doc.fontSize(8).fillColor(MUTED).font('Helvetica').text(`${ui('dataSources')}: ${sources}`)
  doc.moveDown(0.2)
  const by = [brand.contactName || brand.companyName, brand.phone].filter(Boolean).join(' · ')
  doc.fontSize(9).fillColor(MUTED).text(by)

  doc.end()

  // ── helpers (closures over doc) ─────────────────────────────────────────────
  function renderIssue(it: Issue, compact: boolean) {
    ensureSpace(60)
    const { title, fix } = gmbIssueText(locale, it.key, it.params)
    const rowY = doc.y
    doc.circle(PAGE_MARGIN + 4, rowY + 6, 3.5).fill(sevColor(it.severity))
    doc.fillColor(TEXT).fontSize(10).font('Helvetica-Bold').text(title, PAGE_MARGIN + 16, rowY, { width: contentWidth - 90, continued: false })
    // time chip on the right
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(`${ui('estTime')}: ${timeLabel(it.timeTier)}`, PAGE_MARGIN + 16, rowY, { width: contentWidth - 16, align: 'right' })
    if (fix) {
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(`${ui('fix')}: ${fix}`, PAGE_MARGIN + 16, doc.y + 1, { width: contentWidth - 16 })
    }
    doc.moveDown(compact ? 0.35 : 0.3)
  }

  function renderCategory(c: CategoryResult) {
    ensureSpace(70)
    doc.moveDown(0.3)
    const y = doc.y
    const scoreText = c.score === null ? '—' : `${c.score}/100`
    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(catLabel(c.key), PAGE_MARGIN, y, { continued: true })
    doc.fillColor(c.score === null ? MUTED : scoreColor(c.score)).text(`   ${scoreText}`, { continued: true })
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`   ${ui('target', { expected: c.expected })} · ${statusLabel(c.status)}`)
    doc.moveDown(0.1)
    if (c.issues.length === 0) { doc.moveDown(0.1); return }
    for (const it of c.issues) renderIssue(it, false)
  }
}
