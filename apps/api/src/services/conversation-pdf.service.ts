import PDFDocument from 'pdfkit'
import { prisma } from '../lib/prisma.js'
import { getBunnyConfig, storageHostForRegion } from './bunny.service.js'

// Layered, structured PDF export for a single Conversation.
// Streamed directly to the response — never fully buffered.

interface TranscriptTurn {
  role?: string
  speaker?: string
  text?: string
  content?: string
  timestamp?: number  // seconds from call start, or ms epoch
  ts?: number
}

export interface ConversationPdfInput {
  conversationId: string
  tenantId: string
}

const PRIMARY = '#1a9898'   // Teal 3
const TEXT    = '#1a1a1a'
const MUTED   = '#666666'
const BORDER  = '#e5e5e5'

const PAGE_MARGIN = 50

/**
 * Stream a Conversation PDF to a writable stream (typically the Express response).
 * Returns when the document is fully written. Throws if the conversation isn't
 * found within the tenant scope (so the caller can return 404).
 */
export async function streamConversationPdf(
  input: ConversationPdfInput,
  out: NodeJS.WritableStream,
): Promise<void> {
  const { conversationId, tenantId } = input

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      contact: true,
      tenant: {
        select: {
          displayName: true,
          timezone: true,
          businessProfile: { select: { brandName: true, logoUrl: true } },
        },
      },
    },
  })

  if (!conv) {
    const err = new Error('CONVERSATION_NOT_FOUND')
    ;(err as Error & { code?: string }).code = 'CONVERSATION_NOT_FOUND'
    throw err
  }

  const tenantTimezone = conv.tenant.timezone ?? 'UTC'
  const profile = conv.tenant.businessProfile
  const tenantBrandName = profile?.brandName ?? conv.tenant.displayName ?? 'OrbisVoice'

  // Try to fetch the logo as bytes if present (best-effort, never blocks)
  const logoBytes = profile?.logoUrl ? await fetchLogoBytes(profile.logoUrl) : null

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `Conversation ${conv.id}`,
      Author: tenantBrandName,
      Creator: 'OrbisVoice',
      Subject: 'Conversation record',
    },
  })

  doc.pipe(out)

  // ---- Header ------------------------------------------------------------
  renderHeader(doc, { tenantBrandName, logoBytes })

  doc.moveDown(0.5)

  // ---- Metadata block ----------------------------------------------------
  renderMetadata(doc, conv, tenantTimezone)

  // ---- Summary ----------------------------------------------------------
  if (conv.summaryText && conv.summaryText.trim().length > 0) {
    renderSection(doc, 'Summary')
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(TEXT)
      .text(conv.summaryText.trim(), { align: 'left', lineGap: 2 })
    doc.moveDown(0.7)
  }

  // ---- Disposition ------------------------------------------------------
  if (conv.outcomeCode && conv.outcomeCode.trim().length > 0) {
    renderSection(doc, 'Disposition')
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(TEXT)
      .text(humanizeDisposition(conv.outcomeCode))
    doc.moveDown(0.7)
  }

  // ---- Transcript -------------------------------------------------------
  renderSection(doc, 'Transcript')
  const turns = parseTranscript(conv.transcriptJson)
  if (turns.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor(MUTED)
      .text('Transcript not available for this conversation.')
  } else {
    const startedAtMs = conv.startedAt.getTime()
    for (const t of turns) {
      renderTurn(doc, t, startedAtMs)
    }
  }

  // ---- Footer (last page only) ------------------------------------------
  renderFooter(doc)

  doc.end()

  // Wait for the underlying stream to finish flushing
  await new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve())
    out.on('close',  () => resolve())
    out.on('error',  (err) => reject(err))
    // PDFKit emits 'end' when its source finishes; the response then flushes
    doc.on('end', () => resolve())
    doc.on('error', (err) => reject(err))
  })
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderHeader(
  doc: PDFKit.PDFDocument,
  args: { tenantBrandName: string; logoBytes: Buffer | null },
): void {
  const { tenantBrandName, logoBytes } = args
  const top = doc.y
  const right = doc.page.width - PAGE_MARGIN

  // Right-side label
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(PRIMARY)
    .text('Conversation Record', PAGE_MARGIN, top, {
      align: 'right',
      width: right - PAGE_MARGIN,
    })

  // Left-side brand (logo if available, else bold text)
  let logoRendered = false
  if (logoBytes) {
    try {
      doc.image(logoBytes, PAGE_MARGIN, top - 4, { fit: [140, 36] })
      logoRendered = true
    } catch {
      logoRendered = false
    }
  }
  if (!logoRendered) {
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(TEXT)
      .text(tenantBrandName, PAGE_MARGIN, top, { width: right - PAGE_MARGIN - 200 })
  }

  // Reset y past the header (largest of the two columns)
  doc.y = top + 42

  // Divider
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(right, doc.y)
    .strokeColor(BORDER)
    .lineWidth(1)
    .stroke()
  doc.moveDown(0.6)
}

function renderMetadata(
  doc: PDFKit.PDFDocument,
  conv: ConversationWithRelations,
  tenantTimezone: string,
): void {
  const c = conv.contact
  const contactName = c
    ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.fullName?.trim() || ''
    : ''

  const rows: Array<[string, string]> = []
  rows.push(['Contact', contactName || 'Anonymous caller'])
  if (c?.phoneE164) rows.push(['Phone', c.phoneE164])
  if (c?.email)     rows.push(['Email', c.email])
  rows.push(['Date', formatDateInTimezone(conv.startedAt, tenantTimezone)])
  rows.push(['Duration', formatDuration(conv.startedAt, conv.endedAt, conv.recordingDurationSecs)])
  rows.push(['Channel', humanizeChannel(conv.channelType)])
  rows.push(['Direction', humanizeDirection(conv.direction)])
  rows.push(['Status', humanizeStatus(conv.status)])
  if (conv.recordingRef) rows.push(['Recording', 'Available via app'])

  doc.font('Helvetica').fontSize(10)
  const labelWidth = 86
  const startX = PAGE_MARGIN
  const valueX = startX + labelWidth

  for (const [label, value] of rows) {
    const y = doc.y
    doc
      .font('Helvetica-Bold')
      .fillColor(MUTED)
      .text(label, startX, y, { width: labelWidth - 6 })
    doc
      .font('Helvetica')
      .fillColor(TEXT)
      .text(value, valueX, y, { width: doc.page.width - valueX - PAGE_MARGIN })
    doc.moveDown(0.2)
  }
  doc.moveDown(0.6)
  // Divider
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.6)
}

function renderSection(doc: PDFKit.PDFDocument, title: string): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(PRIMARY)
    .text(title.toUpperCase(), { characterSpacing: 0.6 })
  doc.moveDown(0.2)
}

function renderTurn(
  doc: PDFKit.PDFDocument,
  turn: TranscriptTurn,
  startedAtMs: number,
): void {
  const speakerLabel = turnSpeakerLabel(turn)
  const text = (turn.text ?? turn.content ?? '').trim()
  if (!text) return

  const ts = resolveTurnOffsetSecs(turn, startedAtMs)
  const tsLabel = ts != null ? `[${formatOffset(ts)}] ` : ''

  doc.font('Helvetica').fontSize(10).fillColor(TEXT)

  const prefix = `${tsLabel}${speakerLabel}: `
  // Render prefix as bold inline, then text. PDFKit doesn't support partial-bold
  // in a single text() call easily, so render prefix then continue.
  doc
    .font('Helvetica-Bold')
    .fillColor(speakerLabel === 'Agent' ? PRIMARY : TEXT)
    .text(prefix, { continued: true })
  doc
    .font('Helvetica')
    .fillColor(TEXT)
    .text(text, { lineGap: 1.5 })
  doc.moveDown(0.25)
}

function renderFooter(doc: PDFKit.PDFDocument): void {
  // Place at the bottom of the current page.
  const bottomY = doc.page.height - PAGE_MARGIN + 12
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      `Generated by OrbisVoice on ${new Date().toISOString()}`,
      PAGE_MARGIN,
      bottomY,
      { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' },
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ConversationWithRelations = NonNullable<
  Awaited<ReturnType<typeof prisma.conversation.findFirst>>
> & {
  contact: { firstName: string | null; lastName: string | null; fullName: string | null; email: string | null; phoneE164: string | null } | null
}

function parseTranscript(raw: unknown): TranscriptTurn[] {
  if (!raw) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return (arr as TranscriptTurn[]).filter(t => t && typeof t === 'object')
}

function turnSpeakerLabel(t: TranscriptTurn): string {
  const role = (t.role ?? t.speaker ?? '').toString().toLowerCase()
  if (role === 'assistant' || role === 'agent' || role === 'bot') return 'Agent'
  if (role === 'user' || role === 'caller' || role === 'customer' || role === 'human') return 'Caller'
  // Default: lean toward "Caller" for unknown
  return role ? capitalize(role) : 'Speaker'
}

function resolveTurnOffsetSecs(t: TranscriptTurn, startedAtMs: number): number | null {
  const raw = t.timestamp ?? t.ts
  if (raw == null || typeof raw !== 'number' || !Number.isFinite(raw)) return null
  // Heuristic: large numbers are ms-since-epoch, smaller are seconds-from-start
  if (raw > 1e12) {
    return Math.max(0, Math.round((raw - startedAtMs) / 1000))
  }
  if (raw > 1e9) {
    // seconds-since-epoch
    return Math.max(0, Math.round(raw - startedAtMs / 1000))
  }
  return Math.max(0, Math.round(raw))
}

function formatOffset(secs: number): string {
  const mm = Math.floor(secs / 60).toString().padStart(2, '0')
  const ss = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function formatDuration(start: Date, end: Date | null, recordingDurationSecs: number | null): string {
  let secs: number | null = null
  if (recordingDurationSecs != null && recordingDurationSecs > 0) {
    secs = recordingDurationSecs
  } else if (end) {
    secs = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
  }
  if (secs == null) return '—'
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

function formatDateInTimezone(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year:   'numeric',
      month:  'short',
      day:    '2-digit',
      hour:   'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

function humanizeChannel(c: string): string {
  if (c === 'INBOUND')  return 'Inbound (phone)'
  if (c === 'OUTBOUND') return 'Outbound (phone)'
  if (c === 'WIDGET')   return 'Website widget'
  return c
}

function humanizeDirection(d: string): string {
  return d === 'INBOUND' ? 'Inbound' : d === 'OUTBOUND' ? 'Outbound' : d
}

function humanizeStatus(s: string): string {
  return s ? capitalize(s.toLowerCase()) : '—'
}

function humanizeDisposition(code: string): string {
  // Mirror the labels used in the conversations page UI for consistency
  const map: Record<string, string> = {
    booked:          'Booked / Sale',
    qualified:       'Qualified lead',
    callback:        'Callback requested',
    not_interested:  'Not interested',
    wrong_number:    'Wrong number',
    voicemail:       'Voicemail',
    no_answer:       'No answer',
    spam:            'Spam / robocall',
  }
  return map[code] ?? code.replace(/_/g, ' ')
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Best-effort logo fetch. Two paths:
 *   1) If logoUrl points at our Bunny storage CDN, fetch via storage API
 *      with the access key (CDN may not have a public pull zone).
 *   2) Otherwise fetch directly. Returns null on any failure — the PDF
 *      falls back to the brand text.
 */
async function fetchLogoBytes(logoUrl: string): Promise<Buffer | null> {
  try {
    // Bunny CDN host indicates a tenant logo stored in our managed zone
    const config = await getBunnyConfig().catch(() => null)
    if (config) {
      const cdnHostMatch = logoUrl.match(/^https?:\/\/([^/]+)\/(.+)$/)
      const cdnHost = cdnHostMatch?.[1]?.toLowerCase()
      const objectPath = cdnHostMatch?.[2]
      if (cdnHost && objectPath && cdnHost.endsWith('b-cdn.net')) {
        const storageHost = storageHostForRegion(config.storageRegion)
        const storageUrl  = `https://${storageHost}/${config.storageZone}/${objectPath}`
        const upstream    = await fetchWithTimeout(storageUrl, {
          headers: { AccessKey: config.storagePassword },
        }, 4000)
        if (upstream && upstream.ok) {
          const ct = upstream.headers.get('Content-Type') ?? ''
          if (ct.includes('svg')) return null  // PDFKit can't render SVG
          const ab = await upstream.arrayBuffer()
          return Buffer.from(ab)
        }
      }
    }

    const res = await fetchWithTimeout(logoUrl, {}, 4000)
    if (!res || !res.ok) return null
    const ct = res.headers.get('Content-Type') ?? ''
    if (ct.includes('svg')) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
