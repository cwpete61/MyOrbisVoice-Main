/**
 * One-off, idempotent LIVE Stripe provisioning for the MyOrbisAgents launch promo
 * (Lane B). Creates, if missing:
 *
 *   1. A 50%-off / repeating-12-months Coupon scoped (applies_to) to BOTH agent
 *      products (Solo Capture + Solo Power), tagged metadata.promo='agent_launch'.
 *      The claim checkout resolves it by that tag. Product-scoped so it discounts
 *      the monthly plan only — NEVER the $250 setup (different product).
 *   2. A one-time $250 "setup fee" Product + Price with lookup_key
 *      'agent_setup_250', which the claim checkout attaches to the first invoice
 *      via subscription_data.add_invoice_items.
 *
 * Safe to re-run. Run inside the api container:
 *   docker exec -w /app/apps/api myorbisvoice-api node dist/scripts/provision-agent-promo-stripe.js
 */
import { bootStripeFromConfig, getStripe } from '../lib/stripe.js'
import { prisma } from '../lib/prisma.js'

const AGENT_PLAN_CODES = ['solo_capture', 'solo_power']
const PROMO_TAG   = 'agent_launch'
const SETUP_LOOKUP = 'agent_setup_250'

async function main(): Promise<void> {
  await bootStripeFromConfig()
  const stripe = getStripe()

  // Resolve the agent products from their existing recurring prices.
  const productIds: string[] = []
  for (const code of AGENT_PLAN_CODES) {
    const plan = await prisma.plan.findUnique({ where: { code }, select: { stripePriceId: true } })
    if (!plan?.stripePriceId) { console.log(`SKIP product for ${code}: no stripePriceId`); continue }
    const price = await stripe.prices.retrieve(plan.stripePriceId)
    productIds.push(typeof price.product === 'string' ? price.product : price.product.id)
  }
  console.log(`agent products: ${productIds.join(', ') || '(none)'}`)

  // 1) Promo coupon — 50% off, repeating 12 months, product-scoped.
  const coupons = await stripe.coupons.list({ limit: 100 })
  const existingCoupon = coupons.data.find(c => c.metadata?.['promo'] === PROMO_TAG && c.valid)
  if (!existingCoupon) {
    const coupon = await stripe.coupons.create({
      percent_off:       50,
      duration:          'repeating',
      duration_in_months: 12,
      name:              'MyOrbisAgents launch — 50% off 12 months',
      applies_to:        productIds.length ? { products: productIds } : undefined,
      metadata:          { promo: PROMO_TAG },
    })
    console.log(`  ✓ created coupon ${coupon.id} (50% off, 12mo, scoped to agent products)`)
  } else {
    console.log(`  • coupon already exists: ${existingCoupon.id}`)
  }

  // 2) $250 one-time setup Price (own product, so the coupon never touches it).
  const existingPrice = await stripe.prices.list({ lookup_keys: [SETUP_LOOKUP], limit: 1 })
  if (existingPrice.data.length === 0) {
    const product = await stripe.products.create({
      name:     'MyOrbisAgents setup fee',
      metadata: { kind: 'agent_setup' },
    })
    const price = await stripe.prices.create({
      product:     product.id,
      currency:    'usd',
      unit_amount: 25_000, // $250.00
      lookup_key:  SETUP_LOOKUP,
      metadata:    { kind: 'agent_setup' },
    })
    console.log(`  ✓ created setup price ${price.id} ($250 one-time, lookup_key=${SETUP_LOOKUP})`)
  } else {
    console.log(`  • setup price already exists: ${existingPrice.data[0]!.id}`)
  }

  await prisma.$disconnect()
  console.log('\nDONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
