import { Router, type IRouter } from 'express'
import { prisma } from '../lib/prisma.js'
import { getRedis } from '../lib/redis.js'
import { DEPLOY_STAMP } from '../lib/deploy-stamp.js'

const router: IRouter = Router()

// Always-200 build marker. The deploy verifies the running process serves the
// stamp it just injected (proves the restart picked up new code). No DB/Redis
// gate so a degraded dependency can't mask a stale-code deploy.
router.get('/version', (_req, res) => {
  res.json({ stamp: DEPLOY_STAMP })
})

router.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks['database'] = 'ok'
  } catch {
    checks['database'] = 'error'
  }

  try {
    const pong = await getRedis().ping()
    checks['redis'] = pong === 'PONG' ? 'ok' : 'error'
  } catch {
    checks['redis'] = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  })
})

export default router
