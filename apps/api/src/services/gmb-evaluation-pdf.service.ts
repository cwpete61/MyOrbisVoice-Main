/**
 * Brand-parameterized PDF report for a V2 GMB Evaluation. Streamed, never
 * buffered. Bilingual via the shared catalog in @voiceautomation/types — the
 * one place audit prose lives, so the report and screen never drift. Brand
 * context (company, contact, phone, logo) is injected → white-label ready.
 */
import PDFDocument from 'pdfkit'
import {
  GMB_CATEGORY_LABELS, GMB_TIME_LABELS, GMB_STATUS_LABELS, GMB_UI,
  GMB_DATA_SOURCE_LABELS, GMB_REASON_LABELS, GMB_SCORECARD_LABELS,
  gmbIssueText, gmbInterpolate, buildActionPlan, type GmbLocale,
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

// Design system — primary teal + warm coral accent, neutral ink/greys.
const PRIMARY = '#127a7a'        // deep teal — header band, section rules
const PRIMARY_LIGHT = '#1a9898'  // brighter teal — accents, "you" column
const ACCENT = '#e8804d'         // warm coral — complementary highlight
const TEXT = '#1f2937'           // ink
const MUTED = '#6b7280'
const BORDER = '#e5e7eb'         // hairline
const TINT = '#eef6f6'           // teal panel tint
const ZEBRA = '#f7f9f9'          // table zebra
const GOOD = '#16a34a'
const WARN = '#d97706'
const CRIT = '#dc2626'
const PAGE_MARGIN = 54

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
  // Older stored evals (V1, or early V2 before heat map/competitors) lack these
  // arrays. Default them so the report renders for any historical result shape
  // instead of throwing on `.length`.
  const topGaps = r.topGaps ?? []
  const categories = r.categories ?? []
  const competitorDetails = r.competitorDetails ?? []
  const competitors = r.competitors ?? []
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
  /** Section header: bold title + a short accent underline rule. */
  const sectionHeader = (text: string) => {
    ensureSpace(60)
    doc.moveDown(0.6)
    doc.fontSize(12.5).fillColor(TEXT).font('Helvetica-Bold').text(text, PAGE_MARGIN, doc.y)
    const ly = doc.y + 2
    doc.strokeColor(ACCENT).lineWidth(2).moveTo(PAGE_MARGIN, ly).lineTo(PAGE_MARGIN + 34, ly).stroke()
    doc.y = ly + 6
    doc.x = PAGE_MARGIN
  }

  // ── Header band ─────────────────────────────────────────────────────────────
  const bandH = 74
  doc.save().rect(0, 0, doc.page.width, bandH).fill(PRIMARY).restore()
  if (logoBytes) { try { doc.image(logoBytes, doc.page.width - PAGE_MARGIN - 110, 16, { fit: [110, 42] }) } catch { /* bad image */ } }
  doc.fillColor('#ffffff').fontSize(19).font('Helvetica-Bold').text(brand.companyName, PAGE_MARGIN, 20)
  doc.fillColor('#cdeaea').fontSize(10).font('Helvetica').text(ui('reportTitle'), PAGE_MARGIN, 46)
  doc.y = bandH + 16
  doc.x = PAGE_MARGIN
  doc.fontSize(14).fillColor(TEXT).font('Helvetica-Bold').text(`${evaluation.businessName} — ${evaluation.city}`)
  doc.fontSize(9).fillColor(MUTED).font('Helvetica')
    .text(evaluation.createdAt.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US'))
  doc.moveDown(0.5)

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

  // ── Executive summary ──────────────────────────────────────────────────────
  const sum = r.summary
  const cg = r.competitorGap
  if (sum) {
    const lines: string[] = []
    if (sum.invisiblePct !== null && sum.invisiblePct > 0) lines.push(ui('summaryInvisible', { pct: sum.invisiblePct }))
    if (sum.top3Pct !== null) lines.push(ui('summaryTop3', { pct: sum.top3Pct }))
    if (cg?.leaderName && cg.reasons.length) lines.push(ui('beatingWhy', { leader: cg.leaderName, why: cg.reasons.map((rk) => GMB_REASON_LABELS[locale][rk] ?? rk).join(', ') }))
    if (sum.fastWinCount > 0) lines.push(ui('summaryFastWins', { count: sum.fastWinCount }))
    if (lines.length) {
      const boxY = doc.y
      const boxH = 18 + lines.length * 13
      doc.roundedRect(PAGE_MARGIN, boxY, contentWidth, boxH, 6).fillAndStroke('#fdf3f2', BORDER)
      doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text(ui('execSummary'), PAGE_MARGIN + 12, boxY + 8)
      doc.fontSize(9.5).font('Helvetica').fillColor('#444')
      for (const l of lines) doc.text(`•  ${l}`, PAGE_MARGIN + 12, doc.y + 1, { width: contentWidth - 24 })
      doc.y = boxY + boxH + 8
      doc.x = PAGE_MARGIN
    }
  }

  // ── Heat map ────────────────────────────────────────────────────────────────
  if (r.heatMap && (r.heatMap.points?.length ?? 0) > 0) renderHeatMap(r.heatMap)

  // ── Who's beating you + scorecard ──────────────────────────────────────────
  if (competitorDetails.length && cg) renderScorecard()

  // ── Top priorities ────────────────────────────────────────────────────────
  if (topGaps.length) {
    sectionHeader(ui('topGaps'))
    for (const g of topGaps) renderIssue(g, true)
    doc.moveDown(0.4)
  }

  // ── Categories ────────────────────────────────────────────────────────────
  for (const c of categories) renderCategory(c)

  // ── Recommended action plan ─────────────────────────────────────────────────
  if (categories.length) {
    const plan = buildActionPlan(categories.flatMap((c) => c.issues))
    const buckets: Array<[string, typeof plan.p1, string]> = [
      ['priority1', plan.p1, ui('thirtyDay')], ['priority2', plan.p2, ui('ninetyDay')],
      ['priority3', plan.p3, ui('ninetyDay')], ['priority4', plan.p4, ui('ninetyDay')],
    ]
    if (buckets.some(([, list]) => list.length)) {
      sectionHeader(ui('actionPlan'))
      doc.fontSize(8.5).fillColor(MUTED).font('Helvetica').text(ui('actionPlanLead'), { width: contentWidth })
      doc.moveDown(0.2)
      for (const [key, list, tag] of buckets) {
        if (!list.length) continue
        ensureSpace(50)
        const y = doc.y
        doc.fontSize(10).fillColor(PRIMARY).font('Helvetica-Bold').text(ui(key), PAGE_MARGIN, y)
        doc.fontSize(7.5).fillColor(MUTED).font('Helvetica').text(tag, PAGE_MARGIN, y, { width: contentWidth, align: 'right' })
        doc.moveDown(0.1)
        for (const it of list) renderIssue(it as unknown as Issue, false)
        doc.moveDown(0.2)
      }
    }
  }

  // ── Competitors ───────────────────────────────────────────────────────────
  if (competitors.length) {
    sectionHeader(ui('competitors'))
    for (const cmp of competitors) {
      doc.fontSize(10).fillColor(TEXT).font('Helvetica').text(`#${cmp.position}  ${cmp.title}`, { continued: true })
      doc.fillColor(MUTED).text(cmp.ratingCount != null ? `   ${cmp.rating ?? ''}★ · ${ui('reviewsCount', { count: cmp.ratingCount })}` : '')
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  ensureSpace(80)
  doc.moveDown(0.8)
  doc.strokeColor(BORDER).lineWidth(1).moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).stroke()
  doc.moveDown(0.4)
  const sources = (r.meta?.dataSources ?? []).map((s) => GMB_DATA_SOURCE_LABELS[locale][s] ?? s).join(' · ')
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
    ensureSpace(78)
    doc.moveDown(0.45)
    const y = doc.y
    const scoreText = c.score === null ? '—' : `${c.score}`
    // Label (left) + score (right), then a thin score bar beneath.
    doc.fillColor(TEXT).fontSize(10.5).font('Helvetica-Bold').text(catLabel(c.key), PAGE_MARGIN, y)
    doc.fillColor(c.score === null ? MUTED : scoreColor(c.score)).fontSize(10.5).font('Helvetica-Bold')
      .text(c.score === null ? '—' : `${scoreText}/100`, PAGE_MARGIN, y, { width: contentWidth, align: 'right' })
    // bar track + fill
    const barY = doc.y + 2, barW = contentWidth, barH = 4
    doc.roundedRect(PAGE_MARGIN, barY, barW, barH, 2).fill('#eeeeee')
    if (c.score !== null && c.score > 0) {
      doc.roundedRect(PAGE_MARGIN, barY, Math.max(3, barW * (c.score / 100)), barH, 2).fill(scoreColor(c.score))
    }
    doc.y = barY + barH + 3
    doc.x = PAGE_MARGIN
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`${ui('target', { expected: c.expected })} · ${statusLabel(c.status)}`, PAGE_MARGIN, doc.y)
    doc.moveDown(0.15)
    if (c.issues.length === 0) { doc.moveDown(0.1); return }
    for (const it of c.issues) renderIssue(it, false)
  }

  function renderHeatMap(h: NonNullable<AuditResult['heatMap']>) {
    const HEAT: Record<string, string> = { green: '#16a34a', yellow: '#eab308', orange: '#ea8a2f', red: '#dc2626', none: '#e5e7eb' }
    ensureSpace(60 + h.gridSize * 18)
    sectionHeader(ui('heatMapTitle'))
    doc.fontSize(8.5).fillColor(MUTED).font('Helvetica').text(ui('heatMapSub', { keyword: h.keyword }))
    doc.fontSize(9).fillColor(TEXT).text(
      `${ui('avgRank')}: ${h.avgRank ?? '—'}   ${ui('top3Coverage')}: ${h.top3Pct}%   ${ui('top10Coverage')}: ${h.top10Pct}%   ${ui('invisible')}: ${h.invisiblePct}%`,
    )
    doc.moveDown(0.3)
    const cell = 16, gap = 2, gridY = doc.y, gridX = PAGE_MARGIN
    const sorted = [...h.points].sort((a, b) => a.row - b.row || a.col - b.col)
    for (const p of sorted) {
      const x = gridX + p.col * (cell + gap)
      const y = gridY + p.row * (cell + gap)
      doc.roundedRect(x, y, cell, cell, 2).fill(HEAT[p.bucket] ?? '#e5e5e5')
      if (p.rank !== null) {
        doc.fillColor(p.bucket === 'yellow' ? '#333' : '#fff').fontSize(7).font('Helvetica-Bold')
          .text(String(p.rank), x, y + 4.5, { width: cell, align: 'center' })
      }
    }
    // Legend — drawn swatches (Helvetica has no ■ glyph).
    const legendY = gridY + h.gridSize * (cell + gap) + 8
    let lx = PAGE_MARGIN
    doc.fontSize(7.5).font('Helvetica')
    for (const [b, label] of [['green', ui('heatGreen')], ['yellow', ui('heatYellow')], ['orange', ui('heatOrange')], ['red', ui('heatRed')], ['none', ui('heatGray')]] as const) {
      doc.save().rect(lx, legendY + 1, 7, 7).fill(HEAT[b] ?? '#e5e7eb').restore()
      doc.fillColor(MUTED).text(label, lx + 10, legendY, { lineBreak: false })
      lx += 10 + doc.widthOfString(label) + 12
    }
    doc.y = legendY + 14
    doc.x = PAGE_MARGIN
    doc.fontSize(8).fillColor(MUTED).text(ui('fastWinsNote'), { width: contentWidth })
    doc.moveDown(0.4)
  }

  function renderScorecard() {
    ensureSpace(150)
    sectionHeader(ui('whoBeating'))
    if (cg?.leaderName && cg.reasons.length) {
      doc.fontSize(9.5).fillColor('#374151').font('Helvetica')
        .text(ui('beatingWhy', { leader: cg.leaderName, why: cg.reasons.map((rk) => GMB_REASON_LABELS[locale][rk] ?? rk).join(', ') }), { width: contentWidth })
    }
    doc.moveDown(0.4)
    const comps = competitorDetails
    const cl = cg!.client
    const ROW_H = 16
    const metricW = 168
    const numCols = comps.length + 2 // You + comps + Gap
    const numColW = (contentWidth - metricW) / numCols
    const colLeft = (i: number) => PAGE_MARGIN + metricW + i * numColW // i: 0=You,1..=comps, last=Gap
    const cellText = (s: string, i: number, y: number, color: string, bold: boolean) =>
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color).fontSize(8.5)
        .text(s, colLeft(i) + 3, y, { width: numColW - 6, align: 'right' })

    // Header row (filled)
    let y = doc.y
    const tableTop = y
    doc.save().rect(PAGE_MARGIN, y, contentWidth, ROW_H).fill(PRIMARY).restore()
    doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(8.5)
    doc.text(ui('metric'), PAGE_MARGIN + 6, y + 4)
    cellText(ui('youLabel'), 0, y + 4, '#ffffff', true)
    comps.forEach((c, i) => cellText(c.name.slice(0, 14), i + 1, y + 4, '#ffffff', true))
    cellText(ui('gap'), numCols - 1, y + 4, '#ffffff', true)
    y += ROW_H

    const rows: Array<{ k: string; you: number | null; comps: (number | null)[]; higher: boolean; dec?: number }> = [
      { k: 'reviews', you: cl.reviews, comps: comps.map((c) => c.reviewCount), higher: true },
      { k: 'rating', you: cl.rating, comps: comps.map((c) => c.rating), higher: true, dec: 1 },
      { k: 'categories', you: cl.categories, comps: comps.map((c) => c.categoryCount), higher: true },
      { k: 'servicePages', you: cl.servicePages, comps: comps.map((c) => c.servicePageCount), higher: true },
      { k: 'locationPages', you: cl.locationPages, comps: comps.map((c) => c.locationPageCount), higher: true },
      { k: 'mapPack', you: r.mapPackPosition, comps: comps.map((c) => c.mapPackPosition), higher: false },
    ]
    const fmt = (v: number | null, dec?: number) => v == null ? '—' : dec ? v.toFixed(dec) : String(v)
    rows.forEach((row, ri) => {
      const cs = row.comps.filter((x): x is number => x != null)
      let gap: number | null = null, lose = false
      if (row.you != null && cs.length) { const best = row.higher ? Math.max(...cs) : Math.min(...cs); gap = row.higher ? row.you - best : best - row.you; lose = gap < 0 }
      if (ri % 2 === 1) doc.save().rect(PAGE_MARGIN, y, contentWidth, ROW_H).fill(ZEBRA).restore()
      doc.font('Helvetica').fillColor(TEXT).fontSize(8.5).text(GMB_SCORECARD_LABELS[locale][row.k] ?? row.k, PAGE_MARGIN + 6, y + 4)
      cellText(fmt(row.you, row.dec), 0, y + 4, PRIMARY_LIGHT, true)
      row.comps.forEach((c, i) => cellText(fmt(c, row.dec), i + 1, y + 4, TEXT, false))
      cellText(gap == null ? '—' : `${gap > 0 ? '+' : ''}${row.dec ? gap.toFixed(row.dec) : gap}`, numCols - 1, y + 4, gap == null ? MUTED : lose ? CRIT : GOOD, true)
      y += ROW_H
    })
    // outer border around the whole table
    doc.strokeColor(BORDER).lineWidth(0.6).rect(PAGE_MARGIN, tableTop, contentWidth, y - tableTop).stroke()
    doc.y = y + 4
    doc.x = PAGE_MARGIN
  }
}
