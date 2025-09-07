"use client"
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

export default function WalletPage() {
  const [balance, setBalance] = useState<number|null>(null)
  const [tx, setTx] = useState<Array<{id:string,type:string,amount_cents:number,balance_after:number,created_at:string}>>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string|undefined>()
  const [acct, setAcct] = useState<{ id: string; email: string | null } | null>(null)
  const [source, setSource] = useState<'server'|'client'|'none'>('none')

  async function load() {
    setErr(undefined)
    const supa = getSupabase()
    const userStr = localStorage.getItem('sb-user')
    const user = userStr ? JSON.parse(userStr) : null
    if (!user) { setErr('Please login'); setAcct(null); setBalance(0); setTx([]); setSource('none'); return }
    setAcct({ id: user.id, email: user.email ?? null })
    // Try server summary (service role) first
    try {
      const res = await fetch('/api/wallet/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (res.ok) {
        const payload = await res.json()
        setBalance(((Number(payload.balance_cents) || 0) / 100))
        setTx((payload.transactions || []).map((t:any)=> ({
          id: t.id, type: t.type, amount_cents: Number(t.amount_cents||0), balance_after: Number(t.balance_after||0), created_at: t.created_at
        })))
        setSource('server')
        return
      } else {
        // keep error but fall back to client reads
        const msg = await res.text()
        setErr(msg)
      }
    } catch (e:any) {
      setErr(e?.message || 'Server balance unavailable')
    }

    // Fallback to client-side: ensure, then compute from ledger directly
    try { await (supa as any).rpc('ensure_profile') } catch {}
    try { await (supa as any).rpc('ensure_wallet') } catch {}
    // Balance from last transaction
    const { data: rows, error: txErr } = await (supa.from('wallet_transactions') as any)
      .select('balance_after')
      .order('created_at', { ascending: false })
      .limit(1)
    if (txErr) setErr(txErr.message)
    const last = Array.isArray(rows) ? rows[0] : rows
    const cents = Number((last as any)?.balance_after ?? 0) || 0
    setBalance(cents / 100)
    setSource('client')
    // Try fetch last transactions (may be blocked by RLS; ignore errors)
    try {
      const { data: txs } = await (supa.from('wallet_transactions') as any)
        .select('id,type,amount_cents,balance_after,created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setTx((txs || []).map((t:any)=> ({
        id: t.id, type: t.type, amount_cents: Number(t.amount_cents||0), balance_after: Number(t.balance_after||0), created_at: t.created_at
      })))
    } catch {}
  }

  useEffect(() => {
    load() // initial load
    const supa = getSupabase()
    const { data: authListener } = supa.auth.onAuthStateChange((event, session) => {
      // Re-load data on auth changes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        load()
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [])

  async function devTopup(amount = 500) {
    // Developer helper: add $5
    setLoading(true)
    setErr(undefined)
    const supa = getSupabase()
    const { data: userRes } = await supa.auth.getUser()
    if (!userRes.user) { setErr('Please login'); setLoading(false); return }
    const res = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userRes.user.id, amount_cents: amount }) })
    setLoading(false)
    if (!res.ok) { setErr(await res.text()); return }
    const payload = await res.json()
    setBalance(((Number(payload.balance_cents) ?? 0)) / 100)
    load()
  }

  return (
    <div className="px-6 sm:px-10 py-16">
      <div className="max-w-md mx-auto glass rounded-2xl p-6">
        <h2 className="text-2xl font-semibold">Wallet</h2>
        <p className="mt-2 text-white/70 text-sm">Each file processing costs $1.</p>
        {acct && (
          <p className="mt-1 text-xs text-white/50">Account: {acct.email || 'no-email'} · {acct.id.slice(0,8)}… source: {source}</p>
        )}
        <div className="mt-4">
          <div className="text-white/80">Balance: <span className="font-semibold">${(balance ?? 0).toFixed(2)}</span></div>
        </div>
        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        <div className="mt-6 flex items-center gap-3">
          <button disabled={loading} onClick={()=>devTopup(500)} className="rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2">Add $5 (dev)</button>
          <button disabled className="rounded-lg border border-white/20 px-4 py-2 text-white/60" title="Coming soon">Add funds…</button>
        </div>
        <p className="mt-3 text-xs text-white/50">Top‑up integration will be added later.</p>
        {tx.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/70 mb-2">Recent activity</div>
            <ul className="text-sm space-y-2">
              {tx.map(t => (
                <li key={t.id} className="flex items-center justify-between border-b border-white/10 py-1">
                  <span className={t.type==='topup' ? 'text-emerald-300' : 'text-red-300'}>
                    {t.type==='topup' ? '+ ' : '- '}${(t.amount_cents/100).toFixed(2)}
                  </span>
                  <span className="text-white/60">Bal: ${(t.balance_after/100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
