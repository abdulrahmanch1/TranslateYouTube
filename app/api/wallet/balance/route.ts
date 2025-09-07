import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    const uid = String(userId || '')
    if (!uid) return new NextResponse('Missing userId', { status: 400 })
    const db = getSupabaseAdmin()
    // Ensure wallet exists
    try { await (db as any).rpc('ensure_wallet_for', { uid }) } catch {}
    const { data: rows, error } = await db
      .from('wallet_transactions')
      .select('balance_after')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    const last = Array.isArray(rows) ? rows[0] : rows
    const cents = Number((last as any)?.balance_after ?? 0) || 0
    return NextResponse.json({ balance_cents: cents })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Balance fetch failed', { status: 400 })
  }
}
