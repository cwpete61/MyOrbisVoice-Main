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
import affiliateRouter from './affiliate.js'
import conversationsRouter from './conversations.js'
import notificationsRouter from './notifications.js'
import { twilioInboundRouter } from './twilio-inbound.js'
import { outboundWebhooksRouter } from './outbound-webhooks.js'
import { validateTwilioWebhook } from '../middleware/twilio-signature.js'

const router: IRouter = Router()

router.use('/', healthRouter)
router.use('/api/auth', authRouter)
// Twilio webhooks — public (no auth). Signature-validated. Must precede auth-gated /api routers.
// Mounted at /api so router-internal paths (/webhooks/twilio/voice etc.) resolve correctly.
router.use('/api', validateTwilioWebhook, twilioInboundRouter)
router.use('/api', validateTwilioWebhook, outboundWebhooksRouter)
router.use('/api', billingRouter)       // before auth-gated routers — contains public /billing/plans
router.use('/api', widgetRouter)        // contains public /public/widget/session
router.use('/api', tenantRouter)
router.use('/api', businessDNARouter)
router.use('/api', promptsRouter)
router.use('/api', agentsRouter)
router.use('/api', channelsRouter)
router.use('/api/admin', adminRouter)
router.use('/api', integrationsRouter)
router.use('/api', appointmentsRouter)
router.use('/api', phoneNumbersRouter)
router.use('/api', contactsRouter)
router.use('/api', campaignsRouter)
router.use('/', affiliateRouter)
router.use('/api', conversationsRouter)
router.use('/api', notificationsRouter)

export default router
