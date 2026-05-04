/**
 * Twilio service — managed model.
 *
 * As of 2026-05-02, OrbisVoice owns a single master Twilio account
 * (LightBox SEO, account SID stored in SystemConfig). All tenants share
 * this account: numbers are bought by the platform and assigned to
 * tenants via the admin UI; tenants never connect their own Twilio.
 *
 * The legacy per-tenant TwilioConnectionDetail table is preserved for
 * historical data but no longer written to. All Twilio API calls and
 * webhook signature validations route through the platform credentials
 * stored in SystemConfig (keys: twilio_account_sid / twilio_auth_token /
 * twilio_phone_number).
 *
 * The functions in this module keep their original signatures (some
 * accept a tenantId argument) for backwards compatibility with callers
 * that haven't been migrated yet — but they all return the SAME platform
 * credentials regardless of tenantId.
 */
import { prisma } from '../lib/prisma.js'
import { getConfigValue } from './system-config.service.js'

/**
 * Returns the platform's master Twilio credentials, or null if either
 * key isn't yet configured in SystemConfig.
 */
export async function getPlatformTwilioCredentials(): Promise<{ accountSid: string; authToken: string } | null> {
  const [accountSid, authToken] = await Promise.all([
    getConfigValue('twilio_account_sid'),
    getConfigValue('twilio_auth_token'),
  ])
  if (!accountSid || !authToken) return null
  return { accountSid, authToken }
}

/**
 * Returns an instantiated Twilio client using the platform's master
 * credentials. Throws if the platform Twilio isn't configured.
 *
 * Lazy-imported so the twilio package isn't required when we just
 * need to read or validate signatures.
 */
export async function getPlatformTwilioClient() {
  const creds = await getPlatformTwilioCredentials()
  if (!creds) throw new Error('Platform Twilio credentials not configured (SystemConfig: twilio_account_sid / twilio_auth_token)')
  const Twilio = (await import('twilio')).default
  return Twilio(creds.accountSid, creds.authToken)
}

/**
 * Returns the platform's Twilio TEST credentials (for use against the
 * Test API which simulates SMS/voice without real delivery). Used while
 * A2P 10DLC approval is pending. Magic numbers like +15005550006
 * (success) and +15005550001 (invalid) work against this client.
 */
export async function getPlatformTwilioTestCredentials(): Promise<{ accountSid: string; authToken: string } | null> {
  const [accountSid, authToken] = await Promise.all([
    getConfigValue('twilio_test_account_sid'),
    getConfigValue('twilio_test_auth_token'),
  ])
  if (!accountSid || !authToken) return null
  return { accountSid, authToken }
}

/**
 * Returns an instantiated Twilio client in either 'live' or 'test'
 * mode. Test mode uses the platform's Twilio Test Credentials and
 * simulates SMS/voice without real delivery.
 */
export async function getTwilioClient(mode: 'live' | 'test') {
  const creds = mode === 'test'
    ? await getPlatformTwilioTestCredentials()
    : await getPlatformTwilioCredentials()
  if (!creds) {
    throw new Error(
      mode === 'test'
        ? 'Twilio Test credentials not configured (SystemConfig: twilio_test_account_sid / twilio_test_auth_token)'
        : 'Platform Twilio credentials not configured (SystemConfig: twilio_account_sid / twilio_auth_token)'
    )
  }
  const Twilio = (await import('twilio')).default
  return Twilio(creds.accountSid, creds.authToken)
}

/**
 * Returns the platform Twilio auth token. The tenantId arg is accepted
 * for backwards compatibility but ignored — all tenants share the same
 * platform account.
 */
export async function getTwilioAuthToken(_tenantId?: string): Promise<string | null> {
  const creds = await getPlatformTwilioCredentials()
  return creds?.authToken ?? null
}

/**
 * Returns the platform connection state. Same shape as the legacy
 * per-tenant version. The tenantId arg is accepted for backwards compat.
 */
export async function getTwilioConnection(_tenantId?: string) {
  const creds = await getPlatformTwilioCredentials()
  if (!creds) {
    return { status: 'NOT_CONNECTED' as const, accountSid: null, lastVerifiedAt: null }
  }
  return {
    status: 'CONNECTED' as const,
    accountSid: creds.accountSid,
    lastVerifiedAt: new Date(),
  }
}

/**
 * @deprecated Tenants no longer save their own Twilio credentials in the
 * managed model. This stub remains so legacy code paths don't crash, but
 * it is now a no-op. Platform credentials are managed via Admin → System
 * Settings → Twilio.
 */
export async function saveTwilioCredentials(_tenantId: string, _accountSid: string, _authToken: string) {
  console.warn('[twilio.service] saveTwilioCredentials() is deprecated in the managed model — no-op.')
  return
}

/**
 * @deprecated In the managed model there is no per-tenant Twilio
 * connection to disconnect. Stubbed for backwards compatibility.
 */
export async function disconnectTwilio(tenantId: string) {
  console.warn('[twilio.service] disconnectTwilio() is deprecated in the managed model — clearing only legacy per-tenant rows.')
  // Clean up any legacy per-tenant rows (so the migration leaves the table empty over time)
  const conn = await prisma.integrationConnection.findFirst({
    where: { tenantId, provider: 'TWILIO' },
  })
  if (!conn) return
  await prisma.twilioConnectionDetail.deleteMany({ where: { integrationConnectionId: conn.id } })
  await prisma.integrationConnection.delete({ where: { id: conn.id } })
}
