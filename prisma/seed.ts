import { PrismaClient, PlanInterval } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Stripe price IDs are optional — set them in .env before re-running seed
const env = process.env as Record<string, string | undefined>
const STRIPE_PRICE_IDS: Record<string, string | null> = {
  ltd:               env['STRIPE_PRICE_LTD']        ?? null,
  basic_monthly:     env['STRIPE_PRICE_BASIC']       ?? null,
  pro_monthly:       env['STRIPE_PRICE_PRO']         ?? null,
  premier_monthly:   env['STRIPE_PRICE_PREMIER']     ?? null,
  enterprise_monthly: env['STRIPE_PRICE_ENTERPRISE'] ?? null,
}

async function main() {
  console.log('[seed] seeding roles...')

  const roles = [
    { key: 'platform_super_admin', name: 'Platform Super Admin', isPlatformRole: true },
    { key: 'platform_admin', name: 'Platform Admin', isPlatformRole: true },
    { key: 'platform_support', name: 'Platform Support', isPlatformRole: true },
    { key: 'tenant_owner', name: 'Tenant Owner', isPlatformRole: false },
    { key: 'tenant_manager', name: 'Tenant Manager', isPlatformRole: false },
    { key: 'tenant_staff', name: 'Tenant Staff', isPlatformRole: false },
    { key: 'affiliate', name: 'Partner', isPlatformRole: false },
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
      code: 'free',
      name: 'Free',
      description: 'Free tier — widget voice agent, 20 min/month',
      interval: 'MONTHLY' as const,
      priceCents: 0,
      entitlements: [
        { key: 'widget_enabled',         valueType: 'BOOLEAN' as const, booleanValue: true  },
        { key: 'inbound_enabled',        valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'outbound_enabled',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'sms_enabled',            valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'max_phone_numbers',      valueType: 'INTEGER' as const, integerValue: 0     },
        { key: 'max_concurrent_calls',   valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'max_channels',           valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'max_agents',             valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'max_seats',              valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'max_contacts',           valueType: 'INTEGER' as const, integerValue: 100   },
        { key: 'minutes_per_month',      valueType: 'INTEGER' as const, integerValue: 20    },
        { key: 'data_retention_months',  valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'max_locations',          valueType: 'INTEGER' as const, integerValue: 1     },
        { key: 'agent_handoff_enabled',  valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'department_routing',     valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'agent_scheduling',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'escalation_rules',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'vip_caller_recognition', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'agent_assignment',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'live_call_monitoring',   valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'call_takeover',          valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'multi_location',         valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'desktop_app',            valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'mobile_app',             valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'campaigns_enabled',      valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'affiliate_enabled',      valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'webhooks_enabled',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'push_notifications',     valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'manager_dashboard',      valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'agent_performance',      valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'sentiment_analysis',     valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'conversion_tracking',    valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'multi_calendar_booking', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'compliance_mode',        valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'audit_log_export',       valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'priority_support',       valueType: 'BOOLEAN' as const, booleanValue: false },
        // ── Pricing & Quotas (managed Twilio) ─────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 0  },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 0  },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 5  },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 0  },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 10 },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 0  },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 5  },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 15 },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: false },
        // Knowledge base — feature locked on free tier
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 0 },
      ],
    },
    {
      code: 'ltd',
      name: 'LTD',
      description: 'Lifetime Deal — one-time payment, $497. Limited to 100 units.',
      interval: 'ONE_TIME' as PlanInterval,
      priceCents: 49700,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 3 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 7 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 2000 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        // ── Pricing & Quotas (matches Pro) ────────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 200 },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 500 },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 8   },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 12  },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: true },
        // Knowledge base — LTD matches Pro tier (250 MB)
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 250 },
      ],
    },
    {
      code: 'basic_monthly',
      name: 'Basic',
      description: '$197/month — entry-level plan',
      interval: 'MONTHLY' as const,
      priceCents: 19700,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 1 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 2 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 500 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        // ── Pricing & Quotas ──────────────────────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 200 },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 25  },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 10  },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 0   },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 15  },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: false },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: true  },
        // Knowledge base — Basic tier (50 MB)
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 50 },
      ],
    },
    {
      code: 'pro_monthly',
      name: 'Pro',
      description: '$497/month — all channels, full feature set',
      interval: 'MONTHLY' as const,
      priceCents: 49700,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 3 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 7 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 2000 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: false },
        // ── Pricing & Quotas ──────────────────────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 200 },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 500 },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 8   },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 5   },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 12  },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: true },
        // Knowledge base — Pro tier (250 MB)
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 250 },
      ],
    },
    {
      code: 'premier_monthly',
      name: 'Premier',
      description: '$997/month — high-volume, priority support',
      interval: 'MONTHLY' as const,
      priceCents: 99700,
      entitlements: [
        { key: 'max_channels', valueType: 'INTEGER' as const, integerValue: 5 },
        { key: 'max_agents', valueType: 'INTEGER' as const, integerValue: 7 },
        { key: 'minutes_per_month', valueType: 'INTEGER' as const, integerValue: 5000 },
        { key: 'widget_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled', valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Pricing & Quotas ──────────────────────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 200 },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 1500 },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 4   },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 300 },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 8   },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 500 },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 4   },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 10  },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: true },
        // Knowledge base — Premier tier (1 GB)
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 1024 },
      ],
    },
    {
      code: 'enterprise_monthly',
      name: 'Enterprise',
      description: '$1,997/month — full platform, unlimited scale, white-glove support',
      interval: 'MONTHLY' as const,
      priceCents: 199700,
      entitlements: [
        // ── Channels ──────────────────────────────────────────────
        { key: 'widget_enabled',           valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'inbound_enabled',          valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'outbound_enabled',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'sms_enabled',              valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'max_phone_numbers',        valueType: 'INTEGER' as const, integerValue: 10 },
        { key: 'max_concurrent_calls',     valueType: 'INTEGER' as const, integerValue: 20 },
        { key: 'max_channels',             valueType: 'INTEGER' as const, integerValue: 10 },
        // ── Agents & Staff ────────────────────────────────────────
        { key: 'max_agents',               valueType: 'INTEGER' as const, integerValue: 7 },
        { key: 'max_seats',                valueType: 'INTEGER' as const, integerValue: 15 },
        { key: 'max_contacts',             valueType: 'INTEGER' as const, integerValue: 999999 },
        { key: 'agent_handoff_enabled',    valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'department_routing',       valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'agent_scheduling',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'escalation_rules',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'vip_caller_recognition',   valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'agent_assignment',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'live_call_monitoring',     valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'call_takeover',            valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Locations ─────────────────────────────────────────────
        { key: 'multi_location',           valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'max_locations',            valueType: 'INTEGER' as const, integerValue: 10 },
        // ── Apps ──────────────────────────────────────────────────
        { key: 'mobile_app',               valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'desktop_app',              valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'push_notifications',       valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'manager_dashboard',        valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Data & Reporting ──────────────────────────────────────
        { key: 'minutes_per_month',        valueType: 'INTEGER' as const, integerValue: 20000 },
        { key: 'data_retention_months',    valueType: 'INTEGER' as const, integerValue: 12 },
        { key: 'recording_storage_gb',     valueType: 'INTEGER' as const, integerValue: 100 },
        { key: 'max_campaigns',            valueType: 'INTEGER' as const, integerValue: 999 },
        { key: 'sentiment_analysis',       valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'agent_performance',        valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'audit_log_export',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'conversion_tracking',      valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Integrations ──────────────────────────────────────────
        { key: 'webhooks_enabled',         valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'api_access',               valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'affiliate_enabled',        valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'campaigns_enabled',        valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Branding ──────────────────────────────────────────────
        { key: 'white_label',              valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Compliance & Support ──────────────────────────────────
        { key: 'compliance_mode',          valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'sla_guarantee',            valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'onboarding_assistance',    valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'priority_support',         valueType: 'BOOLEAN' as const, booleanValue: true },
        // ── Pricing & Quotas ──────────────────────────────────────
        { key: 'phone_number_monthly_cost_cents',    valueType: 'INTEGER' as const, integerValue: 200 },
        { key: 'included_sms_per_month',             valueType: 'INTEGER' as const, integerValue: 5000 },
        { key: 'sms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 3   },
        { key: 'included_mms_per_month',             valueType: 'INTEGER' as const, integerValue: 1000 },
        { key: 'mms_overage_per_message_cents',      valueType: 'INTEGER' as const, integerValue: 7   },
        { key: 'included_whatsapp_per_month',        valueType: 'INTEGER' as const, integerValue: 2000 },
        { key: 'whatsapp_overage_per_message_cents', valueType: 'INTEGER' as const, integerValue: 3   },
        { key: 'voice_overage_per_minute_cents',     valueType: 'INTEGER' as const, integerValue: 8   },
        { key: 'whatsapp_enabled',                   valueType: 'BOOLEAN' as const, booleanValue: true },
        { key: 'mms_enabled',                        valueType: 'BOOLEAN' as const, booleanValue: true },
        // Knowledge base — Enterprise tier (5 GB)
        { key: 'kb_storage_mb',                      valueType: 'INTEGER' as const, integerValue: 5120 },
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

  // ── Campaign Templates ────────────────────────────────────────────────────
  console.log('[seed] seeding campaign templates...')

  const templates = [
    // ── GENERAL (applies to all verticals) ──────────────────────────────────
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_CUSTOMER_SERVICE', name: 'Customer Service Follow-Up', description: 'Check if the issue from a recent interaction was resolved to the customer\'s satisfaction.', defaultPrompt: 'You are a friendly customer service representative. Call the contact to follow up on their recent experience and confirm their issue was resolved. Ask if there is anything else you can help with. Be warm, brief, and professional.', defaultTriggerTag: 'post-support', defaultDelayHours: 4, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['post-support', 'issue-resolved', 'case-closed'] },
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Quality Control Follow-Up', description: 'Satisfaction check after a service was delivered.', defaultPrompt: 'You are calling on behalf of the business to check on the quality of service the contact recently received. Ask how satisfied they were, if anything could have been better, and thank them for their business.', defaultTriggerTag: 'job-complete', defaultDelayHours: 2, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['job-complete', 'service-delivered'] },
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_TESTIMONIAL', name: 'Testimonial & Review Request', description: 'Ask a satisfied customer to leave a review or provide a testimonial.', defaultPrompt: 'You are calling to thank the contact for their business and ask if they would be willing to leave a quick review online. Let them know it only takes a minute and means a lot to the team. If they agree, let them know where to leave the review.', defaultTriggerTag: 'satisfied-customer', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['satisfied-customer', 'post-service', 'review-requested'] },
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_REENGAGEMENT', name: 'Re-engagement Follow-Up', description: 'Reach out to a contact who has gone quiet after initial interest.', defaultPrompt: 'You are calling to reconnect with the contact who had previously expressed interest. Check in to see if they still have a need, offer to answer any questions, and invite them back into the conversation. Keep it friendly and low-pressure.', defaultTriggerTag: 'cold-lead', defaultDelayHours: 72, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['cold-lead', 'no-response', 'stale'] },
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_QUOTE', name: 'Quote Follow-Up', description: 'Follow up on a sent proposal that has not received a response.', defaultPrompt: 'You are calling to follow up on a quote or proposal that was recently sent. Ask if they had a chance to review it, if they have any questions, and if they are ready to move forward. Be helpful, not pushy.', defaultTriggerTag: 'quote-sent', defaultDelayHours: 48, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['quote-sent', 'proposal-sent'] },
    { vertical: 'GENERAL', campaignType: 'FOLLOWUP_REFERRAL', name: 'Referral Ask', description: 'Ask a happy customer to refer friends or family.', defaultPrompt: 'You are calling a satisfied customer to thank them and let them know about the referral program. Explain the benefit of referring a friend and ask if anyone comes to mind. Keep it warm and conversational.', defaultTriggerTag: 'referral-candidate', defaultDelayHours: 48, defaultMaxRetries: 1, defaultRetryIntervalHours: 72, suggestedTagsJson: ['referral-candidate', 'happy-customer'] },
    { vertical: 'GENERAL', campaignType: 'CONFIRM_APPOINTMENT', name: 'Appointment Confirmation', description: 'Confirm an upcoming appointment with the contact.', defaultPrompt: 'You are calling to confirm an upcoming appointment. State the date and time, ask if they can still make it, and offer to reschedule if needed. Be brief and friendly.', defaultTriggerTag: 'appointment-booked', defaultDelayHours: 2, defaultMaxRetries: 2, defaultRetryIntervalHours: 4, suggestedTagsJson: ['appointment-booked', 'booking-confirmed'] },
    { vertical: 'GENERAL', campaignType: 'CONFIRM_REMINDER', name: 'Appointment Reminder', description: 'Same-day or next-day reminder for an upcoming appointment.', defaultPrompt: 'You are calling with a friendly reminder about tomorrow\'s appointment. Confirm the time and location, ask if they have any questions, and let them know you look forward to seeing them.', defaultTriggerTag: 'appointment-reminder-due', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 2, suggestedTagsJson: ['appointment-reminder-due'] },
    { vertical: 'GENERAL', campaignType: 'CONFIRM_RESCHEDULE', name: 'Reschedule Offer', description: 'Offer alternate appointment slots after a cancellation or no-show.', defaultPrompt: 'You are calling because a scheduled appointment was missed or cancelled. Offer to reschedule at a convenient time and let them know you still want to help them. Be understanding and accommodating.', defaultTriggerTag: 'no-show', defaultDelayHours: 1, defaultMaxRetries: 3, defaultRetryIntervalHours: 24, suggestedTagsJson: ['no-show', 'cancelled', 'missed-appointment'] },
    { vertical: 'GENERAL', campaignType: 'CONFIRM_CANCELLATION', name: 'Cancellation Acknowledgement', description: 'Confirm a cancellation and optionally attempt a win-back.', defaultPrompt: 'You are calling to confirm that the appointment or service has been cancelled as requested. Thank them for letting you know and let them know the door is open whenever they are ready to return.', defaultTriggerTag: 'cancellation-confirmed', defaultDelayHours: 1, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['cancellation-confirmed', 'cancelled'] },
    { vertical: 'GENERAL', campaignType: 'PAYMENT_REMINDER', name: 'Payment Reminder', description: 'Gentle reminder that a payment is due or overdue.', defaultPrompt: 'You are calling with a friendly reminder that a payment is coming up or may be outstanding. Provide the amount and due date, offer to help with any questions, and let them know how to make a payment.', defaultTriggerTag: 'payment-due', defaultDelayHours: 24, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['payment-due', 'invoice-sent', 'overdue'] },
    { vertical: 'GENERAL', campaignType: 'WIN_BACK', name: 'Win-Back Campaign', description: 'Re-engage a customer who has not interacted in 90 or more days.', defaultPrompt: 'You are calling to reconnect with a customer who has not been heard from in a while. Let them know you value their business, share any new offerings or improvements, and invite them to come back. Keep it warm and personal.', defaultTriggerTag: 'win-back', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['win-back', 'lapsed-customer', 'churned'] },
    { vertical: 'GENERAL', campaignType: 'NPS_SURVEY', name: 'NPS Satisfaction Survey', description: 'Structured satisfaction feedback call after any service.', defaultPrompt: 'You are calling to gather quick feedback on the contact\'s recent experience. Ask them to rate their satisfaction on a scale of 1 to 10, ask what went well and what could be improved, and thank them for their time.', defaultTriggerTag: 'nps-survey', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['nps-survey', 'feedback-requested'] },

    // ── DENTAL ───────────────────────────────────────────────────────────────
    { vertical: 'DENTAL', campaignType: 'RECALL_PATIENT', name: 'Patient Recall', description: 'Recall a patient who has not visited in six or more months.', defaultPrompt: 'You are calling on behalf of the dental office to let the patient know they are due for their routine check-up and cleaning. Ask if they would like to schedule an appointment and offer available times. Be friendly and caring.', defaultTriggerTag: 'recall-due', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 72, suggestedTagsJson: ['recall-due', '6-month-due', 'overdue-checkup'] },
    { vertical: 'DENTAL', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Post-Procedure Check-In', description: 'Check on the patient after a dental procedure.', defaultPrompt: 'You are calling to check on the patient following their recent dental procedure. Ask how they are feeling, whether they are experiencing any discomfort, and remind them of any aftercare instructions. Let them know the team is available if they have questions.', defaultTriggerTag: 'post-procedure', defaultDelayHours: 24, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['post-procedure', 'post-extraction', 'post-root-canal'] },
    { vertical: 'DENTAL', campaignType: 'LEAD_WARMUP', name: 'New Patient Welcome', description: 'Welcome call after a patient\'s first visit.', defaultPrompt: 'You are calling to welcome a new patient to the practice. Thank them for choosing the office, ask how their first visit went, and let them know about any patient resources or upcoming appointment reminders they can expect.', defaultTriggerTag: 'new-patient', defaultDelayHours: 4, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['new-patient', 'first-visit'] },

    // ── MEDICAL / CLINICS ────────────────────────────────────────────────────
    { vertical: 'MEDICAL', campaignType: 'PRESCRIPTION_REMINDER', name: 'Prescription Refill Reminder', description: 'Remind a patient that their prescription refill window is approaching.', defaultPrompt: 'You are calling to let the patient know that their prescription refill is coming up and to remind them to contact the office or pharmacy if they need a renewal. Ask if they have any questions for the doctor.', defaultTriggerTag: 'refill-due', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['refill-due', 'prescription-reminder'] },
    { vertical: 'MEDICAL', campaignType: 'LAB_RESULTS_READY', name: 'Lab Results Ready', description: 'Notify a patient that their lab results are available.', defaultPrompt: 'You are calling to let the patient know that their lab results are now available. Ask them to call the office or book a follow-up appointment to discuss the results with their doctor.', defaultTriggerTag: 'lab-results-ready', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 4, suggestedTagsJson: ['lab-results-ready', 'results-available'] },
    { vertical: 'MEDICAL', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Post-Visit Check-In', description: 'Follow up with a patient 24 to 48 hours after a visit.', defaultPrompt: 'You are calling to check in on the patient following their recent visit. Ask how they are feeling, whether their symptoms have improved, and remind them to take any prescribed medication as directed. Let them know to call the office if anything changes.', defaultTriggerTag: 'post-visit', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['post-visit', 'post-appointment'] },

    // ── LEGAL ────────────────────────────────────────────────────────────────
    { vertical: 'LEGAL', campaignType: 'FOLLOWUP_CUSTOMER_SERVICE', name: 'Consultation Follow-Up', description: 'Follow up after a free consultation to check if the prospect wants to retain.', defaultPrompt: 'You are calling to follow up after a recent consultation. Ask if the contact has had a chance to consider moving forward and if they have any additional questions. Be helpful and professional, not pushy.', defaultTriggerTag: 'post-consultation', defaultDelayHours: 24, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['post-consultation', 'free-consult'] },
    { vertical: 'LEGAL', campaignType: 'DOCUMENT_REQUEST', name: 'Document Collection Reminder', description: 'Remind a client to submit required documentation.', defaultPrompt: 'You are calling to remind the client that certain documents are still needed to proceed with their case. Specify what is needed if available, provide a deadline, and offer to help if they have any questions about what to submit.', defaultTriggerTag: 'docs-pending', defaultDelayHours: 48, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['docs-pending', 'documents-required'] },
    { vertical: 'LEGAL', campaignType: 'RECALL_ANNUAL_REVIEW', name: 'Retainer Renewal', description: 'Remind a client that their retainer is expiring.', defaultPrompt: 'You are calling to let the client know that their retainer agreement is coming up for renewal. Ask if they would like to continue services and offer to schedule a review meeting with their attorney.', defaultTriggerTag: 'retainer-expiring', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['retainer-expiring', 'renewal-due'] },

    // ── FINANCIAL ────────────────────────────────────────────────────────────
    { vertical: 'FINANCIAL', campaignType: 'RECALL_ANNUAL_REVIEW', name: 'Annual Review Reminder', description: 'Remind a client it is time for their annual financial or portfolio review.', defaultPrompt: 'You are calling to let the client know that their annual review is due. Offer to schedule a meeting with their advisor to review their current plan and make any adjustments. Keep it professional and proactive.', defaultTriggerTag: 'annual-review-due', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 72, suggestedTagsJson: ['annual-review-due', 'review-scheduled'] },
    { vertical: 'FINANCIAL', campaignType: 'POLICY_RENEWAL', name: 'Policy or Product Renewal', description: 'Notify a client that a financial product or insurance policy is expiring.', defaultPrompt: 'You are calling to let the client know that their policy or financial product is coming up for renewal. Ask if they would like to review their options and schedule a call with their advisor to go through the details.', defaultTriggerTag: 'policy-expiring', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 72, suggestedTagsJson: ['policy-expiring', 'renewal-due'] },
    { vertical: 'FINANCIAL', campaignType: 'DOCUMENT_REQUEST', name: 'Document Collection', description: 'Collect required financial documents such as tax records or KYC materials.', defaultPrompt: 'You are calling to follow up on some documents that are still needed. Let the client know what is outstanding and provide any relevant deadlines. Offer to answer questions about what is required.', defaultTriggerTag: 'docs-required', defaultDelayHours: 48, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['docs-required', 'kyc-pending', 'tax-docs-needed'] },

    // ── HOME SERVICES ────────────────────────────────────────────────────────
    { vertical: 'HOME_SERVICES', campaignType: 'RECALL_SERVICE_DUE', name: 'Seasonal Service Reminder', description: 'Remind a customer that a seasonal maintenance service is due.', defaultPrompt: 'You are calling to let the customer know that it is time for their seasonal service. Mention what the service covers, offer to schedule a convenient time, and let them know about any current promotions.', defaultTriggerTag: 'seasonal-due', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['seasonal-due', 'maintenance-due', 'annual-service'] },
    { vertical: 'HOME_SERVICES', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Job Completion Follow-Up', description: 'Check in after a service job is completed.', defaultPrompt: 'You are calling to follow up on a recent service job. Ask how everything went, whether the work met their expectations, and if there is anything else they need. Thank them for choosing the business.', defaultTriggerTag: 'job-complete', defaultDelayHours: 4, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['job-complete', 'service-done'] },

    // ── AUTO REPAIR ──────────────────────────────────────────────────────────
    { vertical: 'AUTO_REPAIR', campaignType: 'RECALL_SERVICE_DUE', name: 'Service Due Reminder', description: 'Remind a customer their vehicle is due for a service or inspection.', defaultPrompt: 'You are calling to let the customer know that their vehicle is due for a service. Mention what is recommended based on their vehicle and mileage, offer to book a time, and remind them that regular maintenance protects their investment.', defaultTriggerTag: 'service-due', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 72, suggestedTagsJson: ['service-due', 'oil-change-due', 'mot-due'] },
    { vertical: 'AUTO_REPAIR', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Repair Follow-Up', description: 'Check in after a vehicle repair to ensure everything is running well.', defaultPrompt: 'You are calling to follow up on a recent repair. Ask how the vehicle is running, whether everything feels right, and remind them that the shop stands behind their work. Invite them to call if anything comes up.', defaultTriggerTag: 'repair-complete', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['repair-complete', 'vehicle-collected'] },
    { vertical: 'AUTO_REPAIR', campaignType: 'LEAD_WARMUP', name: 'Parts Arrived Notification', description: 'Notify a customer that their parts have arrived and the repair can be scheduled.', defaultPrompt: 'You are calling to let the customer know that their parts have arrived and the vehicle can now be brought in for repair. Offer to schedule a convenient drop-off time and confirm the expected turnaround.', defaultTriggerTag: 'parts-arrived', defaultDelayHours: 1, defaultMaxRetries: 3, defaultRetryIntervalHours: 24, suggestedTagsJson: ['parts-arrived', 'ready-to-book'] },

    // ── TRAVEL ──────────────────────────────────────────────────────────────
    { vertical: 'TRAVEL', campaignType: 'CONFIRM_BOOKING', name: 'Booking Confirmation', description: 'Confirm a new travel booking and walk through key details.', defaultPrompt: "You are calling to confirm the customer's travel booking. Walk through the dates, destination, key inclusions, and what they should expect next. Offer to answer any questions and let them know who to contact if anything changes.", defaultTriggerTag: 'travel-booked', defaultDelayHours: 1, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['travel-booked', 'new-trip'] },
    { vertical: 'TRAVEL', campaignType: 'CONFIRM_REMINDER', name: 'Pre-Trip Reminder', description: 'Day-before reminder with check-in and packing essentials.', defaultPrompt: 'You are calling to remind the traveler that their trip is tomorrow. Confirm departure time, airport or pickup location, and any check-in steps. Remind them to bring their travel documents and any items the itinerary calls for. Wish them a great trip.', defaultTriggerTag: 'trip-tomorrow', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 12, suggestedTagsJson: ['trip-tomorrow', 'departure-soon'] },
    { vertical: 'TRAVEL', campaignType: 'DOCUMENT_REQUEST', name: 'Travel Document Collection', description: 'Request passport copies, visas, or other required travel documents.', defaultPrompt: 'You are calling to remind the traveler that certain documents are still needed before their trip. Specify what is missing — passport, visa, ID — and the deadline. Offer to help if they have questions about how to submit.', defaultTriggerTag: 'travel-docs-pending', defaultDelayHours: 24, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['travel-docs-pending', 'passport-needed', 'visa-needed'] },
    { vertical: 'TRAVEL', campaignType: 'FOLLOWUP_POST_STAY', name: 'Post-Trip Follow-Up', description: 'Welcome the traveler home and check on their experience.', defaultPrompt: 'You are calling to welcome the traveler home and ask how their trip went. Ask if there were any highlights or issues, thank them for choosing the business, and let them know the team is here for their next adventure.', defaultTriggerTag: 'trip-complete', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['trip-complete', 'returned'] },
    { vertical: 'TRAVEL', campaignType: 'FOLLOWUP_TESTIMONIAL', name: 'Trip Review Request', description: 'Ask the traveler to leave a review of their trip.', defaultPrompt: 'You are calling a recent traveler to ask if they would be willing to leave a review of their trip. Mention how helpful reviews are for the business and other travelers. If they agree, offer to text or email them the review link. Keep it brief and never push.', defaultTriggerTag: 'trip-review-ask', defaultDelayHours: 72, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['trip-review-ask', 'happy-traveler'] },
    { vertical: 'TRAVEL', campaignType: 'RECALL_INACTIVE', name: 'Repeat Traveler Outreach', description: 'Reach out to past travelers about their next trip.', defaultPrompt: 'You are calling a customer who has traveled with the business before. Mention you are reaching out to see if they are starting to think about their next trip and offer to help with planning or discuss new destinations. Be warm and helpful, not pushy.', defaultTriggerTag: 'past-traveler', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 96, suggestedTagsJson: ['past-traveler', 'repeat-customer'] },
    { vertical: 'TRAVEL', campaignType: 'EVENT_INVITATION', name: 'Destination Webinar Invite', description: 'Invite past customers to a destination spotlight webinar.', defaultPrompt: 'You are calling to invite the customer to a destination webinar the business is hosting. Briefly describe the destination being featured, the date and time, and what they will learn. Mention this is a free informational session for past clients. Ask if they would like to RSVP.', defaultTriggerTag: 'destination-webinar', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['destination-webinar', 'event-invite'] },
    { vertical: 'TRAVEL', campaignType: 'UPSELL_CROSSSELL', name: 'Travel Insurance Reminder', description: 'Remind a booked traveler to consider adding travel insurance.', defaultPrompt: 'You are calling a booked traveler to remind them about adding travel insurance for their upcoming trip. Briefly explain what it covers and offer to help them add it to their booking. Make it clear this is optional but recommended for protection against unexpected issues.', defaultTriggerTag: 'insurance-not-added', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['insurance-not-added', 'pre-trip'] },
    { vertical: 'TRAVEL', campaignType: 'PAYMENT_REMINDER', name: 'Trip Balance Due', description: 'Remind a customer about an upcoming trip payment.', defaultPrompt: 'You are calling to remind the customer that a payment is due for their upcoming trip. Confirm the amount and the due date, and offer to help them complete the payment over the phone or by sending a payment link.', defaultTriggerTag: 'travel-balance-due', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['travel-balance-due', 'final-payment-due'] },
    { vertical: 'TRAVEL', campaignType: 'ABANDONED_INQUIRY', name: 'Trip Inquiry Follow-Up', description: 'Follow up on a recent destination or trip inquiry.', defaultPrompt: 'You are calling someone who recently inquired about a trip but never booked. Ask if they have any remaining questions, what is holding them back, and offer to put together options that fit their preferences and budget. Be helpful and consultative, not pushy.', defaultTriggerTag: 'travel-inquiry', defaultDelayHours: 24, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['travel-inquiry', 'no-booking-yet'] },
    { vertical: 'TRAVEL', campaignType: 'WIN_BACK', name: 'Lapsed Traveler Re-engagement', description: 'Reach out to travelers who have not booked in over a year.', defaultPrompt: 'You are calling a former traveler who has not booked a trip in over a year. Let them know they are missed, ask how they have been, and offer to help if they are thinking about traveling again. Mention any current specials or destinations briefly. Keep it warm — this is reconnection, not pressure.', defaultTriggerTag: 'lapsed-traveler', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 96, suggestedTagsJson: ['lapsed-traveler', 'inactive-12-months'] },
    { vertical: 'TRAVEL', campaignType: 'EVENT_INVITATION', name: 'Special Occasion Trip Suggestion', description: 'Reach out about anniversary, honeymoon, or milestone travel.', defaultPrompt: "You are calling a customer about a special occasion they have coming up — anniversary, honeymoon, milestone birthday — and want to offer help planning a trip to mark it. Be celebratory and warm. Suggest you can put together a custom itinerary if they're interested.", defaultTriggerTag: 'special-occasion-travel', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['special-occasion-travel', 'anniversary-trip', 'milestone-trip'] },

    // ── COACHING ────────────────────────────────────────────────────────────
    { vertical: 'COACHING', campaignType: 'FOLLOWUP_QUOTE', name: 'Discovery Call Follow-Up', description: 'Follow up after a free discovery or strategy call.', defaultPrompt: 'You are calling to follow up after a recent discovery call. Ask if the prospect has had time to consider next steps and what questions they still have. Be helpful and consultative — your goal is to understand their needs better, not to push.', defaultTriggerTag: 'post-discovery', defaultDelayHours: 24, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['post-discovery', 'free-strategy-call'] },
    { vertical: 'COACHING', campaignType: 'CONFIRM_APPOINTMENT', name: 'Session Confirmation', description: 'Confirm an upcoming coaching session.', defaultPrompt: "You are calling to confirm the client's upcoming coaching session. Verify the date and time, ask if they need to prepare anything, and remind them where the session takes place — phone, video, or in person.", defaultTriggerTag: 'session-booked', defaultDelayHours: 1, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['session-booked', 'coaching-confirmed'] },
    { vertical: 'COACHING', campaignType: 'CONFIRM_REMINDER', name: 'Day-Of Session Reminder', description: 'Same-day reminder before a coaching session.', defaultPrompt: 'You are calling to remind the client that they have a coaching session today. Confirm the time and how to join. Wish them a productive session and let them know you are here if anything comes up.', defaultTriggerTag: 'session-today', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 4, suggestedTagsJson: ['session-today', 'reminder-day-of'] },
    { vertical: 'COACHING', campaignType: 'FOLLOWUP_REENGAGEMENT', name: 'No-Show Recovery', description: 'Reach out after a missed coaching session to reschedule.', defaultPrompt: "You are calling a client who missed their scheduled coaching session. Ask how they are doing, see what came up, and offer to reschedule. Be understanding — life happens. Make it easy for them to come back without guilt.", defaultTriggerTag: 'session-no-show', defaultDelayHours: 4, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['session-no-show', 'reschedule-needed'] },
    { vertical: 'COACHING', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Mid-Program Check-In', description: 'Progress check halfway through a coaching program.', defaultPrompt: "You are calling a client who is halfway through their coaching program. Ask how things are going, what they are getting from the work, and whether anything needs to be adjusted. Be a coach in the conversation — focus on their progress.", defaultTriggerTag: 'mid-program', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['mid-program', 'progress-check'] },
    { vertical: 'COACHING', campaignType: 'RECALL_LAPSED_SUBSCRIPTION', name: 'Coaching Renewal', description: 'Reach out as a program nears its end to discuss continuation.', defaultPrompt: "You are calling a coaching client whose program is ending soon. Ask how the journey has been, what they have accomplished, and whether they would like to continue with another phase or program. Be supportive — focus on their growth, not the sale.", defaultTriggerTag: 'program-ending', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['program-ending', 'renewal-window'] },
    { vertical: 'COACHING', campaignType: 'FOLLOWUP_REFERRAL', name: 'Referral Request', description: 'Ask a successful client for referrals.', defaultPrompt: "You are calling a coaching client who has had a great experience to ask if they know anyone who could benefit from the coach's work. Be respectful and grateful — make it clear there's no pressure and you appreciate them either way.", defaultTriggerTag: 'happy-client-referral', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 72, suggestedTagsJson: ['happy-client-referral', 'post-success'] },
    { vertical: 'COACHING', campaignType: 'ONBOARDING_WELCOME', name: 'Welcome Call', description: 'Welcome a new coaching client into the program.', defaultPrompt: "You are calling to welcome a new client into the coaching program. Walk them through what to expect in the first few sessions, how scheduling works, and any prep they should do before the first session. Set the tone for a great working relationship.", defaultTriggerTag: 'new-coaching-client', defaultDelayHours: 1, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['new-coaching-client', 'onboarding'] },
    { vertical: 'COACHING', campaignType: 'EVENT_INVITATION', name: 'Workshop Invitation', description: 'Invite the client to an upcoming workshop or group event.', defaultPrompt: 'You are calling to invite the client to an upcoming workshop or group session. Briefly describe the topic, the format, and the value they will get. Mention the date and time, and ask if they would like to register.', defaultTriggerTag: 'workshop-invite', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['workshop-invite', 'group-event'] },
    { vertical: 'COACHING', campaignType: 'WIN_BACK', name: 'Lapsed Client Re-engagement', description: 'Reach out to coaching clients who have been inactive.', defaultPrompt: "You are calling a coaching client who has been quiet for a while. Let them know they are missed, ask how they are doing, and gently invite them to come back to the work when they are ready. No pressure — this is a check-in, not a sales call.", defaultTriggerTag: 'lapsed-coaching-client', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 96, suggestedTagsJson: ['lapsed-coaching-client', 'inactive-90-days'] },
    { vertical: 'COACHING', campaignType: 'FOLLOWUP_TESTIMONIAL', name: 'Success Story Request', description: 'Ask a successful client to share their story as a testimonial.', defaultPrompt: "You are calling a client whose coaching journey has gone well to ask if they would be willing to share their story as a brief testimonial. Mention how meaningful their words can be for others considering coaching. Make participation easy and offer multiple formats — written, video, or audio.", defaultTriggerTag: 'success-story-ask', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 72, suggestedTagsJson: ['success-story-ask', 'transformation-complete'] },
    { vertical: 'COACHING', campaignType: 'PAYMENT_REMINDER', name: 'Coaching Payment Reminder', description: 'Remind a client about an upcoming or overdue payment.', defaultPrompt: 'You are calling to remind the client that a payment for their coaching program is due. Be respectful and matter-of-fact. Offer to help them complete the payment by sending a link or processing it over the phone.', defaultTriggerTag: 'coaching-payment-due', defaultDelayHours: 0, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['coaching-payment-due', 'invoice-overdue'] },

    // ── CONSULTING ──────────────────────────────────────────────────────────
    { vertical: 'CONSULTING', campaignType: 'FOLLOWUP_QUOTE', name: 'Proposal Follow-Up', description: 'Follow up on an open proposal that has not been signed.', defaultPrompt: "You are calling a prospect who received a consulting proposal but has not yet responded. Ask if they have had time to review it and what questions they have. Be available to walk through any section that needs clarification. Be helpful, not pushy.", defaultTriggerTag: 'proposal-sent', defaultDelayHours: 48, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['proposal-sent', 'pending-decision'] },
    { vertical: 'CONSULTING', campaignType: 'CONFIRM_BOOKING', name: 'Engagement Kickoff', description: 'Confirm a new consulting engagement is starting.', defaultPrompt: 'You are calling to confirm the start of a consulting engagement. Walk through the kickoff timeline, who will be the primary contacts, what to expect in the first week, and any prep work the client should complete before the first working session.', defaultTriggerTag: 'engagement-starting', defaultDelayHours: 1, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['engagement-starting', 'new-engagement'] },
    { vertical: 'CONSULTING', campaignType: 'CONFIRM_REMINDER', name: 'Discovery Call Reminder', description: 'Reminder before a scheduled discovery or scoping call.', defaultPrompt: "You are calling to remind the prospect about their upcoming discovery call. Confirm the date, time, and the format — phone or video. Mention what topics will be discussed and ask if there is anything they want to make sure gets covered.", defaultTriggerTag: 'discovery-tomorrow', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 12, suggestedTagsJson: ['discovery-tomorrow', 'scoping-call'] },
    { vertical: 'CONSULTING', campaignType: 'FOLLOWUP_QUALITY_CONTROL', name: 'Project Milestone Check-In', description: 'Check in with a client at a project milestone.', defaultPrompt: 'You are calling a consulting client who has just hit a project milestone. Ask how they feel about the work so far, whether anything needs to be adjusted, and confirm alignment on the next phase. Be a partner in the conversation, not just a status reporter.', defaultTriggerTag: 'milestone-reached', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['milestone-reached', 'phase-complete'] },
    { vertical: 'CONSULTING', campaignType: 'DOCUMENT_REQUEST', name: 'Document & Data Request', description: 'Request supporting documentation or data from the client.', defaultPrompt: 'You are calling a client to follow up on documents or data that are still outstanding. Specify what is needed and why it matters for the engagement. Offer to help them find or compile the items. Be respectful of their time.', defaultTriggerTag: 'docs-pending', defaultDelayHours: 24, defaultMaxRetries: 3, defaultRetryIntervalHours: 48, suggestedTagsJson: ['docs-pending', 'data-needed'] },
    { vertical: 'CONSULTING', campaignType: 'RECALL_ANNUAL_REVIEW', name: 'Quarterly Business Review', description: 'Schedule a quarterly review with an active client.', defaultPrompt: "You are calling an active consulting client to schedule the quarterly business review. Briefly describe what will be covered — progress, what's working, what to adjust, and the next quarter's priorities — and offer two or three time options.", defaultTriggerTag: 'qbr-due', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['qbr-due', 'quarterly-review'] },
    { vertical: 'CONSULTING', campaignType: 'CONTRACT_RENEWAL', name: 'Engagement Renewal', description: 'Discuss continuation as an engagement nears its end.', defaultPrompt: "You are calling a consulting client whose engagement is approaching its end date. Ask what they have valued most, what they would like to continue, and discuss options for renewal — whether that is another phase, a retainer, or a different scope.", defaultTriggerTag: 'engagement-ending', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['engagement-ending', 'renewal-window'] },
    { vertical: 'CONSULTING', campaignType: 'FOLLOWUP_REFERRAL', name: 'Client Referral Request', description: 'Ask a satisfied client for introductions to others.', defaultPrompt: "You are calling a client who has had a great experience to ask if they know anyone in their network who might benefit from similar work. Be specific about the kind of introduction that helps. Make it clear there is no pressure and you appreciate them either way.", defaultTriggerTag: 'referral-ask-consulting', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 72, suggestedTagsJson: ['referral-ask-consulting', 'happy-client'] },
    { vertical: 'CONSULTING', campaignType: 'RECALL_INACTIVE', name: 'Past Client Check-In', description: 'Reconnect with a former client a year or more after engagement.', defaultPrompt: "You are calling a former consulting client to check in. It has been a while — ask how things are going, what has changed, and whether there is anything you can support them with. Be genuinely curious. The goal is to reconnect, not to sell.", defaultTriggerTag: 'past-client-checkin', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 96, suggestedTagsJson: ['past-client-checkin', 'one-year-out'] },
    { vertical: 'CONSULTING', campaignType: 'ABANDONED_INQUIRY', name: 'Cold Lead Nurture', description: 'Re-engage a cold inbound inquiry that went silent.', defaultPrompt: "You are calling a prospect who reached out months ago but never moved forward. Acknowledge it has been a while, ask if their priorities have shifted, and offer to be a sounding board for whatever they are working on now. Be helpful, not transactional.", defaultTriggerTag: 'cold-lead', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 96, suggestedTagsJson: ['cold-lead', 'silent-prospect'] },
    { vertical: 'CONSULTING', campaignType: 'EVENT_INVITATION', name: 'Strategy Session Invite', description: 'Invite a prospect or client to a free strategy session or workshop.', defaultPrompt: 'You are calling to invite the contact to a free strategy session or workshop the firm is hosting. Briefly describe the topic, the date, and the value they will take away. Make it clear there is no obligation and the goal is to deliver real insights.', defaultTriggerTag: 'strategy-session-invite', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['strategy-session-invite', 'workshop-invite'] },
    { vertical: 'CONSULTING', campaignType: 'FOLLOWUP_POST_OFFER', name: 'Recommendation Decision Follow-Up', description: 'Follow up after delivering a recommendation or strategic advice.', defaultPrompt: "You are calling a client a few weeks after delivering a recommendation or report. Ask whether they have had a chance to discuss it internally, what questions or pushback came up, and whether you can support implementation. Be a partner in the decision, not just the deliverer of the deck.", defaultTriggerTag: 'post-recommendation', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['post-recommendation', 'awaiting-decision'] },
  ]

  // ── EVENTS (Holidays, Sales, Special) ───────────────────────────────────
  // Tag-driven: tenant tags contacts manually before each event date.
  const eventTemplates = [
    // ── HOLIDAYS ───────────────────────────────────────────────────────────
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Christmas Greeting', description: 'Warm holiday wishes to your customer list.', defaultPrompt: 'You are calling to wish the customer a merry Christmas on behalf of the business. Thank them for being a valued customer this year, share any holiday hours or specials briefly if relevant, and wish them a wonderful holiday season. Keep it warm, brief, and personal — not salesy.', defaultTriggerTag: 'holiday-christmas', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-christmas', 'december'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'New Year Greeting', description: 'Happy New Year wishes to your customers.', defaultPrompt: 'You are calling to wish the customer a happy New Year. Thank them for their business in the past year and let them know you look forward to serving them in the coming year. Mention any new-year specials if relevant. Keep it warm and concise.', defaultTriggerTag: 'holiday-newyear', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-newyear', 'january'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: "Valentine's Day Special", description: "Reach out for Valentine's Day with offers or greetings.", defaultPrompt: "You are calling about a Valentine's Day greeting or special offer. Wish the customer a happy Valentine's Day, mention any current promotion if applicable, and invite them to take advantage if interested. Keep it light and friendly.", defaultTriggerTag: 'holiday-valentines', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-valentines', 'february'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: "Mother's Day Greeting", description: "Honor Mother's Day with a warm message or offer.", defaultPrompt: "You are calling to wish the customer a happy Mother's Day on behalf of the business. If they are a mother, recognize them. Mention any Mother's Day specials or gift suggestions if applicable. Keep it warm and personal.", defaultTriggerTag: 'holiday-mothers', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-mothers', 'may'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: "Father's Day Greeting", description: "Honor Father's Day with a warm message or offer.", defaultPrompt: "You are calling to wish the customer a happy Father's Day on behalf of the business. If they are a father, recognize them. Mention any Father's Day specials or gift suggestions if applicable. Keep it warm and personal.", defaultTriggerTag: 'holiday-fathers', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-fathers', 'june'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Thanksgiving Thank You', description: 'Express gratitude to your customers at Thanksgiving.', defaultPrompt: 'You are calling to thank the customer on behalf of the business this Thanksgiving. Tell them sincerely that the team appreciates their continued support throughout the year. Wish them a wonderful Thanksgiving with their family. No selling — this is a pure thank-you call.', defaultTriggerTag: 'holiday-thanksgiving', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-thanksgiving', 'november'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Black Friday Sale Announcement', description: 'Announce your Black Friday sale to engaged customers.', defaultPrompt: 'You are calling to let the customer know about the business\'s Black Friday sale. Briefly describe what is on offer, the dates, and how to take advantage. Keep it short and let them know you wanted to give them a heads-up before the rush.', defaultTriggerTag: 'holiday-blackfriday', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 12, suggestedTagsJson: ['holiday-blackfriday', 'november-sale'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Cyber Monday Offer', description: 'Reach out about Cyber Monday online deals.', defaultPrompt: 'You are calling about the business\'s Cyber Monday offer. Briefly describe the online deal or promo code, when it expires, and where to redeem it. Keep it short and friendly.', defaultTriggerTag: 'holiday-cybermonday', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 12, suggestedTagsJson: ['holiday-cybermonday', 'november-sale'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Independence Day Greeting', description: 'July 4th greeting and any holiday hours/promos.', defaultPrompt: 'You are calling to wish the customer a happy Independence Day. Share any holiday hours or specials briefly if relevant. Keep it friendly and brief.', defaultTriggerTag: 'holiday-independence', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-independence', 'july'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Halloween Greeting', description: 'Lighthearted Halloween outreach with optional offer.', defaultPrompt: 'You are calling about a fun Halloween greeting on behalf of the business. Wish them a happy Halloween, mention any spooky specials or themed offers if applicable. Keep it playful and light.', defaultTriggerTag: 'holiday-halloween', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-halloween', 'october'] },
    { vertical: 'EVENTS', subcategory: 'HOLIDAY', campaignType: 'EVENT_INVITATION', name: 'Easter Greeting', description: 'Easter holiday greeting with optional spring promo.', defaultPrompt: 'You are calling to wish the customer a happy Easter on behalf of the business. Mention any spring or Easter specials if relevant. Keep it warm and brief.', defaultTriggerTag: 'holiday-easter', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['holiday-easter', 'april'] },

    // ── SALES EVENTS ──────────────────────────────────────────────────────
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Flash Sale Announcement', description: 'Quick limited-time sale notification.', defaultPrompt: 'You are calling to let the customer know about a flash sale that is starting now. Briefly describe what is on offer, when it ends, and how to take advantage. Emphasize the urgency without being pushy. Keep it short — this is a heads-up call, not a hard sell.', defaultTriggerTag: 'sale-flash', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 6, suggestedTagsJson: ['sale-flash', 'limited-time'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'End-of-Quarter Sale', description: 'Push end-of-quarter promotions to your contact list.', defaultPrompt: 'You are calling about an end-of-quarter sale. Describe the offer briefly, the deadline, and how to take advantage. Mention this is a limited-time promotion that won\'t be repeated. Keep it informative and friendly.', defaultTriggerTag: 'sale-quarter-end', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-quarter-end', 'quarterly'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Anniversary Sale', description: 'Celebrate your business anniversary with a customer-wide promo.', defaultPrompt: 'You are calling to invite the customer to celebrate the business\'s anniversary. Share the special offer, mention how long the business has been serving customers, and thank them for being part of that journey. Keep it warm and grateful.', defaultTriggerTag: 'sale-anniversary', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-anniversary', 'milestone'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Spring Clearance', description: 'Spring clearance sale outreach.', defaultPrompt: 'You are calling about the business\'s spring clearance sale. Briefly describe what is on offer and the duration. Keep it friendly and short.', defaultTriggerTag: 'sale-spring', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-spring', 'seasonal-sale'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Summer Clearance', description: 'Summer clearance sale outreach.', defaultPrompt: 'You are calling about the business\'s summer clearance sale. Briefly describe what is on offer and when it ends. Keep it light and friendly.', defaultTriggerTag: 'sale-summer', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-summer', 'seasonal-sale'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Fall Clearance', description: 'Fall clearance sale outreach.', defaultPrompt: 'You are calling about the business\'s fall clearance sale. Briefly describe what is on offer and when it ends. Keep it warm and brief.', defaultTriggerTag: 'sale-fall', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-fall', 'seasonal-sale'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Winter Clearance', description: 'Winter clearance sale outreach.', defaultPrompt: 'You are calling about the business\'s winter clearance sale. Briefly describe what is on offer and when it ends. Keep it light and friendly.', defaultTriggerTag: 'sale-winter', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-winter', 'seasonal-sale'] },
    { vertical: 'EVENTS', subcategory: 'SALES_EVENT', campaignType: 'EVENT_INVITATION', name: 'Back-to-School Promo', description: 'Back-to-school season offer outreach.', defaultPrompt: 'You are calling about the business\'s back-to-school promotion. Briefly describe what is on offer and when it ends. Mention any service or product that fits the season. Keep it friendly and brief.', defaultTriggerTag: 'sale-back-to-school', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 24, suggestedTagsJson: ['sale-back-to-school', 'august-september'] },

    // ── SPECIAL EVENTS ────────────────────────────────────────────────────
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'BIRTHDAY_ANNIVERSARY', name: 'Customer Birthday Wish', description: 'Personalized birthday call to a customer.', defaultPrompt: 'You are calling to wish the customer a happy birthday on behalf of the business. Make it warm and personal, not transactional. If there is a birthday gift or discount, mention it once and politely. Otherwise just a sincere happy birthday is enough.', defaultTriggerTag: 'birthday', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['birthday', 'customer-birthday'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'BIRTHDAY_ANNIVERSARY', name: 'Customer Anniversary', description: 'Mark the anniversary of a customer relationship.', defaultPrompt: 'You are calling to mark a special anniversary — the customer has been with the business for a meaningful amount of time. Thank them sincerely for being a loyal customer, mention how long it has been if known, and let them know they are appreciated. Keep it warm.', defaultTriggerTag: 'customer-anniversary', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['customer-anniversary', 'loyalty-milestone'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'WIN_BACK', name: 'We Miss You Reactivation', description: 'Reach out to lapsed customers.', defaultPrompt: 'You are calling a customer who has not been seen in a while. Let them know they are missed, ask how they are doing, and invite them to come back. If there is a reactivation offer, mention it once. Be warm — this is about reconnection, not pressure.', defaultTriggerTag: 'lapsed-customer', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 72, suggestedTagsJson: ['lapsed-customer', 'inactive-90-days', 'we-miss-you'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'FOLLOWUP_REFERRAL', name: 'Referral Request', description: 'Ask a satisfied customer to refer friends or family.', defaultPrompt: 'You are calling a happy customer to ask if they know anyone who could benefit from the business\'s services. Be respectful and grateful. Mention any referral incentive if applicable. Make it clear there is no pressure.', defaultTriggerTag: 'referral-ask', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['referral-ask', 'happy-customer', 'post-positive-review'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'FOLLOWUP_TESTIMONIAL', name: 'Review Request', description: 'Politely ask a customer to leave an online review.', defaultPrompt: 'You are calling to politely ask the customer if they would be willing to leave an online review of their experience with the business. Mention how helpful reviews are for small businesses. If they agree, offer to text or email them the link. Keep it brief and never push.', defaultTriggerTag: 'review-ask', defaultDelayHours: 24, defaultMaxRetries: 1, defaultRetryIntervalHours: 48, suggestedTagsJson: ['review-ask', 'post-service'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'LOYALTY_REWARD', name: 'Service Milestone', description: 'Celebrate a customer reaching a service milestone (10th visit, etc).', defaultPrompt: 'You are calling to congratulate the customer on reaching a service milestone with the business — for example their 10th visit or 5 years as a member. Thank them, share any milestone reward, and let them know they are valued. Keep it warm and celebratory.', defaultTriggerTag: 'service-milestone', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['service-milestone', 'loyalty-tier'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'VIP_CHECKIN', name: 'VIP-Only Event Invite', description: 'Invite top customers to an exclusive event.', defaultPrompt: 'You are calling to invite the customer to a VIP-only event the business is hosting. Briefly describe what the event is, the date and time, and that it is for top customers only. Ask if they would like to RSVP. Keep it warm and exclusive — they should feel valued.', defaultTriggerTag: 'vip-event-invite', defaultDelayHours: 0, defaultMaxRetries: 2, defaultRetryIntervalHours: 48, suggestedTagsJson: ['vip-event-invite', 'top-customer', 'exclusive-event'] },
    { vertical: 'EVENTS', subcategory: 'SPECIAL_EVENT', campaignType: 'LOYALTY_REWARD', name: 'Loyalty Tier Upgrade', description: 'Notify a customer they reached a new loyalty tier.', defaultPrompt: 'You are calling to congratulate the customer on reaching a new loyalty tier with the business. Briefly describe the new benefits and thank them for their continued support. Keep it warm and celebratory — this is a recognition call, not a sales call.', defaultTriggerTag: 'loyalty-tier-upgrade', defaultDelayHours: 0, defaultMaxRetries: 1, defaultRetryIntervalHours: 24, suggestedTagsJson: ['loyalty-tier-upgrade', 'tier-change'] },
  ]

  templates.push(...(eventTemplates as typeof templates))

  for (const t of templates) {
    await prisma.campaignTemplate.upsert({
      where: { vertical_campaignType_name: { vertical: t.vertical as any, campaignType: t.campaignType as any, name: t.name } },
      update: {
        subcategory: ((t as any).subcategory ?? null) as any,
        name: t.name,
        description: t.description,
        defaultPrompt: t.defaultPrompt,
        defaultTriggerTag: t.defaultTriggerTag,
        defaultDelayHours: t.defaultDelayHours,
        defaultMaxRetries: t.defaultMaxRetries,
        defaultRetryIntervalHours: t.defaultRetryIntervalHours,
        suggestedTagsJson: t.suggestedTagsJson as any,
      },
      create: {
        vertical: t.vertical as any,
        campaignType: t.campaignType as any,
        subcategory: ((t as any).subcategory ?? null) as any,
        name: t.name,
        description: t.description,
        defaultPrompt: t.defaultPrompt,
        defaultTriggerTag: t.defaultTriggerTag,
        defaultDelayHours: t.defaultDelayHours,
        defaultMaxRetries: t.defaultMaxRetries,
        defaultRetryIntervalHours: t.defaultRetryIntervalHours,
        suggestedTagsJson: t.suggestedTagsJson as any,
      },
    })
  }
  console.log(`  [seed] ${templates.length} campaign templates seeded (${eventTemplates.length} new event templates)`)

  console.log('[seed] done.')
}

main()
  .catch((err) => {
    console.error('[seed] error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
