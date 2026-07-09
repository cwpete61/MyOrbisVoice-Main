/**
 * Native (Capacitor) integration for the iOS/Android shell.
 *
 * The shell loads this same web app remotely and injects `window.Capacitor`
 * plus the plugins. So we talk to native through that bridge — no Capacitor npm
 * packages in the web bundle, and everything here is a safe no-op on the plain
 * web / PWA. Plugins live in `apps/mobile`.
 */
import { apiFetch } from '@/hooks/useApi'

type CapBridge = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, any> }
const cap = (): CapBridge | undefined => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined)

export function isNativeApp(): boolean {
  try { return !!cap()?.isNativePlatform?.() } catch { return false }
}
export function nativePlatform(): 'ios' | 'android' | 'web' {
  try { const p = cap()?.getPlatform?.(); return p === 'ios' || p === 'android' ? p : 'web' } catch { return 'web' }
}

const registerToken = (platform: string, token: string) =>
  apiFetch('/api/push/register-native', { method: 'POST', body: JSON.stringify({ platform, token }) }).catch(() => {})

let started = false
/** Call once after login when running in the native shell: request push
 *  permission, register the FCM token, and route on notification taps. */
export async function initNativeApp(router?: { push: (url: string) => void }): Promise<void> {
  if (started || !isNativeApp()) return
  started = true
  const P = cap()?.Plugins ?? {}
  const platform = nativePlatform()

  try {
    const FM = P['FirebaseMessaging']
    const Push = P['PushNotifications']
    if (FM) {
      const perm = await FM.requestPermissions().catch(() => null)
      if (perm && perm.receive !== 'denied') {
        const res = await FM.getToken().catch(() => null)
        if (res?.token) await registerToken(platform, res.token)
        FM.addListener?.('tokenReceived', (e: any) => { if (e?.token) registerToken(platform, e.token) })
        FM.addListener?.('notificationActionPerformed', (e: any) => {
          const url = e?.notification?.data?.url
          if (url && router) router.push(url)
        })
      }
    } else if (Push) {
      const perm = await Push.requestPermissions().catch(() => null)
      if (perm?.receive === 'granted') {
        Push.addListener('registration', (t: any) => { if (t?.value) registerToken(platform, t.value) })
        Push.addListener('pushNotificationActionPerformed', (e: any) => {
          const url = e?.notification?.data?.url
          if (url && router) router.push(url)
        })
        await Push.register().catch(() => {})
      }
    }
  } catch { /* push is best-effort */ }

  try { P['SplashScreen']?.hide?.() } catch { /* ignore */ }
}

/** Optional Face ID / fingerprint gate. Returns true (allow) when unavailable
 *  or not native, so it never locks web users out. */
export async function biometricUnlock(): Promise<boolean> {
  if (!isNativeApp()) return true
  try {
    const B = cap()?.Plugins?.['NativeBiometric']
    if (!B) return true
    const avail = await B.isAvailable().catch(() => ({ isAvailable: false }))
    if (!avail?.isAvailable) return true
    await B.verifyIdentity({ reason: 'Unlock MyOrbisAgents', title: 'Unlock', subtitle: 'Face ID or fingerprint' })
    return true
  } catch { return false }
}
