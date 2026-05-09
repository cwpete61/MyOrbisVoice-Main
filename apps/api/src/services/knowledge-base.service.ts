/**
 * Tenant knowledge-base service. Tenants upload reference docs (PDF, Word,
 * Excel, CSV, plain text); we store the blob on Bunny and the extracted
 * text on Postgres so the AI agent can use it as background knowledge
 * during conversations without round-tripping to Bunny on the live-call
 * path.
 *
 * Storage caps:
 *  - Per-file: 25 MB hard limit (KB_MAX_FILE_BYTES). Extracting bigger
 *    files would risk OOM in the API container.
 *  - Per-tenant: kb_storage_mb entitlement (50/250/1024/5120 by tier).
 *
 * Extraction is fire-and-forget: the upload endpoint returns immediately
 * with status=PENDING; a setImmediate task does the parse and updates
 * the row to READY or FAILED. The UI polls until terminal.
 */

import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import {
  getBunnyConfig,
  storageHostForRegion,
  type BunnyConfig,
} from './bunny.service.js'
import { writeAuditLog } from '../lib/audit.js'

// ── Constants ─────────────────────────────────────────────────────────────────

export const KB_MAX_FILE_BYTES = 25 * 1024 * 1024  // 25 MB hard per-file cap

/** Allowed MIME types and the human-readable label we surface to the user. */
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf':                                                        'PDF',
  'application/msword':                                                     'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.ms-excel':                                               'Excel (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':      'Excel (.xlsx)',
  'text/csv':                                                               'CSV',
  'text/plain':                                                             'Plain text',
  'text/markdown':                                                          'Markdown',
}

export function isAllowedType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, mimeType)
}

/** Lower-cased file extension from a filename, no leading dot. */
function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return ''
  return filename.slice(dot + 1).toLowerCase()
}

// ── Bunny path helpers ────────────────────────────────────────────────────────

function buildKbPath(tenantId: string, fileId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  return `tenants/${tenantId}/knowledge-base/${fileId}.${safeExt}`
}

async function uploadBufferToBunny(
  config: BunnyConfig,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`
  const res  = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey:      config.storagePassword,
      'Content-Type': contentType,
    },
    body: buffer,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bunny upload failed: ${res.status} ${text}`)
  }
}

async function deleteFromBunny(config: BunnyConfig, path: string): Promise<void> {
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`
  await fetch(url, {
    method: 'DELETE',
    headers: { AccessKey: config.storagePassword },
  })
}

async function downloadFromBunny(config: BunnyConfig, path: string): Promise<Buffer> {
  const host = storageHostForRegion(config.storageRegion)
  const url  = `https://${host}/${config.storageZone}/${path}`
  const res  = await fetch(url, {
    method:  'GET',
    headers: { AccessKey: config.storagePassword },
  })
  if (!res.ok) throw new Error(`Bunny download failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Text extraction ───────────────────────────────────────────────────────────

/** Extract searchable text from a buffer based on MIME type.
 *  Throws on parse error; caller marks the row FAILED. */
async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = extOf(filename)

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    // pdf-parse v2 is class-based: new PDFParse({ data }) → .getText() → { text }
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text ?? ''
    } finally {
      await parser.destroy().catch(() => { /* ignore cleanup errors */ })
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value ?? ''
  }

  if (mimeType === 'application/msword' || ext === 'doc') {
    // mammoth's docx-only path doesn't handle legacy .doc reliably; surface a
    // clear error so the user knows to convert to .docx or PDF.
    throw new Error('Legacy .doc files are not supported — please save as .docx or PDF and re-upload.')
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   || mimeType === 'application/vnd.ms-excel'
   || ext === 'xlsx' || ext === 'xls') {
    // SheetJS 0.18.5 has known CVEs (prototype pollution + ReDoS) that are
    // triggered by crafted XLSX content. We can't easily preempt synchronous
    // parsing, but bounding the input size + cell count covers the practical
    // exploitation paths while we wait for a SheetJS replacement.
    const XLSX_MAX_BYTES = 5 * 1024 * 1024     // 5 MB raw upload
    const XLSX_MAX_CELLS = 100_000             // 100k cells across all sheets
    if (buffer.length > XLSX_MAX_BYTES) {
      throw new Error(`Spreadsheet too large — max ${XLSX_MAX_BYTES / 1024 / 1024}MB. Save as CSV or split the sheet and try again.`)
    }
    const xlsx = await import('xlsx')
    const wb = xlsx.read(buffer, { type: 'buffer' })
    let totalCells = 0
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      if (!sheet?.['!ref']) continue
      const range = xlsx.utils.decode_range(sheet['!ref'])
      const rows  = (range.e.r - range.s.r) + 1
      const cols  = (range.e.c - range.s.c) + 1
      totalCells += rows * cols
    }
    if (totalCells > XLSX_MAX_CELLS) {
      throw new Error(`Spreadsheet too dense — max ${XLSX_MAX_CELLS.toLocaleString()} cells across all sheets. Trim the sheet or save as CSV and try again.`)
    }
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      lines.push(`--- Sheet: ${sheetName} ---`)
      const sheet = wb.Sheets[sheetName]
      if (!sheet) continue
      const csv = xlsx.utils.sheet_to_csv(sheet)
      lines.push(csv)
    }
    return lines.join('\n')
  }

  if (mimeType === 'text/csv' || ext === 'csv'
   || mimeType === 'text/plain' || ext === 'txt'
   || mimeType === 'text/markdown' || ext === 'md') {
    return buffer.toString('utf8')
  }

  throw new Error(`Unsupported file type: ${mimeType}`)
}

// ── Public service surface ────────────────────────────────────────────────────

export interface UploadInput {
  tenantId:       string
  uploadedById:   string
  filename:       string
  mimeType:       string
  buffer:         Buffer
  capBytes:       bigint     // tenant's total cap (entitlement-derived)
}

export interface KbFile {
  id:               string
  filename:         string
  mimeType:         string
  sizeBytes:        number
  extractionStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  errorMessage:     string | null
  uploadedAt:       string
  hasText:          boolean
}

function toKbFile(row: {
  id: string; filename: string; mimeType: string; sizeBytes: number
  extractionStatus: string; errorMessage: string | null
  uploadedAt: Date; extractedText: string | null
}): KbFile {
  return {
    id:               row.id,
    filename:         row.filename,
    mimeType:         row.mimeType,
    sizeBytes:        row.sizeBytes,
    extractionStatus: row.extractionStatus as KbFile['extractionStatus'],
    errorMessage:     row.errorMessage,
    uploadedAt:       row.uploadedAt.toISOString(),
    hasText:          !!row.extractedText && row.extractedText.length > 0,
  }
}

export async function uploadKbFile(input: UploadInput): Promise<KbFile> {
  if (!isAllowedType(input.mimeType)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `File type not supported: ${input.mimeType}. Allowed: ${Object.values(ALLOWED_TYPES).join(', ')}.`,
      422,
    )
  }
  if (input.buffer.byteLength > KB_MAX_FILE_BYTES) {
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      `File too large. Max ${Math.floor(KB_MAX_FILE_BYTES / (1024 * 1024))} MB per file.`,
      413,
    )
  }
  if (input.buffer.byteLength === 0) {
    throw new AppError('VALIDATION_ERROR', 'Empty file', 422)
  }

  const tenant = await prisma.tenant.findUnique({
    where:  { id: input.tenantId },
    select: { kbStorageUsedBytes: true },
  })
  const usedBytes = tenant?.kbStorageUsedBytes ?? BigInt(0)
  const newTotal = usedBytes + BigInt(input.buffer.byteLength)
  if (newTotal > input.capBytes) {
    const usedMb = Number(usedBytes / BigInt(1024 * 1024))
    const capMb  = Number(input.capBytes / BigInt(1024 * 1024))
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      `Knowledge base full. ${usedMb} MB used of ${capMb} MB. Delete a file or upgrade your plan.`,
      413,
    )
  }

  const config = await getBunnyConfig()
  if (!config) {
    throw new AppError('BAD_REQUEST', 'File storage is not configured. Contact support.', 400)
  }

  // Allocate ID up front so we can use it as the storage key.
  const id   = crypto.randomUUID()
  const ext  = extOf(input.filename)
  const path = buildKbPath(input.tenantId, id, ext)

  await uploadBufferToBunny(config, path, input.buffer, input.mimeType)

  const created = await prisma.knowledgeBaseFile.create({
    data: {
      id,
      tenantId:        input.tenantId,
      filename:        input.filename.slice(0, 250),
      mimeType:        input.mimeType,
      sizeBytes:       input.buffer.byteLength,
      bunnyStorageKey: path,
      uploadedById:    input.uploadedById,
      extractionStatus: 'PENDING',
    },
  })

  // Increment tenant's KB storage pool (separate from voice-recording pool).
  await prisma.tenant.update({
    where: { id: input.tenantId },
    data:  { kbStorageUsedBytes: { increment: BigInt(input.buffer.byteLength) } },
  })

  writeAuditLog({
    actorType:   'USER',
    actorUserId: input.uploadedById,
    tenantId:    input.tenantId,
    action:      'kb.file.uploaded',
    targetType:  'KnowledgeBaseFile',
    targetId:    id,
    metadataJson: {
      filename:  created.filename,
      mimeType:  created.mimeType,
      sizeBytes: created.sizeBytes,
    },
  }).catch(e => console.error('[kb][audit] write failed:', e))

  // Fire-and-forget extraction. The buffer stays in memory via closure
  // until the extract finishes — no re-fetch from Bunny.
  setImmediate(() => {
    runExtraction(id, input.buffer, input.mimeType, input.filename)
      .catch(e => console.error('[kb][extract] unhandled:', e))
  })

  return toKbFile(created)
}

async function runExtraction(
  id: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<void> {
  await prisma.knowledgeBaseFile.update({
    where: { id },
    data:  { extractionStatus: 'PROCESSING' },
  })
  try {
    const text = await extractText(buffer, mimeType, filename)
    await prisma.knowledgeBaseFile.update({
      where: { id },
      data: {
        extractionStatus: 'READY',
        extractedText:    text,
        errorMessage:     null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown extraction error'
    await prisma.knowledgeBaseFile.update({
      where: { id },
      data: {
        extractionStatus: 'FAILED',
        errorMessage:     message.slice(0, 1000),
      },
    })
  }
}

export async function listKbFiles(tenantId: string): Promise<KbFile[]> {
  const rows = await prisma.knowledgeBaseFile.findMany({
    where:   { tenantId },
    orderBy: { uploadedAt: 'desc' },
  })
  return rows.map(toKbFile)
}

export async function deleteKbFile(tenantId: string, id: string, actingUserId: string): Promise<void> {
  const row = await prisma.knowledgeBaseFile.findFirst({ where: { id, tenantId } })
  if (!row) throw new AppError('NOT_FOUND', 'File not found', 404)

  const config = await getBunnyConfig()
  if (config) {
    // Best-effort delete; if it fails we still remove the DB row so the
    // tenant's storage pool reflects reality.
    try { await deleteFromBunny(config, row.bunnyStorageKey) }
    catch (e) { console.error('[kb][delete] bunny delete failed:', e) }
  }

  await prisma.knowledgeBaseFile.delete({ where: { id } })

  await prisma.tenant.update({
    where: { id: tenantId },
    data:  { kbStorageUsedBytes: { decrement: BigInt(row.sizeBytes) } },
  })

  writeAuditLog({
    actorType:   'USER',
    actorUserId: actingUserId,
    tenantId,
    action:      'kb.file.deleted',
    targetType:  'KnowledgeBaseFile',
    targetId:    id,
    metadataJson: {
      filename:  row.filename,
      sizeBytes: row.sizeBytes,
    },
  }).catch(e => console.error('[kb][audit] write failed:', e))
}

export async function getKbUsage(tenantId: string, capBytes: bigint): Promise<{
  usedBytes: bigint
  capBytes:  bigint
  pct:       number
  fileCount: number
}> {
  const [tenant, count] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { kbStorageUsedBytes: true } }),
    prisma.knowledgeBaseFile.count({ where: { tenantId } }),
  ])
  const usedBytes = tenant?.kbStorageUsedBytes ?? BigInt(0)
  const pct = capBytes > BigInt(0) ? Number(usedBytes) / Number(capBytes) * 100 : 0
  return { usedBytes, capBytes, pct, fileCount: count }
}

/** Download a file's blob from Bunny — used by the API "view original"
 *  endpoint. Throws if the file isn't found or Bunny config is missing. */
export async function downloadKbFile(tenantId: string, id: string): Promise<{
  buffer: Buffer
  mimeType: string
  filename: string
}> {
  const row = await prisma.knowledgeBaseFile.findFirst({ where: { id, tenantId } })
  if (!row) throw new AppError('NOT_FOUND', 'File not found', 404)
  const config = await getBunnyConfig()
  if (!config) throw new AppError('BAD_REQUEST', 'File storage is not configured', 400)
  const buffer = await downloadFromBunny(config, row.bunnyStorageKey)
  return { buffer, mimeType: row.mimeType, filename: row.filename }
}

/** Fetch the concatenated extracted-text knowledge base for a tenant,
 *  capped at maxChars (≈ maxChars / 4 tokens). Returns null if no
 *  READY files exist. Used by the prompt resolver to inject reference
 *  documents into Layer 5. */
export async function fetchKbForPrompt(
  tenantId: string,
  maxChars = 120_000,  // ~30k tokens at ~4 chars/token, fits comfortably in gpt-4o-mini
): Promise<string | null> {
  const rows = await prisma.knowledgeBaseFile.findMany({
    where:   { tenantId, extractionStatus: 'READY' },
    select:  { filename: true, extractedText: true },
    orderBy: { uploadedAt: 'asc' },
  })
  if (rows.length === 0) return null

  const parts: string[] = []
  let used = 0
  let truncated = false
  for (const row of rows) {
    const txt = row.extractedText ?? ''
    if (!txt) continue
    const header = `\n\n=== ${row.filename} ===\n`
    const remaining = maxChars - used - header.length
    if (remaining <= 0) { truncated = true; break }
    if (txt.length <= remaining) {
      parts.push(header + txt)
      used += header.length + txt.length
    } else {
      parts.push(header + txt.slice(0, remaining))
      used += header.length + remaining
      truncated = true
      break
    }
  }
  if (parts.length === 0) return null

  let result = parts.join('')
  if (truncated) {
    result += '\n\n(Reference documents truncated due to size. If a caller asks about something not covered here, ask them to be more specific or offer to send a follow-up.)'
  }
  return result
}

/** Boot-time recovery: any file stuck in PROCESSING > 5 min from a prior
 *  crash gets reset to PENDING so it isn't orphaned. We don't auto-retry
 *  the extraction (the original buffer is gone) — the user can delete +
 *  re-upload, or we add a fetch-from-bunny re-extract path later. */
export async function recoverStuckExtractions(): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const result = await prisma.knowledgeBaseFile.updateMany({
    where: {
      extractionStatus: 'PROCESSING',
      updatedAt: { lt: fiveMinAgo },
    },
    data: {
      extractionStatus: 'FAILED',
      errorMessage:     'Extraction interrupted. Please delete and re-upload.',
    },
  })
  if (result.count > 0) {
    console.log(`[kb][recover] marked ${result.count} stuck PROCESSING files as FAILED`)
  }
  return result.count
}
