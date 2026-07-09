'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initNativeApp } from '@/lib/native'

/** Mounted once in the dashboard shell. On the plain web/PWA it's a no-op; in
 *  the native app it registers the push token and wires notification taps to
 *  navigation. Renders nothing. */
export function NativeBootstrap() {
  const router = useRouter()
  useEffect(() => { void initNativeApp(router) }, [router])
  return null
}
