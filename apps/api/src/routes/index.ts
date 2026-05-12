import { Router, type IRouter } from 'express'
import healthRouter from './health.js'
import authRouter from './auth.js'
import tenantRouter from './tenant.js'
import businessDNARouter from './business-dna.js'
import promptsRouter from './prompts.js'
import agentsRouter from './agents.js'
import channelsRouter from './channels.js'
import adminRouter from './admin.js'
import { billingRouter } from './billing.js'
import integrationsRouter from './integrations.js'
import appointmentsRouter from './appointments.js'
import { widgetRouter } from './widget.js'
import { phoneNumbersRouter } from './phone-numbers.js'
import contactsRouter from './contacts.js'
import campaignsRouter from './campaigns.js'
import outboundCampaignsRouter from './outbound-campaigns.js'
import affiliateRouter from './affiliate.js'
import staffRouter from './staff.js'
import conversationsRouter from './conversations.js'
import notificationsRouter from './notifications.js'
import dashboardRouter from './dashboard.js'
import onboardingRouter from './onboarding.js'
import a2pRouter from './a2p.js'
import pushRouter from './push.js'
import aiAssistRouter from './ai-assist.js'
import knowledgeBaseRouter from './knowledge-base.js'
import { twilioInboundRouter } from './twilio-inbound.js'
import { outboundWebhooksRouter } from './outbound-webhooks.js'
import internalGatewayRouter from './internal-gateway.js'
import internalMailRouter from './internal-mail.js'
import partnerRouter from './partner.js'
import partnerMailboxRouter from './partner-mailbox.js'
import marketingAssetsRouter from './marketing-assets.js'
import publicRouter from './public.js'
import authGoogleRouter from './auth-google.js'
import { validateTwilioWebhook } from '../middleware/twilio-signature.js'

const router: IRouter = Router()

router.use('/', healthRouter)
router.use('/api/auth', authRouter)
// Google Sign-In (Thing A) — anonymous OAuth, distinct from /api/integrations/google/*
// (which connects an authenticated tenant's Gmail to the agent — Thing B).
router.use('/api', authGoogleRouter)
// Twilio webhooks — public (no auth). Signature-validated. Must precede auth-gated /api routers.
router.use('/api', validateTwilioWebhook, twilioInboundRouter)
router.use('/api', validateTwilioWebhook, outboundWebhooksRouter)
// Internal gateway tool endpoints — protected by shared-secret middleware,
// not the standard auth/RBAC stack. Mounted before auth-gated routers.
router.use('/api', internalGatewayRouter)
// Internal mail ingestion — Postfix pipe -> POST raw RFC 5322 here.
// Protected by MAIL_INGEST_TOKEN shared secret; raw body parser set in index.ts.
router.use('/api', internalMailRouter)
router.use('/api', marketingAssetsRouter) // public /public/marketing-asset/:filename — no auth
router.use('/api', publicRouter)        // public /public/social-links — no auth
router.use('/api', billingRouter)       // before auth-gated routers — contains public /billing/plans
router.use('/api', widgetRouter)        // contains public /public/widget/session
router.use('/api', pushRouter)          // contains public /push/vapid-public-key — must precede tenantRouter
router.use('/api', integrationsRouter)  // contains public /integrations/google/callback — must precede tenantRouter
router.use('/', affiliateRouter)        // contains public /api/public/track/click — must precede tenantRouter; also has user-scoped (non-tenant) routes for affiliates who don't have a tenant
// Partner dashboard routes (/api/partner/*) — gated by requirePartnerContext.
// Mounted BEFORE tenantRouter because partners are not tenant members.
router.use('/api', partnerRouter)
router.use('/api', partnerMailboxRouter)
router.use('/api', tenantRouter)
router.use('/api', businessDNARouter)
router.use('/api', promptsRouter)
router.use('/api', agentsRouter)
router.use('/api', channelsRouter)
router.use('/api/admin', adminRouter)
router.use('/api', appointmentsRouter)
router.use('/api', phoneNumbersRouter)
router.use('/api', contactsRouter)
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
