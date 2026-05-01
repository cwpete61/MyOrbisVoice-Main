import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireTenantContext } from '../middleware/rbac.js'
import * as notifSvc from '../services/notification.service.js'

const router: IRouter = Router()
router.use(authenticate, requireTenantContext)

router.get('/notifications', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    const result   = await notifSvc.listNotifications(tenantId)
    res.json({ data: result })
  } catch (err) { next(err) }
})

router.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await notifSvc.markRead(tenantId, req.params.id!)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    const tenantId = req.user!.currentTenantId!
    await notifSvc.markAllRead(tenantId)
    res.json({ data: { ok: true } })
  } catch (err) { next(err) }
})

export default router
