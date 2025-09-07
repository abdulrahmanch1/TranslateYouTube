import Stripe from 'stripe'

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

export function planToPriceId(plan: string) {
  const map: Record<string, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO,
    max: process.env.STRIPE_PRICE_MAX,
  }
  const id = map[plan]
  if (!id) throw new Error('Unknown plan or price not configured')
  return id
}
