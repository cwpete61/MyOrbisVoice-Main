import Stripe from 'stripe'
import { getEnv } from '@voiceautomation/config'

let _stripe: InstanceType<typeof Stripe> | undefined

export function getStripe(): InstanceType<typeof Stripe> {
  if (!_stripe) {
    const { STRIPE_SECRET_KEY } = getEnv()
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-04-22.dahlia' })
  }
  return _stripe
}
