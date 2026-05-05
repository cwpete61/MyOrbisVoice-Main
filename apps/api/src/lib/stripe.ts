import Stripe from 'stripe'
import { getEnv } from '@voiceautomation/config'
import { getConfigValue } from '../services/system-config.service.js'

let _stripe: InstanceType<typeof Stripe> | undefined
let _resolvedSecretKey: string | undefined

export function getStripe(): InstanceType<typeof Stripe> {
  if (!_stripe) {
    const key = _resolvedSecretKey ?? getEnv().STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
  }
  return _stripe
}

/** Boot-time hydration: pull stripe_secret_key (and friends) from SystemConfig
 *  and override the env-var fallback. Called from index.ts before listen() so
 *  the first getStripe() call uses the admin-managed key, not the .env.prod
 *  value. Also called by the admin "save Stripe settings" endpoint so an
 *  in-place key swap takes effect without a container restart. */
export async function bootStripeFromConfig(): Promise<void> {
  const dbSecret = await getConfigValue('stripe_secret_key').catch(() => null)
  if (dbSecret) {
    _resolvedSecretKey = dbSecret
    process.env['STRIPE_SECRET_KEY'] = dbSecret
  }
  const dbPublishable = await getConfigValue('stripe_publishable_key').catch(() => null)
  if (dbPublishable) process.env['STRIPE_PUBLISHABLE_KEY'] = dbPublishable

  const dbWebhook = await getConfigValue('stripe_webhook_secret').catch(() => null)
  if (dbWebhook) process.env['STRIPE_WEBHOOK_SECRET'] = dbWebhook

  // The Connect-scoped webhook destination has its own signing secret, separate
  // from the platform-account destination's secret. Verified via try-both in
  // handleStripeWebhook.
  const dbWebhookConnect = await getConfigValue('stripe_webhook_secret_connect').catch(() => null)
  if (dbWebhookConnect) process.env['STRIPE_WEBHOOK_SECRET_CONNECT'] = dbWebhookConnect

  // Drop the cached client so the next getStripe() rebuilds with the resolved key
  _stripe = undefined
}

/** Returns the list of webhook signing secrets to try when verifying an event.
 *  Currently we run two destinations in Stripe — one scoped to platform events,
 *  one scoped to Connect events — each with its own secret. Returns up to two
 *  secrets; the verifier in handleStripeWebhook tries them in order. */
export function getWebhookSecrets(): string[] {
  const out: string[] = []
  const primary = process.env['STRIPE_WEBHOOK_SECRET']
  const connect = process.env['STRIPE_WEBHOOK_SECRET_CONNECT']
  if (primary) out.push(primary)
  if (connect && connect !== primary) out.push(connect)
  return out
}
