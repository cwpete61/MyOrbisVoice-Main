/**
 * Phone-number memorability scoring.
 *
 * Pure client-side analysis on a search result so we can highlight
 * "interesting" numbers without making any extra API calls. The score
 * is a hint, not a verdict — sort by it, filter against it, ignore it
 * if you want.
 */

export interface MemorabilityScore {
  /** 0-12+ — higher = more memorable */
  score: number
  /** Sorted, deduped tag keys to render as badges */
  tags:  string[]
}

/** Last 4 digits of the local number, e.g. "1234" from "+16105551234" */
function last4(e164: string): string {
  return e164.replace(/\D/g, '').slice(-4)
}

/** Last 7 digits — the full local number for US/CA numbers, e.g. "5551234" */
function last7(e164: string): string {
  return e164.replace(/\D/g, '').slice(-7)
}

const SEQUENTIAL_PATTERNS = [
  '0123', '1234', '2345', '3456', '4567', '5678', '6789',
  '9876', '8765', '7654', '6543', '5432', '4321', '3210',
]

export function scoreNumber(e164: string): MemorabilityScore {
  const tags: string[] = []
  let score = 0
  const four  = last4(e164)
  const seven = last7(e164)

  // 4+ identical digits in a row anywhere in the local part — strongest signal
  if (/(\d)\1{3,}/.test(seven)) { score += 5; tags.push('repeated') }

  // Sequential ascending or descending in the last 4 (1234, 9876)
  if (SEQUENTIAL_PATTERNS.includes(four)) { score += 4; tags.push('sequential') }

  // Repeated pairs in the last 4: 1212, 3434, 8989
  if (/^(\d)(\d)\1\2$/.test(four) && four[0] !== four[1]) { score += 3; tags.push('repeatedPair') }

  // Round endings — 1000, 5000, 7000, also 1100, 2200 (last 2 zeros)
  if (/^\d000$/.test(four))      { score += 3; tags.push('round') }
  else if (/^\d{2}00$/.test(four)) { score += 2; tags.push('round') }

  // Palindrome last 4: 1221, 5005, 9119
  if (four[0] === four[3] && four[1] === four[2] && four[0] !== four[1]) {
    score += 2; tags.push('palindrome')
  }

  // Triplet ending: 1555, 2333, 7888 (3 of same in last 3)
  if (/^\d(\d)\1\1$/.test(four)) { score += 3; tags.push('tripletEnd') }

  return { score, tags }
}

/** Suggest "find more like this" search filters based on a number's pattern.
 *  Used by the "Find similar" button in the UI. */
export function similaritySuggestions(e164: string): Array<{
  labelKey: string
  filters:  { areaCode?: string; pattern?: string }
}> {
  const digits   = e164.replace(/\D/g, '')
  const local    = digits.slice(-7)
  const areaCode = digits.slice(-10, -7)  // US/CA area code
  const four     = digits.slice(-4)
  const out: ReturnType<typeof similaritySuggestions> = []

  if (areaCode) {
    out.push({
      labelKey: 'numberSearch.similarity.sameAreaCode',
      filters:  { areaCode },
    })
  }

  if (four && four !== '0000') {
    out.push({
      labelKey: 'numberSearch.similarity.sameLast4',
      filters:  { pattern: `*${four}` },
    })
  }

  if (local && local.length >= 5) {
    // Same first 4 of local part — keeps the prefix similar
    const prefix = local.slice(0, 4)
    out.push({
      labelKey: 'numberSearch.similarity.samePrefix',
      filters:  { pattern: `${areaCode}${prefix}*` },
    })
  }

  return out
}

/** Sort comparators for client-side sorting of result lists */
export const sortComparators: Record<string, (a: { phoneNumber: string; _score?: MemorabilityScore }, b: { phoneNumber: string; _score?: MemorabilityScore }) => number> = {
  scoreDesc: (a, b) => (b._score?.score ?? 0) - (a._score?.score ?? 0) || a.phoneNumber.localeCompare(b.phoneNumber),
  phoneAsc:  (a, b) => a.phoneNumber.localeCompare(b.phoneNumber),
  phoneDesc: (a, b) => b.phoneNumber.localeCompare(a.phoneNumber),
  last4Asc:  (a, b) => last4(a.phoneNumber).localeCompare(last4(b.phoneNumber)),
}
