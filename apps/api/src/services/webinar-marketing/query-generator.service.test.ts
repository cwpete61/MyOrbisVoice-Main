import { describe, it, expect } from 'vitest'
import { generateQueries } from './query-generator.service.js'

describe('generateQueries', () => {
  it('produces base business-contact patterns when no filter', () => {
    const queries = generateQueries({ niche: 'dentist', location: 'atlanta' })
    expect(queries.length).toBeGreaterThan(0)
    expect(queries.some((q) => q.includes('"dentist"') && q.includes('"atlanta"'))).toBe(true)
    expect(queries.some((q) => q.includes('"contact"'))).toBe(true)
    expect(queries.some((q) => q.includes('"appointment"'))).toBe(true)
    expect(queries.some((q) => q.includes('"email"'))).toBe(true)
  })

  it('lowercases + trims niche and location', () => {
    const queries = generateQueries({ niche: '  DENTIST  ', location: 'AtLaNtA' })
    expect(queries.every((q) => !/DENTIST/i.test(q) || !q.includes('DENTIST'))).toBe(true)
    expect(queries.some((q) => q.includes('"dentist"') && q.includes('"atlanta"'))).toBe(true)
  })

  it('adds domain-filter patterns when optionalEmailDomainFilter is set', () => {
    const queries = generateQueries({
      niche: 'dentist',
      location: 'atlanta',
      optionalEmailDomainFilter: '@gmail.com',
    })
    expect(queries.some((q) => q.includes('"@gmail.com"'))).toBe(true)
    // Still emits the base business patterns alongside the filter patterns.
    expect(queries.some((q) => q.includes('"contact"'))).toBe(true)
  })

  it('returns deduped result (no exact duplicates)', () => {
    const queries = generateQueries({ niche: 'plumber', location: 'phoenix' })
    expect(new Set(queries).size).toBe(queries.length)
  })

  it('null and empty-string domainFilter behave the same (no filter)', () => {
    const a = generateQueries({ niche: 'dentist', location: 'atl', optionalEmailDomainFilter: null })
    const b = generateQueries({ niche: 'dentist', location: 'atl', optionalEmailDomainFilter: '' })
    const c = generateQueries({ niche: 'dentist', location: 'atl' })
    expect(a).toEqual(c)
    expect(b).toEqual(c)
  })

  it('always quotes niche + location for exact search match', () => {
    const queries = generateQueries({ niche: 'hvac contractor', location: 'tampa' })
    expect(queries.every((q) => q.includes('"hvac contractor"'))).toBe(true)
    expect(queries.every((q) => q.includes('"tampa"'))).toBe(true)
  })
})
