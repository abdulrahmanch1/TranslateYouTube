"use client"
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

export default function WalletPage() {
  const [balance, setBalance] = useState<number|null>(null)
  const [tx, setTx] = useState<Array<{id:string,type:string,amount_cents:number,balance_after:number,created_at:string}>>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string|undefined>()

  async function load() {
    setErr(undefined)
    const supa = getSupabase()
    const { data: userRes } = await supa.auth.getUser()
    if (!userRes.user) { setErr('Please login'); return }
    // Use ledger balance
    const balRes = await (supa as any).rpc('ledger_balance')
    if (balRes.error) setErr(balRes.error.message)
    setBalance(((balRes.data ?? 0) as number) / 100)
    // Recent transactions (requires RLS select policy)
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

  useEffect(() => { load() }, [])

  async function devTopup(amount = 500) {
    // Developer helper: add $5
    setLoading(true)
    setErr(undefined)
    const supa = getSupabase()
    const { error, data } = await (supa as any).rpc('ledger_topup', { amount_cents: amount })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setBalance(((data as number) ?? 0) / 100)
    load()
  }

  return (
    <div className="px-6 sm:px-10 py-16">
      <div className="max-w-md mx-auto glass rounded-2xl p-6">
        <h2 className="text-2xl font-semibold">Wallet</h2>
        <p className="mt-2 text-white/70 text-sm">Each file processing costs $1.</p>
        <div className="mt-4">
          <div className="text-white/80">Balance: <span className="font-semibold">{balance === null ? '—' : `$${balance.toFixed(2)}`}</span></div>
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
