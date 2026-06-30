import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'

// Partner script library service (Directory Leads → Scripts tab).
//
// A script is either a partner's OWN script (affiliateAccountId set) or an admin
// DEFAULT template (affiliateAccountId null, isDefault true — global, read-only to
// partners, copyable). All writes go through here (no direct Prisma in routes).
//
// Security: bodyHtml is rich text. The author is the partner (their own private
// scripts) or a platform admin (defaults). Viewers are the same partner + admins,
// so the XSS surface is self/trusted — but we still sanitize on write to strip the
// real vectors (script/style/iframe, event handlers, javascript: URLs) so a stored
// payload can never execute even if a script is later surfaced more widely.

export const SCRIPT_CHANNELS = ['call', 'email', 'sms'] as const
export type ScriptChannel = (typeof SCRIPT_CHANNELS)[number]

function assertChannel(c: string): ScriptChannel {
  if ((SCRIPT_CHANNELS as readonly string[]).includes(c)) return c as ScriptChannel
  throw new AppError('VALIDATION', `Invalid channel: ${c}`, 400)
}

// Allowlist of formatting tags the editor produces. Anything else is dropped
// (tag removed, inner text kept). href is the only attribute we keep.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
  'h2', 'h3', 'blockquote', 'a', 'span', 'div',
])

export function sanitizeScriptHtml(input: string): string {
  let html = String(input ?? '')
  // 1. Remove dangerous element blocks entirely (tag + content).
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\1\s*>/gi, '')
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
  // 2. Strip HTML comments (can hide conditional-comment script in old IE etc.).
  html = html.replace(/<!--[\s\S]*?-->/g, '')
  // 3. Walk every tag: drop disallowed tags (keep inner text), strip all
  //    attributes except a safe href on <a>.
  html = html.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_m, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return '' // drop tag, keep inner text
    if (slash) return `</${name}>`
    if (name === 'a') {
      const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : ''
      const href = rawHref.trim()
      const safe = /^(https?:|mailto:|tel:|\/|#|\{)/i.test(href) && !/^javascript:/i.test(href)
      return safe ? `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">` : '<a>'
    }
    return `<${name}>` // all other allowed tags: no attributes
  })
  return html.trim()
}

const SELECT = {
  id: true, affiliateAccountId: true, isDefault: true, title: true,
  channel: true, bodyHtml: true, sourceDefaultId: true, createdAt: true, updatedAt: true,
} as const

// ── Partner-facing ──────────────────────────────────────────────────────────

/** List a partner's own scripts + the global admin defaults (read-only). */
export async function listForPartner(affiliateAccountId: string) {
  const [own, defaults] = await Promise.all([
    prisma.partnerScript.findMany({ where: { affiliateAccountId }, select: SELECT, orderBy: { updatedAt: 'desc' } }),
    prisma.partnerScript.findMany({ where: { isDefault: true, affiliateAccountId: null }, select: SELECT, orderBy: { title: 'asc' } }),
  ])
  return { own, defaults }
}

/** Read a single script the partner is allowed to see (their own OR a default). */
export async function getForPartner(id: string, affiliateAccountId: string) {
  const s = await prisma.partnerScript.findUnique({ where: { id }, select: SELECT })
  if (!s) throw new AppError('NOT_FOUND', 'Script not found', 404)
  const readable = s.affiliateAccountId === affiliateAccountId || (s.isDefault && s.affiliateAccountId === null)
  if (!readable) throw new AppError('FORBIDDEN', 'Not your script', 403)
  return s
}

export async function createForPartner(
  affiliateAccountId: string,
  userId: string,
  data: { title: string; channel: string; bodyHtml: string },
) {
  return prisma.partnerScript.create({
    data: {
      affiliateAccountId, isDefault: false,
      title: data.title.trim() || 'Untitled script',
      channel: assertChannel(data.channel),
      bodyHtml: sanitizeScriptHtml(data.bodyHtml),
      createdByUserId: userId,
    },
    select: SELECT,
  })
}

export async function updateForPartner(
  id: string,
  affiliateAccountId: string,
  data: { title?: string; channel?: string; bodyHtml?: string },
) {
  const existing = await prisma.partnerScript.findUnique({ where: { id }, select: { affiliateAccountId: true, isDefault: true } })
  if (!existing) throw new AppError('NOT_FOUND', 'Script not found', 404)
  if (existing.isDefault || existing.affiliateAccountId !== affiliateAccountId) {
    throw new AppError('FORBIDDEN', 'You can only edit your own scripts', 403)
  }
  return prisma.partnerScript.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() || 'Untitled script' } : {}),
      ...(data.channel !== undefined ? { channel: assertChannel(data.channel) } : {}),
      ...(data.bodyHtml !== undefined ? { bodyHtml: sanitizeScriptHtml(data.bodyHtml) } : {}),
    },
    select: SELECT,
  })
}

export async function deleteForPartner(id: string, affiliateAccountId: string) {
  const existing = await prisma.partnerScript.findUnique({ where: { id }, select: { affiliateAccountId: true, isDefault: true } })
  if (!existing) throw new AppError('NOT_FOUND', 'Script not found', 404)
  if (existing.isDefault || existing.affiliateAccountId !== affiliateAccountId) {
    throw new AppError('FORBIDDEN', 'You can only delete your own scripts', 403)
  }
  await prisma.partnerScript.delete({ where: { id } })
  return { ok: true }
}

/** Copy a script the partner can read (a default, or one of their own) into a
 *  brand-new editable script owned by the partner. */
export async function copyForPartner(sourceId: string, affiliateAccountId: string, userId: string) {
  const src = await getForPartner(sourceId, affiliateAccountId)
  return prisma.partnerScript.create({
    data: {
      affiliateAccountId, isDefault: false,
      title: `${src.title} (copy)`,
      channel: assertChannel(src.channel),
      bodyHtml: sanitizeScriptHtml(src.bodyHtml),
      sourceDefaultId: src.isDefault ? src.id : src.sourceDefaultId,
      createdByUserId: userId,
    },
    select: SELECT,
  })
}

// ── Admin-facing (default templates) ─────────────────────────────────────────

export async function listDefaults() {
  return prisma.partnerScript.findMany({ where: { isDefault: true, affiliateAccountId: null }, select: SELECT, orderBy: { title: 'asc' } })
}

export async function createDefault(userId: string, data: { title: string; channel: string; bodyHtml: string }) {
  return prisma.partnerScript.create({
    data: {
      affiliateAccountId: null, isDefault: true,
      title: data.title.trim() || 'Untitled default',
      channel: assertChannel(data.channel),
      bodyHtml: sanitizeScriptHtml(data.bodyHtml),
      createdByUserId: userId,
    },
    select: SELECT,
  })
}

export async function updateDefault(id: string, data: { title?: string; channel?: string; bodyHtml?: string }) {
  const existing = await prisma.partnerScript.findUnique({ where: { id }, select: { isDefault: true } })
  if (!existing || !existing.isDefault) throw new AppError('NOT_FOUND', 'Default script not found', 404)
  return prisma.partnerScript.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() || 'Untitled default' } : {}),
      ...(data.channel !== undefined ? { channel: assertChannel(data.channel) } : {}),
      ...(data.bodyHtml !== undefined ? { bodyHtml: sanitizeScriptHtml(data.bodyHtml) } : {}),
    },
    select: SELECT,
  })
}

export async function deleteDefault(id: string) {
  const existing = await prisma.partnerScript.findUnique({ where: { id }, select: { isDefault: true } })
  if (!existing || !existing.isDefault) throw new AppError('NOT_FOUND', 'Default script not found', 404)
  await prisma.partnerScript.delete({ where: { id } })
  return { ok: true }
}
