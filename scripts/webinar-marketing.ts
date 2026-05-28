#!/usr/bin/env tsx
/**
 * Webinar Marketing CLI.
 *
 * One-file dispatcher with subcommands. Run from repo root:
 *
 *   pnpm tsx scripts/webinar-marketing.ts <command> [args...]
 *
 * Commands:
 *   verify-email <email>
 *       Run the in-house classifier + Reoon (if configured) on a single
 *       address. Prints classification, verification status, score-ish.
 *
 *   verify-csv <path> [--column=email]
 *       Read a CSV file, verify each row's email column (default: "email"),
 *       print one result line per email. Does NOT write to the DB — pipe to
 *       a file for offline triage.
 *
 *   review-quarantine <partner-slug> [--list=<listId>]
 *       List quarantined emails for a partner (optionally one list).
 *
 *   promote-qualified <partner-slug> --list=<listId> [--consent=...]
 *           [--notes="..."] [--all]
 *       Bulk-promote eligible quarantined rows to WebinarInviteContact
 *       with the supplied consent. Default: dry-run unless --apply is set.
 *
 *   export-list --list=<listId> [--out=path.csv]
 *       Print or write CSV export of WebinarInviteContact rows for a list.
 *
 *   import-disposable-domains <path>
 *       Import additional disposable-domain entries. (No-op stub — disposable
 *       list ships from npm package. Reserved for future per-partner override.)
 *
 *   import-free-mail-domains <path>
 *       Same shape — reserved.
 *
 * Examples:
 *   pnpm tsx scripts/webinar-marketing.ts verify-email info@example.com
 *   pnpm tsx scripts/webinar-marketing.ts verify-csv leads.csv --column=Email
 *   pnpm tsx scripts/webinar-marketing.ts review-quarantine acme-dental
 *   pnpm tsx scripts/webinar-marketing.ts export-list --list=abc-123 --out=invites.csv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { classifyEmail } from '../apps/api/src/services/webinar-marketing/classifier.service.js'
import { checkDomainDns } from '../apps/api/src/services/webinar-marketing/dns-checker.service.js'
import { ReoonAdapter } from '../apps/api/src/services/webinar-marketing/verifier/reoon.adapter.js'
import { InternalDnsAdapter } from '../apps/api/src/services/webinar-marketing/verifier/internal-dns.adapter.js'
import { promoteToInvite } from '../apps/api/src/services/webinar-marketing/promotion.service.js'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp()
    return
  }
  try {
    switch (cmd) {
      case 'verify-email':       return await cmdVerifyEmail(rest)
      case 'verify-csv':         return await cmdVerifyCsv(rest)
      case 'review-quarantine':  return await cmdReviewQuarantine(rest)
      case 'promote-qualified':  return await cmdPromoteQualified(rest)
      case 'export-list':        return await cmdExportList(rest)
      case 'import-disposable-domains':
      case 'import-free-mail-domains':
        console.log(
          `[${cmd}] no-op. Disposable + free-mail lists ship from the\n` +
          `disposable-email-domains npm package and the classifier service.\n` +
          `Per-partner overrides are reserved for a future schema update.`,
        )
        return
      default:
        console.error(`Unknown command: ${cmd}\n`)
        printHelp()
        process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// ─── verify-email ────────────────────────────────────────────────────────────

async function cmdVerifyEmail(args: string[]): Promise<void> {
  const email = args[0]
  if (!email) {
    console.error('verify-email <email> — missing argument')
    process.exit(1)
  }
  const classification = classifyEmail({ normalizedEmail: email })
  console.log(`email:           ${email}`)
  console.log(`classification:  ${classification.emailType}`)
  console.log(`reason:          ${classification.reason}`)
  console.log(`localPart:       ${classification.localPart}`)
  console.log(`domain:          ${classification.domain}`)

  if (
    classification.emailType === 'INVALID_FORMAT' ||
    classification.emailType === 'DISPOSABLE_DOMAIN' ||
    classification.emailType === 'NO_REPLY_OR_SUPPRESSED'
  ) {
    console.log('verification:    skipped (classifier rejects)')
    return
  }

  if (classification.domain) {
    const dns = await checkDomainDns(classification.domain)
    console.log(`dns:             A=${dns.hasA} MX=${dns.hasMx}`)
  }

  // Try Reoon, fall back to internal-DNS adapter on no-key/quota.
  const reoon = new ReoonAdapter()
  const reoonResult = await reoon.verify(email)
  if (reoonResult.status !== 'unknown' || reoonResult.reason !== 'no_api_key') {
    console.log(
      `verifier(reoon): status=${reoonResult.status} reason=${reoonResult.reason} disposable=${reoonResult.disposable}`,
    )
    return
  }
  const internal = await new InternalDnsAdapter().verify(email)
  console.log(
    `verifier(in-house): status=${internal.status} reason=${internal.reason}`,
  )
}

// ─── verify-csv ──────────────────────────────────────────────────────────────

async function cmdVerifyCsv(args: string[]): Promise<void> {
  const path = args[0]
  if (!path) {
    console.error('verify-csv <path> — missing argument')
    process.exit(1)
  }
  if (!existsSync(path)) {
    console.error(`file not found: ${path}`)
    process.exit(1)
  }
  const column = (args.find((a) => a.startsWith('--column='))?.split('=')[1] ?? 'email').toLowerCase()

  const raw = readFileSync(path, 'utf8')
  const rows = parseCsv(raw)
  const header = rows[0]?.map((c) => c.toLowerCase()) ?? []
  const colIdx = header.indexOf(column)
  if (colIdx < 0) {
    console.error(`column "${column}" not found. Available: ${header.join(', ')}`)
    process.exit(1)
  }

  // Stream-print results — one per line as TSV for easy `cut`/`grep`.
  console.log('email\temailType\treason')
  for (let i = 1; i < rows.length; i++) {
    const email = rows[i]?.[colIdx]?.trim()
    if (!email) continue
    const c = classifyEmail({ normalizedEmail: email })
    console.log(`${email}\t${c.emailType}\t${c.reason}`)
  }
}

// ─── review-quarantine ───────────────────────────────────────────────────────

async function cmdReviewQuarantine(args: string[]): Promise<void> {
  const partnerSlug = args[0]
  if (!partnerSlug) {
    console.error('review-quarantine <partner-slug> [--list=<listId>] — missing slug')
    process.exit(1)
  }
  const listId = args.find((a) => a.startsWith('--list='))?.split('=')[1]
  const partner = await prisma.affiliateAccount.findFirst({
    where: { slug: partnerSlug },
    select: { id: true, slug: true },
  })
  if (!partner) {
    console.error(`partner not found: ${partnerSlug}`)
    process.exit(1)
  }
  const rows = await prisma.webinarExtractedEmail.findMany({
    where: {
      classificationStatus: 'QUARANTINED',
      leadList: {
        partnerId: partner.id,
        ...(listId ? { id: listId } : {}),
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      leadList: { select: { id: true, name: true } },
      verifications: { orderBy: { verifiedAt: 'desc' }, take: 1 },
    },
  })
  console.log(`Quarantine for ${partnerSlug}: ${rows.length} row(s)`)
  for (const r of rows) {
    const v = r.verifications[0]
    console.log(
      `  ${r.id.slice(0, 8)}  ${r.emailType ?? '?'.padEnd(20)}  ${r.email.padEnd(40)}  ${v ? `${v.provider}:${v.providerStatus}` : 'unverified'}  [list:${r.leadList.name}]`,
    )
  }
}

// ─── promote-qualified ───────────────────────────────────────────────────────

async function cmdPromoteQualified(args: string[]): Promise<void> {
  const listId = args.find((a) => a.startsWith('--list='))?.split('=')[1]
  if (!listId) {
    console.error('promote-qualified --list=<listId> [--apply] [--consent=...] [--notes="..."]')
    process.exit(1)
  }
  const apply = args.includes('--apply')
  const consent = (args.find((a) => a.startsWith('--consent='))?.split('=')[1] ?? 'MANUAL_LAWFUL_BASIS_REVIEWED') as
    | 'OPTED_IN'
    | 'EXISTING_CUSTOMER'
    | 'MANUAL_LAWFUL_BASIS_REVIEWED'
  const notes =
    args.find((a) => a.startsWith('--notes='))?.split('=')[1] ??
    'Promoted via CLI from public business contact page.'

  const candidates = await prisma.webinarExtractedEmail.findMany({
    where: {
      leadListId: listId,
      classificationStatus: 'CLASSIFIED',
      emailType: { in: ['BUSINESS_DOMAIN', 'ROLE_BASED_BUSINESS'] },
    },
    take: 500,
  })
  console.log(
    `Candidates: ${candidates.length}. ${apply ? 'APPLYING' : 'DRY-RUN — pass --apply to commit.'}`,
  )
  let ok = 0
  let blocked = 0
  for (const c of candidates) {
    if (!apply) {
      console.log(`  would promote ${c.email} (${c.emailType})`)
      continue
    }
    const r = await promoteToInvite({
      extractedEmailId: c.id,
      consentStatus: consent,
      lawfulBasisNotes: notes,
    })
    if (r.ok) {
      ok++
      console.log(`  ✓ ${c.email} → contact:${r.contactId.slice(0, 8)}`)
    } else {
      blocked++
      console.log(`  ✗ ${c.email}: ${r.reason}`)
    }
  }
  if (apply) console.log(`\nPromoted: ${ok}  Blocked: ${blocked}`)
}

// ─── export-list ─────────────────────────────────────────────────────────────

async function cmdExportList(args: string[]): Promise<void> {
  const listId = args.find((a) => a.startsWith('--list='))?.split('=')[1]
  if (!listId) {
    console.error('export-list --list=<listId> [--out=path.csv]')
    process.exit(1)
  }
  const outPath = args.find((a) => a.startsWith('--out='))?.split('=')[1]
  const list = await prisma.webinarLeadList.findUnique({ where: { id: listId } })
  if (!list) {
    console.error(`list not found: ${listId}`)
    process.exit(1)
  }
  const contacts = await prisma.webinarInviteContact.findMany({
    where: { leadListId: list.id, unsubscribedAt: null },
    orderBy: { addedAt: 'asc' },
  })
  const header = [
    'list_name',
    'business_name',
    'email',
    'niche',
    'location',
    'source_url',
    'verification_status',
    'consent_status',
    'lawful_basis_notes',
    'added_at',
  ]
  const lines = [header, ...contacts.map((c) => [
    list.name,
    c.businessName ?? '',
    c.email,
    c.niche,
    c.location,
    c.sourceUrl,
    c.verificationStatus,
    c.consentStatus,
    c.lawfulBasisNotes ?? '',
    c.addedAt.toISOString(),
  ])]
  const csv = lines.map(csvLine).join('\n')
  if (outPath) {
    writeFileSync(outPath, csv, 'utf8')
    console.log(`Wrote ${contacts.length} rows → ${outPath}`)
  } else {
    process.stdout.write(csv + '\n')
  }
}

// ─── shared helpers ──────────────────────────────────────────────────────────

function csvLine(fields: (string | null | undefined)[]): string {
  return fields
    .map((f) => {
      const v = (f ?? '').toString()
      if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`
      return v
    })
    .join(',')
}

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes,
 * commas inside quotes, and \r\n line endings. Enough for operator-supplied
 * lead lists; not a full RFC implementation.
 */
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(field)
        out.push(row)
        row = []
        field = ''
      } else {
        field += ch
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    out.push(row)
  }
  return out
}

function printHelp(): void {
  console.log(`Webinar Marketing CLI

Commands:
  verify-email <email>
  verify-csv <path> [--column=email]
  review-quarantine <partner-slug> [--list=<listId>]
  promote-qualified --list=<listId> [--apply] [--consent=...] [--notes="..."]
  export-list --list=<listId> [--out=path.csv]
  import-disposable-domains <path>     (reserved)
  import-free-mail-domains <path>      (reserved)

Run from repo root via:  pnpm tsx scripts/webinar-marketing.ts <command>
`)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
