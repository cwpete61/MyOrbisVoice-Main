import { Router, type IRouter } from 'express'
import healthRouter from './health.js'
import authRouter from './auth.js'
import tenantRouter from './tenant.js'
import businessDNARouter from './business-dna.js'
import listingsRouter from './listings.js'
import promptsRouter from './prompts.js'
import agentsRouter from './agents.js'
import channelsRouter from './channels.js'
import { paymentsRouter } from './payments.js'
import adminRouter from './admin.js'
import { billingRouter } from './billing.js'
import integrationsRouter from './integrations.js'
import appointmentsRouter from './appointments.js'
import { widgetRouter } from './widget.js'
import { phoneNumbersRouter } from './phone-numbers.js'
import contactsRouter from './contacts.js'
import crmRouter from './crm.js'
import campaignsRouter from './campaigns.js'
import outboundCampaignsRouter from './outbound-campaigns.js'
import affiliateRouter from './affiliate.js'
import staffRouter from './staff.js'
import conversationsRouter from './conversations.js'
import notificationsRouter from './notifications.js'
import dashboardRouter from './dashboard.js'
import onboardingRouter from './onboarding.js'
import a2pRouter from './a2p.js'
import partnerA2pRouter from './partner-a2p.js'
import webhooksTwilioA2pRouter from './webhooks-twilio-a2p.js'
import pushRouter from './push.js'
import aiAssistRouter from './ai-assist.js'
import knowledgeBaseRouter from './knowledge-base.js'
import { twilioInboundRouter } from './twilio-inbound.js'
import { outboundWebhooksRouter } from './outbound-webhooks.js'
import internalGatewayRouter from './internal-gateway.js'
import internalMailRouter from './internal-mail.js'
import partnerRouter from './partner.js'
import partnerCrmRouter from './partner-crm.js'
import partnerScriptsRouter from './partner-scripts.js'
import agentProspectsRouter from './agent-prospects.js'
import partnerCampaignsRouter from './partner-campaigns.js'
import partnerMailboxRouter from './partner-mailbox.js'
import partnerGmbRouter from './partner-gmb.js'
import partnerWebinarMarketingRouter from './partner-webinar-marketing.js'
import partnerDailyActivityRouter from './partner-daily-activity.js'
import meTwilioRouter from './me-twilio.js'
import leadEngineRouter from './lead-engine.js'
import sendingDomainRouter from './sending-domain.js'
import coldEmailRouter from './cold-email.js'
import unsubscribeRouter from './unsubscribe.js'
import webhooksSesRouter from './webhooks-ses.js'
import emailPolicyRouter from './email-policy.js'
import marketingAssetsRouter from './marketing-assets.js'
import marketingKitRouter from './marketing-kit.js'
import publicRouter from './public.js'
import { publicBookingRouter } from './public-booking.js'
import authGoogleRouter from './auth-google.js'
import authOidcRouter from './auth-oidc.js'
import { validateTwilioWebhook } from '../middleware/twilio-signature.js'
import { demoGuard } from '../middleware/demo-guard.js'

const router: IRouter = Router()

// Block money/irreversible actions for the public DEMO sandbox tenant. Cheap —
// only inspects non-GET requests to blocked prefixes. Must run before the routers.
router.use(demoGuard)

router.use('/', healthRouter)
router.use('/api/auth', authRouter)
// Phase 2.4 — Keycloak OIDC login (public, pre-auth; feature-flagged OFF by default)
router.use('/api/auth/oidc', authOidcRouter)
// Google Sign-In (Thing A) — anonymous OAuth, distinct from /api/integrations/google/*
// (which connects an authenticated tenant's Gmail to the agent — Thing B).
router.use('/api', authGoogleRouter)
// Twilio webhooks — public (no auth). Signature-validated. Must precede auth-gated /api routers.
router.use('/api', validateTwilioWebhook, twilioInboundRouter)
router.use('/api', validateTwilioWebhook, outboundWebhooksRouter)
router.use('/api', validateTwilioWebhook, webhooksTwilioA2pRouter)
// Internal gateway tool endpoints — protected by shared-secret middleware,
// not the standard auth/RBAC stack. Mounted before auth-gated routers.
router.use('/api', internalGatewayRouter)
// Internal mail ingestion — Postfix pipe -> POST raw RFC 5322 here.
// Protected by MAIL_INGEST_TOKEN shared secret; raw body parser set in index.ts.
router.use('/api', internalMailRouter)
router.use('/api', marketingAssetsRouter) // public /public/marketing-asset/:filename — no auth
router.use('/', marketingKitRouter)       // /api/public/marketing-kit/* (no auth) + /api/admin/marketing-kit/* (PlatformAdmin)
router.use('/api', publicRouter)        // public /public/social-links — no auth
router.use('/api', unsubscribeRouter)   // public /public/unsubscribe — no auth (email recipients)
router.use('/api', webhooksSesRouter)   // public /webhooks/ses — no auth (SNS; signature-verified)
router.use('/api', publicBookingRouter) // public /public/partners/:slug/booking-info|slots|bookings (E.4) — no auth
router.use('/api', billingRouter)       // before auth-gated routers — contains public /billing/plans
router.use('/api', widgetRouter)        // contains public /public/widget/session
router.use('/api', pushRouter)          // contains public /push/vapid-public-key — must precede tenantRouter
router.use('/api', integrationsRouter)  // contains public /integrations/google/callback — must precede tenantRouter
// Phase F.4 — email policy + ESP webhooks. Mounted BEFORE affiliateRouter
// because affiliateRouter's inner tenantRouter applies authenticate to all
// /api/* paths, which would 401 our public webhook endpoints. Routes inside
// this router have their own auth (authenticate + requirePlatformAdmin on
// admin routes, authenticate + requirePartnerContext on partner routes).
router.use('/api', emailPolicyRouter)
router.use('/', affiliateRouter)        // contains public /api/public/track/click — must precede tenantRouter; also has user-scoped (non-tenant) routes for affiliates who don't have a tenant
// Partner dashboard routes (/api/partner/*) — gated by requirePartnerContext.
// Mounted BEFORE tenantRouter because partners are not tenant members.
router.use('/api', partnerRouter)
router.use('/api', partnerA2pRouter)
router.use('/api', partnerCrmRouter)
router.use('/api', partnerScriptsRouter)
router.use('/api', partnerCampaignsRouter)
router.use('/api', partnerMailboxRouter)
router.use('/api', partnerGmbRouter)
router.use('/api', partnerWebinarMarketingRouter)
router.use('/api', partnerDailyActivityRouter)
router.use('/api', meTwilioRouter)
router.use('/api', leadEngineRouter)
router.use('/api', sendingDomainRouter)
router.use('/api', coldEmailRouter)
router.use('/api', tenantRouter)
router.use('/api', businessDNARouter)
router.use('/api', listingsRouter)
router.use('/api', promptsRouter)
router.use('/api', agentsRouter)
router.use('/api', channelsRouter)
router.use('/api', paymentsRouter)
router.use('/api/admin', adminRouter)
router.use('/api/admin', agentProspectsRouter)
router.use('/api', appointmentsRouter)
router.use('/api', phoneNumbersRouter)
router.use('/api', contactsRouter)
router.use('/api', crmRouter)
router.use('/api', campaignsRouter)
router.use('/api', outboundCampaignsRouter)
router.use('/api', staffRouter)
router.use('/api', conversationsRouter)
router.use('/api', notificationsRouter)
router.use('/api', dashboardRouter)
router.use('/api', onboardingRouter)
router.use('/api', a2pRouter)
router.use('/api', aiAssistRouter)
router.use('/api/knowledge-base', knowledgeBaseRouter)

export default router
