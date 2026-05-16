'use client'

import { useMemo } from 'react'
import { useTenantContext } from '@/hooks/useTenantContext'
import { A2PApplicationForm, type A2PPrefill } from '@/components/A2PApplicationForm'

export default function A2PPage() {
  const tenantCtx = useTenantContext()

  const prefill: A2PPrefill | undefined = useMemo(() => {
    if (!tenantCtx) return undefined
    return {
      legalName:    tenantCtx.legalName,
      websiteUrl:   tenantCtx.website,
      addressLine1: tenantCtx.addressLine1,
      city:         tenantCtx.city,
      region:       tenantCtx.region,
      postalCode:   tenantCtx.postalCode,
      country:      tenantCtx.country,
      contactEmail: tenantCtx.publicEmail,
      contactPhone: tenantCtx.publicPhone,
    }
  }, [tenantCtx])

  return (
    <A2PApplicationForm
      apiBase="/api/a2p"
      titleKey="tenantA2p.title"
      subtitleKey="tenantA2p.subtitle"
      prefill={prefill}
      showBackToOnboarding
    />
  )
}
