/**
 * gmb-audit — public entry point (V2).
 *
 * `evaluate()` orchestrates: collect every data source → score into the
 * language-neutral {@link AuditResult}. Keys are injected so the engine never
 * touches OrbisVoice config — keeps the whole directory portable into
 * MyOrbisLocal.
 */
import { collect, type CollectKeys } from './collect.js'
import { scoreAudit } from './scoring.js'
import type { AuditInput } from './types.js'
import type { AuditResult } from './model.js'

export * from './types.js'
export * from './model.js'
export { collect } from './collect.js'
export { scoreAudit } from './scoring.js'
export { SerperProvider, fetchSerperReviews } from './providers/serper.js'

export async function evaluate(input: AuditInput, keys: CollectKeys): Promise<AuditResult> {
  const data = await collect(input, keys)
  return scoreAudit(data, 'serper.dev')
}
