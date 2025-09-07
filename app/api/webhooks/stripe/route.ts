import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const clientRef = session.client_reference_id || undefined
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const priceId = session.line_items?.data?.[0]?.price?.id || (session as any).lines?.data?.[0]?.price?.id
        // Infer plan from env mapping (reverse lookup)
        let plan: 'pro' | 'max' | null = null
        if (priceId) {
          if (priceId === process.env.STRIPE_PRICE_PRO) plan = 'pro'
          if (priceId === process.env.STRIPE_PRICE_MAX) plan = 'max'
        }
        if (clientRef) {
          await (getSupabaseAdmin().from('profiles') as any).upsert({
            id: clientRef,
            plan: plan || 'pro',
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        const priceId = typeof sub.items?.data?.[0]?.price?.id === 'string' ? sub.items.data[0].price.id : undefined
        let plan: 'pro' | 'max' | null = null
        if (priceId) {
          if (priceId === process.env.STRIPE_PRICE_PRO) plan = 'pro'
          if (priceId === process.env.STRIPE_PRICE_MAX) plan = 'max'
        }
        await (getSupabaseAdmin().from('profiles') as any).update({
          plan: sub.status === 'active' || sub.status === 'trialing' ? (plan || 'pro') : 'none',
          stripe_subscription_id: sub.id,
          price_id: priceId,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId as string)
        break
      }
    }
  } catch (e) {
    console.error('Webhook handling error', e)
  }

  return NextResponse.json({ received: true })
}

// App Router does not use pages `config`. Raw body is read via req.text().
