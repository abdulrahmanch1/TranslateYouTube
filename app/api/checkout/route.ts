import { NextRequest, NextResponse } from 'next/server'
import { getStripe, planToPriceId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, email } = await req.json()
    const price = planToPriceId(String(plan))
    const stripe = getStripe()
    const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: userId,
      customer_email: email,
      success_url: `${url}/?checkout=success`,
      cancel_url: `${url}/pricing?checkout=canceled`,
      allow_promotion_codes: true,
    })
    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Checkout error', { status: 400 })
  }
}
