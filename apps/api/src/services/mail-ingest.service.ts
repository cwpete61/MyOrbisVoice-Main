/**
 * Inbound partner-mail ingestion — parse a raw RFC 5322 message, match the
 * recipient to a partner by `<slug>@myorbisresults.com`, store an Email row (so
 * it shows in that partner's in-app mailbox), and optionally forward to the
 * partner's registration email.
 *
 * Two callers feed this:
 *   1. POST /api/internal/mail/ingest  (legacy Postfix pipe — kept for compat)
 *   2. the IMAP poller job (reads the Spacemail catch-all inbox) ← current path
 *
 * Moving inbound mail to Spacemail bypassed the Postfix pipe; the poller reads
 * the `admin@` catch-all and hands each message here so the routing logic stays
 * in one place. See docs/email-setup.md.
 */
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import { prisma } from '../lib/prisma.js'
import { sendEmail } from './email.service.js'
import { writeAuditLog } from '../lib/audit.js'

export const MAIL_ALLOWED_DOMAIN = 'myorbisresults.com'

function extractAddresses(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return []
  const arr = Array.isArray(field) ? field : [field]
  const out: string[] = []
  for (const ao of arr) for (const a of ao.value) if (a.address) out.push(a.address.toLowerCase())
  return out
}
function formatAddressList(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return []
  const arr = Array.isArray(field) ? field : [field]
  const out: string[] = []
  for (const ao of arr) for (const a of ao.value) {
    if (!a.address) continue
    out.push(a.name ? `${a.name} <${a.address}>` : a.address)
  }
  return out
}
function slugFromAddress(addr: string): string | null {
  const [local, domain] = addr.toLowerCase().trim().split('@')
  if (!local || domain !== MAIL_ALLOWED_DOMAIN) return null
  const base = local.split('+')[0] // strip +tag subaddressing
  return base || null
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'))
}

export interface IngestResult {
  stored: number
  forwarded: number
  partners: Array<{ partnerId: string; emailId: string; forwarded: boolean }>
  reason?: string
}

/**
 * Ingest one raw message. `envelopeRecipient` is the real delivered-to address
 * when known (catch-all mail carries the true `<slug>@` recipient in
 * Delivered-To/X-Original-To rather than the To: header).
 */
export async function ingestRawMessage(raw: Buffer | string, envelopeRecipient?: string): Promise<IngestResult> {
  const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf-8')
  const parsed: ParsedMail = await simpleParser(rawBuf)

  const env = envelopeRecipient?.toLowerCase()
  const toAddrs = extractAddresses(parsed.to)
  const ccAddrs = extractAddresses(parsed.cc)
  const bccAddrs = extractAddresses(parsed.bcc)
  const allRcpts = [...new Set([...(env ? [env] : []), ...toAddrs, ...ccAddrs, ...bccAddrs])]

  const uniqueSlugs = [...new Set(allRcpts.map(slugFromAddress).filter((s): s is string => Boolean(s)))]

  if (uniqueSlugs.length === 0) {
    await writeAuditLog({
      actorType: 'SYSTEM', action: 'mail.ingest.unrouted', targetType: 'Email',
      metadataJson: { envelopeRecipient: env, to: toAddrs, cc: ccAddrs, fromAddress: parsed.from?.value[0]?.address ?? null, subject: parsed.subject ?? null, reason: 'no_matching_partner_slug' },
    })
    return { stored: 0, forwarded: 0, partners: [], reason: 'no_matching_partner_slug' }
  }

  const partners = await prisma.affiliateAccount.findMany({
    where: { slug: { in: uniqueSlugs }, deletedAt: null },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  })
  if (partners.length === 0) {
    await writeAuditLog({
      actorType: 'SYSTEM', action: 'mail.ingest.unrouted', targetType: 'Email',
      metadataJson: { envelopeRecipient: env, slugs: uniqueSlugs, fromAddress: parsed.from?.value[0]?.address ?? null, subject: parsed.subject ?? null, reason: 'no_partner_records_for_slugs' },
    })
    return { stored: 0, forwarded: 0, partners: [], reason: 'no_partner_records_for_slugs' }
  }

  const fromAddress = parsed.from?.value[0]?.address ?? ''
  const fromName = parsed.from?.value[0]?.name ?? ''
  const fromHeader = fromName ? `${fromName} <${fromAddress}>` : fromAddress
  const subject = parsed.subject ?? '(no subject)'
  const messageId = parsed.messageId ?? null
  const inReplyTo = (parsed.inReplyTo as string | undefined) ?? null
  const receivedAt = parsed.date ?? new Date()

  let stored = 0, forwarded = 0
  const results: IngestResult['partners'] = []

  for (const partner of partners) {
    // Idempotency — the poller can re-see a message; don't double-store.
    if (messageId) {
      const dup = await prisma.email.findFirst({ where: { partnerId: partner.id, messageId, direction: 'INBOUND' }, select: { id: true } })
      if (dup) { results.push({ partnerId: partner.id, emailId: dup.id, forwarded: false }); continue }
    }

    let threadId: string | null = null
    if (inReplyTo) {
      const referenced = await prisma.email.findFirst({ where: { partnerId: partner.id, messageId: inReplyTo }, select: { threadId: true, id: true } })
      if (referenced?.threadId) threadId = referenced.threadId
      else if (referenced) threadId = referenced.id
    }
    if (!threadId) threadId = messageId ?? null

    const email = await prisma.email.create({
      data: {
        partnerId: partner.id, threadId, messageId, inReplyTo, direction: 'INBOUND',
        fromAddress: fromHeader || fromAddress || 'unknown',
        toAddresses: formatAddressList(parsed.to),
        ccAddresses: ccAddrs.length ? formatAddressList(parsed.cc) : undefined,
        bccAddresses: bccAddrs.length ? formatAddressList(parsed.bcc) : undefined,
        subject, htmlBody: parsed.html || null, textBody: parsed.text || null,
        attachmentsJson: parsed.attachments?.length
          ? parsed.attachments.map((att) => ({ filename: att.filename ?? 'attachment', contentType: att.contentType ?? 'application/octet-stream', size: att.size ?? 0 }))
          : undefined,
        deliveryStatus: 'delivered', receivedAt,
      },
    })
    stored += 1

    let didForward = false
    if (partner.forwardPlatformEmails && partner.user.email) {
      const partnerAlias = `${partner.slug}@${MAIL_ALLOWED_DOMAIN}`
      const forwardHtml =
        `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 16px;background:#f6fafa;border-left:3px solid #1a9898;margin-bottom:16px;font-size:13px;color:#555"><strong>MyOrbisResults Mailbox forward</strong> · Sent to your <code>${partnerAlias}</code> address.<br>Reply from your <a href="https://app.myorbisvoice.com/partner/mailbox">Partner Mailbox</a> to keep the thread on-platform.</div>` +
        `<div><strong>From:</strong> ${escapeHtml(fromHeader)}</div><div><strong>Subject:</strong> ${escapeHtml(subject)}</div><hr>` +
        (parsed.html || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(parsed.text ?? '')}</pre>`)
      try {
        await sendEmail({ to: partner.user.email, subject: `[${partnerAlias}] ${subject}`, html: forwardHtml })
        didForward = true; forwarded += 1
      } catch (fwdErr) {
        console.warn('[mail.ingest] forward failed for partner', partner.id, (fwdErr as Error).message)
      }
    }
    results.push({ partnerId: partner.id, emailId: email.id, forwarded: didForward })
  }

  await writeAuditLog({
    actorType: 'SYSTEM', action: 'mail.ingest.routed', targetType: 'Email',
    metadataJson: { envelopeRecipient: env, from: fromAddress, subject, messageId, stored, forwarded, partnerIds: partners.map((p) => p.id) },
  })
  return { stored, forwarded, partners: results }
}
