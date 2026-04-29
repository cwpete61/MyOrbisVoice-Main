import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Stripe price IDs are optional — set them in .env before re-running seed
const env = process.env as Record<string, string | undefined>
const STRIPE_PRICE_IDS: Record<string, string | null> = {
  starter_monthly: env['STRIPE_PRICE_STARTER_MONTHLY'] ?? null,
  pro_monthly: env['STRIPE_PRICE_PRO_MONTHLY'] ?? null,
  enterprise_monthly: env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] ?? null,
}

async function main() {
  console.log('[seed] seeding roles...')

  const roles = [
    { key: 'platform_super_admin', name: 'Platform Super Admin', isPlatformRole: true },
    { key: 'platform_admin', name: 'Platform Admin', isPlatformRole: true },
    { key: 'tenant_owner', name: 'Tenant Owner', isPlatformRole: false },
    { key: 'tenant_manager', name: 'Tenant Manager', isPlatformRole: false },
    { key: 'tenant_staff', name: 'Tenant Staff', isPlatformRole: false },
    { key: 'affiliate', name: 'Affiliate', isPlatformRole: false },
  ]

  for (const role of roles) {
    await prisma.roleDefinition.upsert({
      where: { key: role.key },
      update: { name: role.name, isPlatformRole: role.isPlatformRole },
      create: { key: role.key, name: role.name, isPlatformRole: role.isPlatformRole },
    })
    console.log(`  [seed] role: ${role.key}`)
  }

  console.log('[seed] seeding plans...')

  const plans = [
    {
      code: 'starter_monthly',
      name: 'Starter',
      description: 'Up to 1 channel, 500 minutes/month',
      interval: 'MONTHLY' as const,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 1 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 2 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 500 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
      ],
    },
    {
      code: 'pro_monthly',
      name: 'Pro',
      description: 'All channels, 2,000 minutes/month',
      interval: 'MONTHLY' as const,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 3 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 7 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 2000 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
      ],
    },
    {
      code: 'enterprise_monthly',
      name: 'Enterprise',
      description: 'Unlimited channels, 10,000 minutes/month, affiliate portal',
      interval: 'MONTHLY' as const,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 99 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 99 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 10000 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
      ],
    },
  ]

  for (const plan of plans) {
    const { entitlements, ...planData } = plan
    const stripePriceId = STRIPE_PRICE_IDS[planData.code] ?? null
    const upserted = await prisma.plan.upsert({
      where: { code: planData.code },
      update: { name: planData.name, description: planData.description, stripePriceId },
      create: { ...planData, stripePriceId },
    })
    console.log(`  [seed] plan: ${planData.code}`)

    for (const ent of entitlements) {
      await prisma.planEntitlement.upsert({
        where: { planId_key: { planId: upserted.id, key: ent.key } },
        update: {
          valueType: ent.valueType,
          booleanValue: 'booleanValue' in ent ? ent.booleanValue : null,
          integerValue: 'integerValue' in ent ? ent.integerValue : null,
        },
        create: {
          planId: upserted.id,
          key: ent.key,
          valueType: ent.valueType,
          booleanValue: 'booleanValue' in ent ? ent.booleanValue : null,
          integerValue: 'integerValue' in ent ? ent.integerValue : null,
        },
      })
    }
  }

  console.log('[seed] seeding platform admin...')

  const adminRole = await prisma.roleDefinition.findUnique({ where: { key: 'platform_super_admin' } })
  if (adminRole) {
    const passwordHash = await bcrypt.hash('Orbis@8214@@!!', 12)
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@myorbisvoice.com' },
      update: {},
      create: {
        email: 'admin@myorbisvoice.com',
        username: 'OrbisAdmin',
        passwordHash,
        status: 'ACTIVE',
      },
    })

    const adminTenant = await prisma.tenant.upsert({
      where: { slug: 'orbis-platform' },
      update: {},
      create: {
        slug: 'orbis-platform',
        displayName: 'MyOrbisVoice Platform',
        registrationEmail: 'admin@myorbisvoice.com',
        status: 'ACTIVE',
      },
    })

    const existingMembership = await prisma.tenantMember.findFirst({
      where: { userId: adminUser.id, tenantId: adminTenant.id },
    })
    if (!existingMembership) {
      await prisma.tenantMember.create({
        data: {
          userId: adminUser.id,
          tenantId: adminTenant.id,
          roleDefinitionId: adminRole.id,
          isOwner: true,
        },
      })
    }
    console.log('  [seed] admin: admin@myorbisvoice.com / OrbisAdmin')
  }

  console.log('[seed] done.')
}

main()
  .catch((err) => {
    console.error('[seed] error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
