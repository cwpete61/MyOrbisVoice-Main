import Redis from 'ioredis'
import { getEnv } from '@voiceautomation/config'

let _redis: Redis | undefined

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    _redis.on('error', (err: Error) => {
      console.error('[redis] error:', err.message)
    })
  }
  return _redis
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = undefined
  }
}
