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

const router: IRouter = Router()

router.use('/', healthRouter)
router.use('/api/auth', authRouter)
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

export default router
