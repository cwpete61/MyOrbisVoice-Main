import { Router, type IRouter } from 'express'
import { prisma } from '../lib/prisma.js'
import { getRedis } from '../lib/redis.js'

const router: IRouter = Router()

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
