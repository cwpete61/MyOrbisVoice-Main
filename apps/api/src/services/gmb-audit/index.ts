/**
 * gmb-audit — public entry point.
 *
 * `evaluate()` orchestrates: provider lookup → pure scoring → AuditResult.
 * The provider is injected so this module never touches OrbisVoice config; the
 * caller (gmb-evaluation.service) fetches the Serper key and constructs the
 * provider. This keeps the whole directory portable into MyOrbisLocal.
 */
import { scoreAudit } from './scoring.js'
import type { AuditInput, AuditResult, GbpDataProvider, GbpLookupResult } from './types.js'

export * from './types.js'
export { SerperProvider } from './providers/serper.js'
export { scoreAudit } from './scoring.js'

/** Resolve the keyword used for the headline map-pack search, mirroring the
 *  provider's own choice, so the report shows the real query. */
function resolvePrimaryKeyword(input: AuditInput, lookup: GbpLookupResult): string {
  return (
    input.keywords?.[0]?.trim() ||
    lookup.business?.category ||
    input.businessName
  )
}

export async function evaluate(
  input: AuditInput,
  provider: GbpDataProvider,
): Promise<AuditResult> {
  const lookup = await provider.lookup(input)
  const primaryKeyword = resolvePrimaryKeyword(input, lookup)
  return scoreAudit(lookup, provider.name, primaryKeyword)
}
