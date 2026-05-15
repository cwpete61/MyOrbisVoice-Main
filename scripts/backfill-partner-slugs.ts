/**
 * Backfill AffiliateAccount.slug for any partner where slug IS NULL.
 *
 * Why this exists: applyForAffiliate() shipped without slug-at-creation, so
 * tenant users who applied to be partners ended up with slug=null. Their
 * platform email (<slug>@myorbisresults.com) shows "—" in the profile UI,
 * and the partner-page URL (/p/<slug>/) doesn't resolve.
 *
 * Rule: slug = slugify(firstName.lastName). Falls back to email local-part
 * if names are empty. Collisions get a numeric suffix (alex.rivera2, etc.).
 *
 * Slug is IMMUTABLE after first save — once we set it here, it stays. So
 * the script is safe to re-run: rows where slug is already set are skipped.
 *
 * Run from repo root:
 *   DATABASE_URL=... pnpm tsx scripts/backfill-partner-slugs.ts            # report only (dry-run)
 *   DATABASE_URL=... pnpm tsx scripts/backfill-partner-slugs.ts --write    # apply
 */
import { PrismaClient } from '@prisma/client'
import { generatePartnerSlug } from '../apps/api/src/services/partner.service.js'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')

async function main() {
  const slugless = await prisma.affiliateAccount.findMany({
    where:   { slug: null },
    select:  {
      id: true, referralCode: true, status: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${slugless.length} slugless partner(s)`)
  if (slugless.length === 0) return

  let updated = 0
  let failed  = 0

  for (const row of slugless) {
    const fn = (row.user.firstName ?? '').trim()
    const ln = (row.user.lastName ?? '').trim()

    let slug: string
    try {
      if (fn || ln) {
        slug = await generatePartnerSlug(fn || 'partner', ln || '')
      } else {
        const localPart = row.user.email.split('@')[0] ?? 'partner'
        slug = await generatePartnerSlug(localPart, '')
      }
    } catch (err) {
      console.warn(`  ✗ ${row.id} (${row.user.email}): ${(err as Error).message}`)
      failed++
      continue
    }

    console.log(`  ${WRITE ? '→' : '·'} ${row.user.email.padEnd(40)}  →  ${slug}`)

    if (WRITE) {
      await prisma.affiliateAccount.update({
        where: { id: row.id },
        data:  { slug },
      })
      updated++
    }
  }

  console.log('')
  console.log(WRITE
    ? `Updated ${updated}, failed ${failed} of ${slugless.length}`
    : `Dry-run. Re-run with --write to apply. Would update ${slugless.length - failed}, would fail ${failed}.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
