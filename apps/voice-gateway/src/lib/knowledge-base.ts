/**
 * Pulls the tenant's knowledge-base extracted text for prompt injection.
 * Mirrors the API service's fetchKbForPrompt — same logic, gateway-side
 * Prisma client. Only READY rows; concatenated and capped at maxChars.
 */
import { prisma } from './prisma.js'

const DEFAULT_MAX_CHARS = 120_000  // ~30k tokens at ~4 chars/token

export async function fetchKbForPrompt(
  tenantId: string,
  maxChars = DEFAULT_MAX_CHARS,
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
