/**
 * One-off, idempotent provisioning for MyOrbisAgents comp-codes.
 *
 * For each agent tier (Solo Capture, Solo Power) it ensures, in the LIVE Stripe
 * account, the two objects the comp-code system needs:
 *   1. a Payment Link on the plan's existing recurring Price  → stored on
 *      Plan.stripeBuyLinkUrl (the comp checkout URL is built from it), with
 *      allow_promotion_codes so a comp promo code can be applied at checkout.
 *   2. a 100%-off-forever Coupon scoped to ONLY that plan's product, tagged
 *      metadata.tier = <TIER> so getCouponIdForTier() can find it.
 *
 * Safe to re-run: skips a link/coupon that already exists. Run inside the api
 * container:  docker exec myorbisvoice-api node dist/scripts/provision-agent-comp-stripe.js
 */
import { bootStripeFromConfig, getStripe } from '../lib/stripe.js'
import { prisma } from '../lib/prisma.js'

const TIERS = [
  { tier: 'SOLO_CAPTURE', planCode: 'solo_capture', label: 'Solo Capture' },
  { tier: 'SOLO_POWER',   planCode: 'solo_power',   label: 'Solo Power' },
] as const

async function main(): Promise<void> {
  await bootStripeFromConfig()
  const stripe = getStripe()

  for (const { tier, planCode, label } of TIERS) {
    const plan = await prisma.plan.findUnique({
      where:  { code: planCode },
      select: { id: true, name: true, stripePriceId: true, stripeBuyLinkUrl: true },
    })
    if (!plan) { console.log(`SKIP ${planCode}: no Plan row`); continue }
    if (!plan.stripePriceId) { console.log(`SKIP ${planCode}: no stripePriceId — create a Stripe Price first`); continue }

    const price = await stripe.prices.retrieve(plan.stripePriceId)
    const productId = typeof price.product === 'string' ? price.product : price.product.id
    console.log(`\n${planCode} (${tier}): price ${plan.stripePriceId} → product ${productId}`)

    // 1) Payment Link → Plan.stripeBuyLinkUrl
    let buyLink = plan.stripeBuyLinkUrl
    if (!buyLink) {
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        metadata: { planCode, tier },
      })
      buyLink = link.url
      await prisma.plan.update({ where: { id: plan.id }, data: { stripeBuyLinkUrl: buyLink } })
      console.log(`  ✓ created payment link ${buyLink}`)
    } else {
      console.log(`  • buy-link already set: ${buyLink}`)
    }

    // 2) 100%-off coupon scoped to this product, tagged metadata.tier
    const coupons = await stripe.coupons.list({ limit: 100 })
    const existing = coupons.data.find(c => c.metadata?.['tier'] === tier && c.valid)
    if (!existing) {
      const coupon = await stripe.coupons.create({
        percent_off: 100,
        duration:    'forever',
        name:        `Comp — ${label}`,
        applies_to:  { products: [productId] },
        metadata:    { tier },
      })
      console.log(`  ✓ created coupon ${coupon.id} (100% off, product-scoped)`)
    } else {
      console.log(`  • coupon already exists: ${existing.id}`)
    }
  }

  await prisma.$disconnect()
  console.log('\nDONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
