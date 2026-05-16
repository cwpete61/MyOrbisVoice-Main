'use client'

import { useMemo } from 'react'
import { useApi } from '@/hooks/useApi'
import { A2PApplicationForm, type A2PPrefill } from '@/components/A2PApplicationForm'

export default function PartnerA2PPage() {
  const { data: me } = useApi<{ user: { email: string; firstName: string | null; lastName: string | null } }>('/api/auth/me')

  const prefill: A2PPrefill | undefined = useMemo(() => {
    if (!me?.user) return undefined
    return {
      contactFirstName: me.user.firstName ?? '',
      contactLastName:  me.user.lastName ?? '',
      contactEmail:     me.user.email ?? '',
    }
  }, [me])

  return (
    <A2PApplicationForm
      apiBase="/api/partner/a2p"
      titleKey="tenantA2p.partnerTitle"
      subtitleKey="tenantA2p.partnerSubtitle"
      prefill={prefill}
    />
  )
}
