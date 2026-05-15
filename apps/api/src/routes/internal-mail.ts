import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser'
import { prisma } from '../lib/prisma.js'
import { AppError } from '@voiceautomation/shared'
import { sendEmail } from '../services/email.service.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * Internal mail ingestion route — called by the host's Postfix pipe transport.
 *
 * Flow:
 *   1. Postfix receives mail at *@myorbisresults.com
 *   2. virtual_alias_maps catchall pipes raw email to /usr/local/bin/orbis-mail-ingest.sh
 *   3. The shell script POSTs the raw RFC 5322 message to this endpoint with the
 *      MAIL_INGEST_TOKEN as a header and the original recipient address as a header
 *   4. We parse with mailparser, extract recipients, look up Partner(s) by slug,
 *      insert an Email row per matching partner, and optionally forward each one
 *      to that partner's user.email (their Gmail) if forwardPlatformEmails=true.
 *   5. If no partner matches, we fall back to an "unrouted" audit log entry so
 *      stray mail to @myorbisresults.com isn't silently dropped.
 *
 * Auth: a single shared secret in `x-mail-ingest-token` matched against the
 * MAIL_INGEST_TOKEN env var via constant-time compare (same pattern as
 * internal-gateway). The endpoint is NOT mounted under the public auth stack.
 */

const router: IRouter = Router()

const ALLOWED_DOMAIN = 'myorbisresults.com'

// ─── Auth middleware ────────────────────────────────────────────────────────

function internalMailAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env['MAIL_INGEST_TOKEN']
  const provided = req.headers['x-mail-ingest-token']

  if (!expected || expected.length < 16) {
    next(new AppError('UNAUTHORIZED', 'Mail ingest token not configured', 401))
    return
  }
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    next(new AppError('UNAUTHORIZED', 'Invalid mail ingest token', 401))
    return
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    next(new AppError('UNAUTHORIZED', 'Invalid mail ingest token', 401))
    return
  }
  next()
}

router.use('/internal/mail', internalMailAuth)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractAddresses(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return []
  const arr = Array.isArray(field) ? field : [field]
  const out: string[] = []
  for (const ao of arr) {
    for (const a of ao.value) {
      if (a.address) out.push(a.address.toLowerCase())
    }
  }
  return out
}

function formatAddressList(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return []
  const arr = Array.isArray(field) ? field : [field]
  const out: string[] = []
  for (const ao of arr) {
    for (const a of ao.value) {
      if (!a.address) continue
      out.push(a.name ? `${a.name} <${a.address}>` : a.address)
    }
  }
  return out
}

function slugFromAddress(addr: string): string | null {
  const lower = addr.toLowerCase().trim()
  const [local, domain] = lower.split('@')
  if (!local || domain !== ALLOWED_DOMAIN) return null
  // Strip + suffix (alex.rivera+tag@... -> alex.rivera) — common for tagged subaddressing
  const base = local.split('+')[0]
  return base || null
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/internal/mail/ingest
 * Body: raw RFC 5322 message (Content-Type: application/octet-stream or text/plain)
 * Header: x-mail-ingest-token
 * Header (optional): x-original-recipient — what Postfix had as the envelope recipient
 *                    (used when there's an SMTP-level recipient distinct from the To: header)
 */
router.post('/internal/mail/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Raw body is buffered into req.body by the raw-body parser mounted at app level
    const raw: Buffer | string = req.body
    if (!raw || (typeof raw !== 'string' && !Buffer.isBuffer(raw))) {
      throw new AppError('VALIDATION_ERROR', 'Empty or invalid request body', 422)
    }
    const rawText = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf-8')

    const parsed: ParsedMail = await simpleParser(rawText)

    const envelopeRecipient = (req.headers['x-original-recipient'] as string | undefined)?.toLowerCase()
    const toAddrs   = extractAddresses(parsed.to)
    const ccAddrs   = extractAddresses(parsed.cc)
    const bccAddrs  = extractAddresses(parsed.bcc)
    const allRcpts  = [...new Set([
      ...(envelopeRecipient ? [envelopeRecipient] : []),
      ...toAddrs, ...ccAddrs, ...bccAddrs,
    ])]

    // Look up partners for each recipient matching our domain
    const slugs = allRcpts
      .map(slugFromAddress)
      .filter((s): s is string => Boolean(s))
    const uniqueSlugs = [...new Set(slugs)]

    if (uniqueSlugs.length === 0) {
      // No matching partner. Log + drop.
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'mail.ingest.unrouted',
        targetType: 'Email',
        metadataJson: {
          envelopeRecipient,
          to: toAddrs, cc: ccAddrs,
          fromAddress: parsed.from?.value[0]?.address ?? null,
          subject: parsed.subject ?? null,
          reason: 'no_matching_partner_slug',
        },
      })
      res.json({ data: { stored: 0, forwarded: 0, partners: [], reason: 'no_matching_partner_slug' } })
      return
    }

    // Skip soft-deleted partners — inbound mail to a deleted partner's slug
    // must NOT be delivered. The slug is preserved in the row for audit /
    // restore, but the alias is treated as nonexistent for incoming mail.
    const partners = await prisma.affiliateAccount.findMany({
      where: { slug: { in: uniqueSlugs }, deletedAt: null },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    })

    if (partners.length === 0) {
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'mail.ingest.unrouted',
        targetType: 'Email',
        metadataJson: {
          envelopeRecipient, slugs: uniqueSlugs,
          fromAddress: parsed.from?.value[0]?.address ?? null,
          subject: parsed.subject ?? null,
          reason: 'no_partner_records_for_slugs',
        },
      })
      res.json({ data: { stored: 0, forwarded: 0, partners: [], reason: 'no_partner_records_for_slugs' } })
      return
    }

    const fromAddress = parsed.from?.value[0]?.address ?? ''
    const fromName    = parsed.from?.value[0]?.name ?? ''
    const fromHeader  = fromName ? `${fromName} <${fromAddress}>` : fromAddress
    const subject     = parsed.subject ?? '(no subject)'
    const messageId   = parsed.messageId ?? null
    const inReplyTo   = (parsed.inReplyTo as string | undefined) ?? null
    const receivedAt  = parsed.date ?? new Date()

    // Threading: simplest heuristic — use inReplyTo's referenced messageId if we
    // can find an existing Email with that messageId for this partner; else
    // start a fresh thread keyed by this message's own messageId or a fallback
    // synthetic id.
    let stored = 0
    let forwarded = 0
    const results: Array<{ partnerId: string; emailId: string; forwarded: boolean }> = []

    for (const partner of partners) {
      // Find an existing thread if this is a reply
      let threadId: string | null = null
      if (inReplyTo) {
        const referenced = await prisma.email.findFirst({
          where: { partnerId: partner.id, messageId: inReplyTo },
          select: { threadId: true, id: true },
        })
        if (referenced?.threadId) threadId = referenced.threadId
        else if (referenced) threadId = referenced.id
      }
      if (!threadId) threadId = messageId ?? null  // start a fresh thread off this message

      const email = await prisma.email.create({
        data: {
          partnerId:   partner.id,
          threadId,
          messageId,
          inReplyTo,
          direction:   'INBOUND',
          fromAddress: fromHeader || fromAddress || 'unknown',
          toAddresses: formatAddressList(parsed.to),
          ccAddresses: ccAddrs.length ? formatAddressList(parsed.cc) : undefined,
          bccAddresses: bccAddrs.length ? formatAddressList(parsed.bcc) : undefined,
          subject,
          htmlBody:    parsed.html || null,
          textBody:    parsed.text || null,
          attachmentsJson: parsed.attachments?.length
            ? parsed.attachments.map(att => ({
                filename:    att.filename ?? 'attachment',
                contentType: att.contentType ?? 'application/octet-stream',
                size:        att.size ?? 0,
              }))
            : undefined,
          deliveryStatus: 'delivered',
          receivedAt,
        },
      })
      stored += 1

      // Forward to the partner's registration email if their toggle is ON
      let didForward = false
      if (partner.forwardPlatformEmails && partner.user.email) {
        const partnerAlias = `${partner.slug}@${ALLOWED_DOMAIN}`
        const forwardHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:12px 16px;background:#f6fafa;border-left:3px solid #1a9898;margin-bottom:16px;font-size:13px;color:#555">
            <strong>MyOrbisResults Mailbox forward</strong> · Sent to your <code>${partnerAlias}</code> address.<br>
            Reply from your <a href="https://app.myorbisvoice.com/partner/mailbox">Partner Mailbox</a> to keep the thread on-platform.
          </div>
          <div><strong>From:</strong> ${escapeHtml(fromHeader)}</div>
          <div><strong>Subject:</strong> ${escapeHtml(subject)}</div>
          <hr>
          ${parsed.html || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(parsed.text ?? '')}</pre>`}
        `
        try {
          await sendEmail({
            to: partner.user.email,
            subject: `[${partnerAlias}] ${subject}`,
            html: forwardHtml,
          })
          didForward = true
          forwarded += 1
        } catch (fwdErr) {
          console.warn('[mail.ingest] forward failed for partner', partner.id, (fwdErr as Error).message)
        }
      }

      results.push({ partnerId: partner.id, emailId: email.id, forwarded: didForward })
    }

    await writeAuditLog({
      actorType: 'SYSTEM',
      action: 'mail.ingest.routed',
      targetType: 'Email',
      metadataJson: {
        envelopeRecipient,
        from: fromAddress,
        subject,
        messageId,
        stored,
        forwarded,
        partnerIds: partners.map(p => p.id),
      },
    })

    res.json({ data: { stored, forwarded, partners: results } })
  } catch (err) {
    next(err)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;': '&#39;'
  ))
}

export default router
