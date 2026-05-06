'use client'

/**
 * Loads the tenant + business-profile rows once and exposes a merged
 * "context" object that other forms can prefill from. Read-only — every
 * form still owns its own form state and writes back through its own
 * endpoint. This hook is just a shared cache to avoid each form
 * re-fetching the same fields.
 *
 * Usage:
 *   const ctx = useTenantContext()
 *   if (ctx) { ... ctx.legalName ... ctx.addressLine1 ... }
 */

import { useApi } from './useApi'

interface TenantRow {
  id: string
  displayName: string
  legalName:        string | null
  publicEmail:      string | null
  publicPhone:      string | null
  website:          string | null
  industryVertical: string
}

interface BusinessProfileRow {
  brandName:    string
  logoUrl:      string | null
  addressLine1: string | null
  city:         string | null
  region:       string | null
  postalCode:   string | null
  country:      string | null
  fallbackNotificationEmail: string | null
}

export interface TenantContext {
  /** Best legal/operating name. Falls back through legalName → displayName. */
  legalName:    string
  displayName:  string
  brandName:    string
  publicEmail:  string
  publicPhone:  string
  website:      string
  industryCode: string

  // Address
  addressLine1: string
  city:         string
  region:       string
  postalCode:   string
  country:      string
}

/** Returns null while loading or if the API call fails. */
export function useTenantContext(): TenantContext | null {
  const { data: tenant }  = useApi<TenantRow>('/api/tenants/current')
  const { data: profile } = useApi<BusinessProfileRow>('/api/business-profile')
  if (!tenant || !profile) return null
  return {
    legalName:    tenant.legalName ?? tenant.displayName ?? '',
    displayName:  tenant.displayName ?? '',
    brandName:    profile.brandName ?? tenant.displayName ?? '',
    publicEmail:  tenant.publicEmail ?? '',
    publicPhone:  tenant.publicPhone ?? '',
    website:      tenant.website ?? '',
    industryCode: tenant.industryVertical ?? 'GENERAL',
    addressLine1: profile.addressLine1 ?? '',
    city:         profile.city ?? '',
    region:       profile.region ?? '',
    postalCode:   profile.postalCode ?? '',
    country:      profile.country ?? 'US',
  }
}
