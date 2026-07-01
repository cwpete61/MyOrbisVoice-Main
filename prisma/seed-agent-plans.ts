/**
 * MyOrbisAgents tier seeding — upserts ONLY the two founding plans + their
 * entitlements. Safe to run on prod (touches nothing else; upsert-idempotent).
 *
 * Stripe price mapping is separate: set stripePriceId (monthly recurring) and
 * stripeRecurringPriceId (annual recurring) via env or a follow-up SQL update
 * once the founding products' price IDs are pulled from the live account.
 *
 *   docker exec myorbisvoice-api node dist/prisma/seed-agent-plans.js
 * or locally: pnpm --filter @voiceautomation/api exec tsx prisma/seed-agent-plans.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const env = process.env as Record<string, string | undefined>

type Ent =
  | { key: string; valueType: 'BOOLEAN'; booleanValue: boolean }
  | { key: string; valueType: 'INTEGER'; integerValue: number }

const AGENT_PLANS: Array<{
  code: string; name: string; description: string; priceCents: number
  stripePriceId: string | null; stripeRecurringPriceId: string | null
  entitlements: Ent[]
}> = [
  {
    code: 'solo_capture',
    name: 'Solo Capture',
    description: '$297/month — answer, track, and book every lead. Up to 20 listings, 1 number.',
    priceCents: 29700,
    stripePriceId:          env['STRIPE_PRICE_SOLO_CAPTURE']        ?? null,
    stripeRecurringPriceId: env['STRIPE_PRICE_SOLO_CAPTURE_ANNUAL'] ?? null,
    entitlements: [
      { key: 'payments_enabled',         valueType: 'BOOLEAN', booleanValue: true },
      { key: 'widget_enabled',           valueType: 'BOOLEAN', booleanValue: true },
      { key: 'inbound_enabled',          valueType: 'BOOLEAN', booleanValue: true },
      { key: 'outbound_enabled',         valueType: 'BOOLEAN', booleanValue: true },
      { key: 'sms_enabled',              valueType: 'BOOLEAN', booleanValue: true },
      { key: 'max_channels',             valueType: 'INTEGER', integerValue: 3 },
      { key: 'max_agents',               valueType: 'INTEGER', integerValue: 7 },
      { key: 'max_seats',                valueType: 'INTEGER', integerValue: 1 },
      { key: 'max_phone_numbers',        valueType: 'INTEGER', integerValue: 1 },
      { key: 'minutes_per_month',        valueType: 'INTEGER', integerValue: 1500 },
      { key: 'kb_storage_mb',            valueType: 'INTEGER', integerValue: 250 },
      { key: 'included_sms_per_month',   valueType: 'INTEGER', integerValue: 500 },
      // MyOrbisAgents tier differentiators
      { key: 'listing_limit',            valueType: 'INTEGER', integerValue: 20 },
      { key: 'listing_tracking_numbers', valueType: 'BOOLEAN', booleanValue: false },
      { key: 'listing_enrichment',       valueType: 'BOOLEAN', booleanValue: false },
    ],
  },
  {
    code: 'solo_power',
    name: 'Solo Power',
    description: '$497/month — convert & manage: unlimited listings, per-listing tracking numbers, full automation.',
    priceCents: 49700,
    stripePriceId:          env['STRIPE_PRICE_SOLO_POWER']        ?? null,
    stripeRecurringPriceId: env['STRIPE_PRICE_SOLO_POWER_ANNUAL'] ?? null,
    entitlements: [
      { key: 'payments_enabled',         valueType: 'BOOLEAN', booleanValue: true },
      { key: 'widget_enabled',           valueType: 'BOOLEAN', booleanValue: true },
      { key: 'inbound_enabled',          valueType: 'BOOLEAN', booleanValue: true },
      { key: 'outbound_enabled',         valueType: 'BOOLEAN', booleanValue: true },
      { key: 'sms_enabled',              valueType: 'BOOLEAN', booleanValue: true },
      { key: 'max_channels',             valueType: 'INTEGER', integerValue: 3 },
      { key: 'max_agents',               valueType: 'INTEGER', integerValue: 7 },
      { key: 'max_seats',                valueType: 'INTEGER', integerValue: 1 },
      { key: 'max_phone_numbers',        valueType: 'INTEGER', integerValue: 12 },
      { key: 'minutes_per_month',        valueType: 'INTEGER', integerValue: 2000 },
      { key: 'kb_storage_mb',            valueType: 'INTEGER', integerValue: 1000 },
      { key: 'included_sms_per_month',   valueType: 'INTEGER', integerValue: 2000 },
      // MyOrbisAgents tier differentiators — the $497 unlocks
      { key: 'listing_limit',            valueType: 'INTEGER', integerValue: -1 }, // unlimited
      { key: 'listing_tracking_numbers', valueType: 'BOOLEAN', booleanValue: true },
      { key: 'listing_enrichment',       valueType: 'BOOLEAN', booleanValue: true },
      { key: 'nurture_automation',       valueType: 'BOOLEAN', booleanValue: true },
      { key: 'seller_valuation',         valueType: 'BOOLEAN', booleanValue: true },
      { key: 'crm_sync',                 valueType: 'BOOLEAN', booleanValue: true },
    ],
  },
]

async function main() {
  for (const p of AGENT_PLANS) {
    const plan = await prisma.plan.upsert({
      where:  { code: p.code },
      update: { name: p.name, description: p.description, priceCents: p.priceCents, interval: 'MONTHLY', isActive: true,
                ...(p.stripePriceId ? { stripePriceId: p.stripePriceId } : {}),
                ...(p.stripeRecurringPriceId ? { stripeRecurringPriceId: p.stripeRecurringPriceId } : {}) },
      create: { code: p.code, name: p.name, description: p.description, priceCents: p.priceCents, interval: 'MONTHLY', isActive: true,
                stripePriceId: p.stripePriceId, stripeRecurringPriceId: p.stripeRecurringPriceId },
    })
    for (const e of p.entitlements) {
      await prisma.planEntitlement.upsert({
        where:  { planId_key: { planId: plan.id, key: e.key } },
        update: e.valueType === 'BOOLEAN' ? { valueType: 'BOOLEAN', booleanValue: e.booleanValue } : { valueType: 'INTEGER', integerValue: e.integerValue },
        create: { planId: plan.id, key: e.key, ...(e.valueType === 'BOOLEAN' ? { valueType: 'BOOLEAN', booleanValue: e.booleanValue } : { valueType: 'INTEGER', integerValue: e.integerValue }) },
      })
    }
    console.log(`[seed-agent-plans] upserted ${p.code} (${p.entitlements.length} entitlements) stripe=${p.stripePriceId ?? 'unset'}/${p.stripeRecurringPriceId ?? 'unset'}`)
  }
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1) })
