import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { userId, amount_cents } = await req.json()
    const uid = String(userId || '')
    const amt = Math.max(0, parseInt(String(amount_cents ?? 500), 10) || 0)
    if (!uid) return new NextResponse('Missing userId', { status: 400 })
    if (amt <= 0) return new NextResponse('Invalid amount', { status: 400 })
    const db = getSupabaseAdmin()
    // Ensure wallet exists
    try { await (db as any).rpc('ensure_wallet_for', { uid }) } catch {}
    // Read last balance
    const { data: rows, error: selErr } = await db
      .from('wallet_transactions')
      .select('balance_after')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
    if (selErr) throw selErr
    const last = Array.isArray(rows) ? rows[0] : rows
    const lastBal = Number((last as any)?.balance_after ?? 0) || 0
    const newBal = lastBal + amt
    const { error: insErr } = await db.from('wallet_transactions').insert({
      user_id: uid,
      type: 'topup',
      amount_cents: amt,
      balance_after: newBal,
    } as any)
    if (insErr) throw insErr
    return NextResponse.json({ balance_cents: newBal })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Top-up failed', { status: 400 })
  }
}
