import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Deploy stamp, read ONCE at process boot. The deploy script writes
 * apps/api/dist/deploy-stamp.txt before injecting dist + restarting the
 * container; the running process reads it here at module load. The deploy then
 * curls /version and confirms the served stamp matches what it just wrote —
 * proving the restart actually picked up THIS deploy's code (catches a restart
 * that didn't happen / raced the file injection and is serving stale code).
 * Falls back to 'dev' when the file is absent (local runs).
 */
function readStamp(): string {
  try {
    // Compiled to dist/lib/deploy-stamp.js → ../deploy-stamp.txt = dist/deploy-stamp.txt
    return readFileSync(join(__dirname, '..', 'deploy-stamp.txt'), 'utf8').trim() || 'unknown'
  } catch {
    return 'dev'
  }
}

export const DEPLOY_STAMP = readStamp()
