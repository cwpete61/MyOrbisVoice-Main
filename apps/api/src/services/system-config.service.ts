import { prisma } from '../lib/prisma.js'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const secret = process.env['AUTH_SECRET'] ?? ''
  // Derive a 32-byte key from AUTH_SECRET
  const { createHash } = require('crypto')
  return createHash('sha256').update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid ciphertext format')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}

export async function getConfigValue(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } })
  if (!row) return null
  try {
    return row.isSecret ? decrypt(row.value) : row.value
  } catch {
    return null
  }
}

export async function setConfigValue(key: string, value: string, isSecret: boolean, updatedBy: string): Promise<void> {
  const stored = isSecret ? encrypt(value) : value
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: stored, isSecret, updatedBy, updatedAt: new Date() },
    create: { key, value: stored, isSecret, updatedBy, updatedAt: new Date() },
  })
}

/** Provider-name → SystemConfig key for the "account email" associated
 *  with that integration's API credentials. Super-admin-only feature —
 *  surfaces which login owns each set of keys so future rotations are
 *  obvious without digging through password managers. */
const ACCOUNT_EMAIL_KEYS = {
  google:     'google_account_email',
  openai:     'openai_account_email',
  gemini:     'gemini_account_email',
  stripe:     'stripe_account_email',
  twilio:     'twilio_account_email',
  twilioTest: 'twilio_test_account_email',
  reoon:      'reoon_account_email',
  bunny:      'bunny_account_email',
  smtp:       'smtp_account_email',
} as const

export type AccountEmailProvider = keyof typeof ACCOUNT_EMAIL_KEYS

export async function setAccountEmail(provider: AccountEmailProvider, email: string, updatedBy: string): Promise<void> {
  const trimmed = email.trim()
  // Empty string clears the value (idempotent — no-op if it never existed).
  if (!trimmed) {
    await prisma.systemConfig.deleteMany({ where: { key: ACCOUNT_EMAIL_KEYS[provider] } })
    return
  }
  await setConfigValue(ACCOUNT_EMAIL_KEYS[provider], trimmed, false, updatedBy)
}

/** Bulk-fetch all account-email rows. Returns a map keyed by provider
 *  with null for any unset providers. Only call this when the requester
 *  is Super Admin — these strings reveal which logins own which API
 *  keys, and shouldn't surface to lesser admins. */
export async function getAccountEmails(): Promise<Record<AccountEmailProvider, string | null>> {
  const keys = Object.values(ACCOUNT_EMAIL_KEYS)
  const rows = await prisma.systemConfig.findMany({ where: { key: { in: keys } } })
  const out: Record<AccountEmailProvider, string | null> = {
    google: null, openai: null, gemini: null, stripe: null,
    twilio: null, twilioTest: null, reoon: null, bunny: null, smtp: null,
  }
  for (const [provider, key] of Object.entries(ACCOUNT_EMAIL_KEYS)) {
    const row = rows.find(r => r.key === key)
    if (row) out[provider as AccountEmailProvider] = row.value
  }
  return out
}

const DEFAULT_REDIRECT_URI = process.env['GOOGLE_OAUTH_REDIRECT_URI']
  || process.env['API_BASE_URL']?.replace(/\/$/, '') + '/api/integrations/google/callback'
  || 'https://api.myorbisvoice.com/api/integrations/google/callback'

export async function getSystemSettings(): Promise<{
  google: { clientId: string | null; clientSecret: boolean; redirectUri: string | null }
  stripe: { secretKey: boolean; publishableKey: string | null; webhookSecret: boolean; webhookSecretConnect: boolean }
  twilio: { accountSid: string | null; authToken: boolean; phoneNumber: string | null }
  twilioTest: { accountSid: string | null; authToken: boolean }
  reoon: { apiKey: boolean; mode: string }
  bunny: { apiKey: boolean; storageZone: string | null; cdnHostname: string | null; storageRegion: string; storagePassword: boolean }
  storage: { defaultQuotaGb: number; warningThresholdPct: number; retentionDays: number | null }
  openai: { apiKey: boolean; model: string }
  smtp: { host: string | null; port: number; user: string | null; password: boolean; from: string | null }
  pricing: { overageMarkupPct: number }
  gemini: { apiKey: boolean; model: string }
  cloudflare: { apiToken: boolean; accountId: string | null }
  awsSes: { accessKeyId: string | null; secretAccessKey: boolean; region: string }
  social: {
    youtube:   string | null
    linkedin:  string | null
    tiktok:    string | null
    instagram: string | null
    pinterest: string | null
    x:         string | null
  }
}> {
  const rows = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          'google_client_id', 'google_client_secret', 'google_oauth_redirect_uri',
          'stripe_secret_key', 'stripe_publishable_key', 'stripe_webhook_secret', 'stripe_webhook_secret_connect',
          'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number',
          'twilio_test_account_sid', 'twilio_test_auth_token',
          'reoon_api_key', 'reoon_mode',
          'bunny_api_key', 'bunny_storage_zone', 'bunny_storage_password',
          'bunny_cdn_hostname', 'bunny_storage_region',
          'storage_default_quota_gb', 'storage_warning_threshold_pct', 'storage_retention_days',
          'openai_api_key', 'openai_model',
          'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from',
          'overage_markup_percent',
          'gemini_api_key', 'gemini_model',
          'cloudflare_api_token', 'cloudflare_account_id',
          'aws_ses_access_key_id', 'aws_ses_secret_access_key', 'aws_ses_region',
          'social_youtube_url', 'social_linkedin_url', 'social_tiktok_url',
          'social_instagram_url', 'social_pinterest_url', 'social_x_url',
        ],
      },
    },
  })
  const get = (key: string) => rows.find(r => r.key === key) ?? null

  const googleClientId = get('google_client_id')
  const redirectUri    = get('google_oauth_redirect_uri')

  return {
    google: {
      clientId:     googleClientId ? googleClientId.value : (process.env['GOOGLE_CLIENT_ID'] || null),
      clientSecret: !!(get('google_client_secret') || process.env['GOOGLE_CLIENT_SECRET']),
      redirectUri:  redirectUri?.value ?? DEFAULT_REDIRECT_URI,
    },
    stripe: {
      secretKey:      !!(get('stripe_secret_key')      || process.env['STRIPE_SECRET_KEY']),
      publishableKey: get('stripe_publishable_key')?.value || process.env['STRIPE_PUBLISHABLE_KEY'] || null,
      webhookSecret:  !!(get('stripe_webhook_secret')  || process.env['STRIPE_WEBHOOK_SECRET']),
      webhookSecretConnect: !!(get('stripe_webhook_secret_connect') || process.env['STRIPE_WEBHOOK_SECRET_CONNECT']),
    },
    twilio: {
      accountSid:  get('twilio_account_sid')?.value ?? (process.env['TWILIO_ACCOUNT_SID'] || null),
      authToken:   !!(get('twilio_auth_token')       || process.env['TWILIO_AUTH_TOKEN']),
      phoneNumber: get('twilio_phone_number')?.value ?? (process.env['TWILIO_PHONE_NUMBER'] || null),
    },
    twilioTest: {
      accountSid:  get('twilio_test_account_sid')?.value ?? (process.env['TWILIO_TEST_ACCOUNT_SID'] || null),
      authToken:   !!(get('twilio_test_auth_token')       || process.env['TWILIO_TEST_AUTH_TOKEN']),
    },
    reoon: {
      apiKey: !!(get('reoon_api_key') || process.env['REOON_API_KEY']),
      mode:   get('reoon_mode')?.value ?? process.env['REOON_MODE'] ?? 'power',
    },
    bunny: {
      apiKey:          !!(get('bunny_api_key')          || process.env['BUNNY_API_KEY']),
      storageZone:     get('bunny_storage_zone')?.value    ?? (process.env['BUNNY_STORAGE_ZONE']     || null),
      cdnHostname:     get('bunny_cdn_hostname')?.value    ?? (process.env['BUNNY_CDN_HOSTNAME']     || null),
      storageRegion:   get('bunny_storage_region')?.value  ?? (process.env['BUNNY_STORAGE_REGION']   || 'ny'),
      storagePassword: !!(get('bunny_storage_password')    || process.env['BUNNY_STORAGE_PASSWORD']),
    },
    storage: {
      defaultQuotaGb:         parseInt(get('storage_default_quota_gb')?.value        ?? '1', 10),
      warningThresholdPct:    parseInt(get('storage_warning_threshold_pct')?.value   ?? '90', 10),
      retentionDays:          get('storage_retention_days')?.value ? parseInt(get('storage_retention_days')!.value, 10) : null,
    },
    openai: {
      apiKey: !!(get('openai_api_key') || process.env['OPENAI_API_KEY']),
      model:  get('openai_model')?.value ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
    },
    smtp: {
      host:     get('smtp_host')?.value     ?? (process.env['SMTP_HOST']     || null),
      port:     parseInt(get('smtp_port')?.value ?? process.env['SMTP_PORT'] ?? '587', 10),
      user:     get('smtp_user')?.value     ?? (process.env['SMTP_USER']     || null),
      password: !!(get('smtp_password')     || process.env['SMTP_PASSWORD']),
      from:     get('smtp_from')?.value     ?? (process.env['SMTP_FROM']     || null),
    },
    pricing: {
      overageMarkupPct: Number(get('overage_markup_percent')?.value ?? '0') || 0,
    },
    gemini: {
      apiKey: !!(get('gemini_api_key') || process.env['GEMINI_API_KEY']),
      model:  get('gemini_model')?.value ?? process.env['GEMINI_LIVE_MODEL'] ?? 'gemini-2.5-flash-native-audio-latest',
    },
    cloudflare: {
      apiToken:  !!(get('cloudflare_api_token') || process.env['CLOUDFLARE_API_TOKEN']),
      accountId: get('cloudflare_account_id')?.value ?? (process.env['CLOUDFLARE_ACCOUNT_ID'] || null),
    },
    awsSes: {
      accessKeyId:     get('aws_ses_access_key_id')?.value ?? (process.env['AWS_SES_ACCESS_KEY_ID'] || null),
      secretAccessKey: !!(get('aws_ses_secret_access_key') || process.env['AWS_SES_SECRET_ACCESS_KEY']),
      region:          get('aws_ses_region')?.value ?? process.env['AWS_SES_REGION'] ?? 'us-east-1',
    },
    social: {
      youtube:   get('social_youtube_url')?.value   ?? null,
      linkedin:  get('social_linkedin_url')?.value  ?? null,
      tiktok:    get('social_tiktok_url')?.value    ?? null,
      instagram: get('social_instagram_url')?.value ?? null,
      pinterest: get('social_pinterest_url')?.value ?? null,
      x:         get('social_x_url')?.value         ?? null,
    },
  }
}

export async function getOpenAiApiKey(): Promise<string | null> {
  const dbKey = await getConfigValue('openai_api_key')
  return dbKey || process.env['OPENAI_API_KEY'] || null
}

// Used by google.service.ts — reads DB first, falls back to env
export async function getGoogleConfig(): Promise<{
  clientId: string
  clientSecret: string
  redirectUri: string
} | null> {
  const [dbClientId, dbSecret, dbRedirect] = await Promise.all([
    getConfigValue('google_client_id'),
    getConfigValue('google_client_secret'),
    getConfigValue('google_oauth_redirect_uri'),
  ])

  const clientId = dbClientId || process.env['GOOGLE_CLIENT_ID'] || ''
  const clientSecret = dbSecret || process.env['GOOGLE_CLIENT_SECRET'] || ''
  const redirectUri = dbRedirect || process.env['GOOGLE_OAUTH_REDIRECT_URI'] || DEFAULT_REDIRECT_URI

  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, redirectUri }
}
