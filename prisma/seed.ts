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
  ]

  for (const t of templates) {
    await prisma.campaignTemplate.upsert({
      where: { vertical_campaignType: { vertical: t.vertical as any, campaignType: t.campaignType as any } },
      update: {
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
  console.log(`  [seed] ${templates.length} campaign templates seeded`)

  console.log('[seed] done.')
}

main()
  .catch((err) => {
    console.error('[seed] error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
