/**
 * Webinar Marketing query generator.
 *
 * Turns a (niche, location, optionalEmailDomainFilter) into a list of search
 * query strings designed to surface BUSINESS CONTACT PAGES, not personal
 * accounts. Queries are conservative on purpose — we want pages that
 * publish a contact email in plaintext, not user profiles.
 *
 * The optionalEmailDomainFilter when set narrows queries to free-mail
 * targeting (e.g. `"@gmail.com" "dentist" "atlanta"`). Per project rule,
 * results still flow through the same classification pipeline; free-mail
 * results land in quarantine for manual review with consent + lawful-basis
 * notes. They never auto-promote.
 */

export interface QueryGenInput {
  niche: string
  location: string
  optionalEmailDomainFilter?: string | null
}

const BASE_PATTERNS = [
  // Most direct — landing pages literally titled "contact"
  '"{niche}" "{location}" "contact"',
  '"{niche}" "{location}" "contact us"',
  // Booking + appointment language common in service businesses
  '"{niche}" "{location}" "appointment"',
  '"{niche}" "{location}" "book online"',
  // Office / location pages
  '"{niche}" "{location}" "office"',
  '"{niche}" "{location}" "our location"',
  // Explicit email asking
  '"{niche}" "{location}" "email"',
] as const

const DOMAIN_FILTER_PATTERNS = [
  '"{filter}" "{niche}" "{location}"',
  '"{filter}" "{niche}" "{location}" "contact"',
  '"{filter}" "{niche}" "{location}" "appointment"',
] as const

export function generateQueries(input: QueryGenInput): string[] {
  const niche = input.niche.trim().toLowerCase()
  const location = input.location.trim().toLowerCase()
  const filter = (input.optionalEmailDomainFilter ?? '').trim()

  const out: string[] = []

  if (filter) {
    // Free-mail-targeting mode. The filter is something like "@gmail.com"
    // or "@company.com". Wrap in quotes — search engines treat the @
    // properly when quoted.
    for (const t of DOMAIN_FILTER_PATTERNS) {
      out.push(
        t
          .replaceAll('{filter}', filter)
          .replaceAll('{niche}', niche)
          .replaceAll('{location}', location),
      )
    }
  }

  // Always also generate the base business-contact patterns.
  for (const t of BASE_PATTERNS) {
    out.push(t.replaceAll('{niche}', niche).replaceAll('{location}', location))
  }

  // Dedup — preserve order.
  return Array.from(new Set(out))
}
