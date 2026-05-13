/**
 * Per-partner landing-page generator.
 *
 * Reads the canonical sample pages at
 *   myorbisresults.com/p/sample/voice-{1,2,3}/index.html
 *   myorbisresults.com/es/p/sample/voice-{1,2,3}/index.html
 * as templates, substitutes each active partner's identity (name, photo,
 * phone, email, slug, business name), and writes out per-partner versions
 * at
 *   myorbisresults.com/p/<slug>/voice-{N}/index.html
 *   myorbisresults.com/es/p/<slug>/voice-{N}/index.html
 *
 * The substitution is a deliberate sequence of string replacements (longest
 * first) rather than a templating engine — the source files are real working
 * pages, not Mustache, so this generator keeps them deployable as-is and
 * doesn't need anyone to maintain a second copy with placeholders.
 *
 * Usage:
 *   pnpm generate:partner-pages              # all active partners
 *   pnpm generate:partner-pages -- --slug X  # just one partner
 *   pnpm generate:partner-pages -- --dry     # print what would change, write nothing
 */
import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const REPO_ROOT  = path.resolve(__dirname, '..')
const SITE_ROOT  = path.join(REPO_ROOT, 'myorbisresults.com')
const VARIATIONS = [1, 2, 3] as const
const LOCALES    = [
  { prefix: '',     dir: 'p/sample' },
  { prefix: '/es',  dir: 'es/p/sample' },
] as const

interface PartnerData {
  slug:          string
  firstName:     string
  lastName:      string
  fullName:      string         // "<First> <Last>" or displayName override
  businessName:  string         // brand for the prospect's pitch
  partnerPhone:  string         // human format "+1 (555) 123-4567"
  partnerPhoneTel: string       // tel: format "+15551234567" (E.164)
  partnerEmail:  string         // <slug>@myorbisresults.com
  avatarUrl:     string         // absolute https URL
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const ONLY_SLUG = arg('slug')
const DRY_RUN   = process.argv.includes('--dry')

function bold(s: string) { return `\x1b[1m${s}\x1b[0m` }
function green(s: string) { return `\x1b[32m${s}\x1b[0m` }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m` }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m` }

/** Human-format phone display: takes raw E.164 like "+15551234567" and
 *  returns "+1 (555) 123-4567". Leaves anything non-NANP-shaped alone so
 *  international numbers don't get mangled. */
function formatPhoneHuman(e164: string): string {
  const trimmed = e164.replace(/\s+/g, '')
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(trimmed)
  if (m) return `+1 (${m[1]}) ${m[2]}-${m[3]}`
  return trimmed
}

function readPartnerData(p: {
  slug:           string | null
  displayName:    string | null
  partnerPhone:   string | null
  avatarUrl:      string | null
  businessName:   string | null
  user:           { firstName: string | null; lastName: string | null }
}): PartnerData | null {
  if (!p.slug) return null  // no slug → can't generate

  const firstName   = p.user.firstName ?? ''
  const lastName    = p.user.lastName  ?? ''
  const fullName    = (p.displayName && p.displayName.trim()) || [firstName, lastName].filter(Boolean).join(' ').trim()
  if (!fullName)    return null  // no name on file → can't personalize

  const partnerPhoneTel = (p.partnerPhone ?? '').replace(/[^\d+]/g, '') || '+15551234567'
  return {
    slug:            p.slug,
    firstName:       firstName || fullName.split(' ')[0]!,
    lastName,
    fullName,
    businessName:    (p.businessName && p.businessName.trim()) || fullName,
    partnerPhone:    formatPhoneHuman(partnerPhoneTel),
    partnerPhoneTel,
    partnerEmail:    `${p.slug}@myorbisresults.com`,
    // Fall back to the canonical sample avatar — keeps the page visually
    // complete for partners who haven't uploaded their own photo yet.
    avatarUrl:       p.avatarUrl ?? 'https://myorbisvoice.com/assets/images/partners/sample-partner.jpg',
  }
}

/**
 * Apply Alex-Rivera → partner-X substitutions to the source HTML. Order
 * matters: longer / more specific strings first, so we don't replace "Alex"
 * inside "Alex Rivera" and corrupt the longer form.
 */
function substitute(source: string, p: PartnerData): string {
  let out = source

  // ── Path 1: identity strings (longest first) ───────────────────────────
  // Email + tel-format phone + avatar filename — exact-match replacements.
  out = out.replaceAll('alex@myorbisresults.com', p.partnerEmail)
  out = out.replaceAll('+15551234567',           p.partnerPhoneTel)
  out = out.replaceAll('+1 (555) 123-4567',      p.partnerPhone)
  out = out.replaceAll('(555) 123-4567',         p.partnerPhone)
  // Avatar: any of the path variants the source uses (relative + absolute).
  out = out.replaceAll('../../../assets/images/partners/sample-partner.jpg', p.avatarUrl)
  out = out.replaceAll('/assets/images/partners/sample-partner.jpg',         p.avatarUrl)

  // Full name → partner full name. Do this BEFORE the "Alex" first-name
  // substitution so "Alex Rivera" never collapses to "<firstName> Rivera".
  out = out.replaceAll('Alex Rivera',        p.fullName)
  // Business name (only voice-2 has it explicitly, but check anyway)
  out = out.replaceAll('Rivera Local Marketing', p.businessName)

  // Bare first-name "Alex" → partner first-name. Word boundary so we don't
  // hit a hypothetical "Alexander" or "Alexis" elsewhere in the prose.
  out = out.replace(/\bAlex\b/g, p.firstName)
  // Uppercase comments like "<!-- THE 15 MINUTES WITH ALEX -->".
  out = out.replace(/\bALEX\b/g, p.firstName.toUpperCase())

  // ── Path 2: URL slugs ──────────────────────────────────────────────────
  // canonical / hreflang / og:url reference /p/sample/. The booking CTA
  // links to app.myorbisvoice.com/book/alex.rivera. The widget init JS
  // hard-codes "alex.rivera" as the slug fallback. Patch all three.
  out = out.replaceAll('/p/sample/',    `/p/${p.slug}/`)
  out = out.replaceAll('/es/p/sample/', `/es/p/${p.slug}/`)
  out = out.replaceAll('alex.rivera',    p.slug)  // /book/alex.rivera + JS fallback

  // Remove the legacy sample→alex.rivera alias line — once the URL itself
  // carries the partner slug, no remap is needed and leaving it in would
  // override the correct value when the page is at /p/<slug>/voice-N/.
  out = out.replace(
    /\s*if \(__orbisPartnerSlug === "[a-z0-9.-]+"\) __orbisPartnerSlug = "[a-z0-9.-]+";?\n?/g,
    '\n',
  )

  return out
}

async function generateForPartner(data: PartnerData): Promise<{ wrote: number; skipped: number }> {
  let wrote = 0
  let skipped = 0
  for (const loc of LOCALES) {
    for (const n of VARIATIONS) {
      const src = path.join(SITE_ROOT, loc.dir, `voice-${n}`, 'index.html')
      const dst = path.join(SITE_ROOT, loc.prefix.replace(/^\//, ''), 'p', data.slug, `voice-${n}`, 'index.html')

      let source: string
      try {
        source = await fs.readFile(src, 'utf8')
      } catch {
        console.warn(yellow(`  ⚠ template missing: ${src}`))
        skipped++
        continue
      }
      const generated = substitute(source, data)

      if (DRY_RUN) {
        console.log(dim(`  → would write ${path.relative(REPO_ROOT, dst)} (${generated.length} bytes)`))
        wrote++
        continue
      }
      await fs.mkdir(path.dirname(dst), { recursive: true })
      await fs.writeFile(dst, generated, 'utf8')
      wrote++
    }
  }
  return { wrote, skipped }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const where: { partnerPageActive: true; slug?: string } = { partnerPageActive: true }
    if (ONLY_SLUG) (where as Record<string, unknown>)['slug'] = ONLY_SLUG

    const partners = await prisma.affiliateAccount.findMany({
      where,
      select: {
        slug:          true,
        displayName:   true,
        partnerPhone:  true,
        avatarUrl:     true,
        businessName:  true,
        user:          { select: { firstName: true, lastName: true } },
      },
    })

    if (partners.length === 0) {
      console.log(yellow('No active partners found. Activate at least one in /partner-portal/profile first.'))
      return
    }

    console.log(bold(`Generating per-partner landing pages — ${partners.length} active partner(s)${DRY_RUN ? ' (dry run)' : ''}`))
    if (ONLY_SLUG) console.log(dim(`  filtered to slug=${ONLY_SLUG}`))
    console.log()

    let totalWrote = 0
    let totalSkipped = 0
    for (const p of partners) {
      const data = readPartnerData(p)
      if (!data) {
        console.log(yellow(`✗ ${p.slug ?? '(no slug)'} — skipped (missing slug or name)`))
        continue
      }
      console.log(bold(`▸ ${data.slug}`) + dim(`  (${data.fullName})`))
      const { wrote, skipped } = await generateForPartner(data)
      totalWrote += wrote
      totalSkipped += skipped
      console.log(green(`  ✓ ${wrote} page(s) generated${skipped > 0 ? `, ${skipped} skipped` : ''}`))
    }

    console.log()
    console.log(bold(`Result: ${totalWrote} page(s) ${DRY_RUN ? 'would be written' : 'written'}${totalSkipped > 0 ? `, ${totalSkipped} skipped (missing template)` : ''}`))
    if (!DRY_RUN) {
      console.log(dim('Next: ./infrastructure/scripts/deploy-partner-pages.sh to push to Spaceship'))
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
