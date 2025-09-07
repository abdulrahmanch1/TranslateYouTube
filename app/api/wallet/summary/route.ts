import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    const uid = String(userId || '')
    if (!uid) return new NextResponse('Missing userId', { status: 400 })
    const db = getSupabaseAdmin()
    try { await (db as any).rpc('ensure_wallet_for', { uid }) } catch {}

    const { data: rows, error: selErr } = await db
      .from('wallet_transactions')
      .select('id,type,amount_cents,balance_after,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(10)
    if (selErr) throw selErr

    const list = (rows as any[]) || []
    const lastBal = list.length > 0 ? Number((list[0] as any)?.balance_after || 0) : 0
    return NextResponse.json({ balance_cents: lastBal, transactions: rows || [], userId: uid })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Summary failed', { status: 400 })
  }
}
