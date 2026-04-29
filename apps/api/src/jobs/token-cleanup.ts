import { prisma } from '../lib/prisma.js'

// Purge refresh tokens that are expired or revoked and older than 7 days.
// Keeps the table lean without losing auditability on recently-revoked tokens.
async function runTokenCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: cutoff } },
        { revokedAt: { lt: cutoff } },
      ],
    },
  })

  if (count > 0) {
    console.log(`[token-cleanup] removed ${count} stale refresh token(s)`)
  }
}

// Runs every 6 hours. Returns the interval handle so the caller can clear it.
export function startTokenCleanupJob(): ReturnType<typeof setInterval> {
  const INTERVAL_MS = 6 * 60 * 60 * 1000

  // Run once at startup to clear any backlog, then on schedule
  runTokenCleanup().catch((err: unknown) => {
    console.error('[token-cleanup] startup run failed:', err)
  })

  return setInterval(() => {
    runTokenCleanup().catch((err: unknown) => {
      console.error('[token-cleanup] scheduled run failed:', err)
    })
  }, INTERVAL_MS)
}
