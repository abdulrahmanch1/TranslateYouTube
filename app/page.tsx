"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabaseClient'
import { toSRT, toVTT } from '@/lib/srt'
import { User } from '@supabase/supabase-js'

type Suggestion = { start: number; end: number; original: string; replacement: string; reason?: string }

export default function Home() {
  const [file, setFile] = useState<File|null>(null)
  const [text, setText] = useState('')
  const [cues, setCues] = useState<{ id:number; start:number; end:number; text:string }[]|null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|undefined>()
  const [charged, setCharged] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [suggestTried, setSuggestTried] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [supabaseSessionLoaded, setSupabaseSessionLoaded] = useState(false)
  const [billingWarning, setBillingWarning] = useState<string|undefined>()

  useEffect(() => {
    // Reset UI state on mount
    setLoading(false)
    setText('')
    setCues(null)
    setSuggestions([])
    setCharged(false)
    setBillingWarning(undefined)
    setSuggestTried(false)

    // Fallback: never block UI longer than 2s waiting on auth
    const fallback = setTimeout(() => setSupabaseSessionLoaded(true), 2000)

    let unsubscribe: (() => void) | null = null
    try {
      const supa = getSupabase()
      // Get current session quickly
      supa.auth.getSession()
        .then(({ data }) => {
          setUser(data.session?.user ?? null)
        })
        .finally(() => setSupabaseSessionLoaded(true))

      // Keep session in sync
      const { data: sub } = supa.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        setSupabaseSessionLoaded(true)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    } catch {
      setSupabaseSessionLoaded(true)
    }

    return () => {
      clearTimeout(fallback)
      if (unsubscribe) unsubscribe()
    }
  }, [])

  async function chargeOnceNonBlocking() {
    // Attempt to charge, but do not block processing if billing is slow/unavailable
    try {
      const supa = getSupabase()
      if (!user) throw new Error('Please login to process files')
      // Prefer server-side charge to avoid client-side RLS/latency
      async function attemptServerCharge(timeoutMs = 8000) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeoutMs)
        try {
          const res = await fetch('/api/wallet/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user!.id, amount_cents: 100 }),
            signal: ctrl.signal,
          })
          if (!res.ok) throw new Error(await res.text())
          return await res.json()
        } finally { clearTimeout(timer) }
      }

      try {
        await attemptServerCharge(8000)
      } catch (firstErr: any) {
        // Retry quickly once
        await new Promise(r => setTimeout(r, 400))
        await attemptServerCharge(6000)
      }
      setCharged(true)
    } catch (e:any) {
      // Surface as a non-blocking warning; do not fail the processing result or pollute main error state
      const msg = typeof e?.message === 'string' ? e.message : 'Billing failed; no charge applied.'
      console.warn('Billing issue (non-blocking):', msg)
      setBillingWarning(msg)
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    setBillingWarning(undefined)
    setText('')
    setCues(null)
    setSuggestions([])
    setSuggestTried(false)
    setCharged(false)
    if (!user) { setError('Please login to process files'); return }

    if (!file) { setError('Choose a file first'); return }

    setLoading(true)
    try {
      const name = (file.name || '').toLowerCase()
      if (name.endsWith('.srt') || name.endsWith('.vtt') || name.endsWith('.txt')) {
        // Fast local path: parse on client; if anything fails, fallback to server API
        try {
          const content = await file.text()
          const mod = await import('@/lib/subs')
          const parsed = mod.parseCaptionsFromText(file.name, content)
          setText(parsed.text || '')
          setCues(parsed.cues || null)
          if (!charged) chargeOnceNonBlocking()
        } catch (e) {
          const fd = new FormData()
          fd.set('file', file)
          const c = new AbortController()
          const t = setTimeout(()=>c.abort(), 60000)
          const res = await fetch('/api/process', { method: 'POST', body: fd, signal: c.signal })
          clearTimeout(t)
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          setText(data.text || '')
          setCues(data.cues || null)
          if (!charged) chargeOnceNonBlocking()
        }
      } else {
        const fd = new FormData()
        fd.set('file', file)
        const c = new AbortController()
        const t = setTimeout(()=>c.abort(), 120000)
        const res = await fetch('/api/process', { method: 'POST', body: fd, signal: c.signal })
        clearTimeout(t)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setText(data.text || '')
        setCues(data.cues || null)
        if (!charged) chargeOnceNonBlocking()
      }
    } catch (err: any) {
      setError(err?.name === 'AbortError' ? 'Processing timed out. Try a smaller file.' : (err?.message || 'Processing failed'))
      console.error('onUpload: Error caught: ' + err)
    } finally {
      setLoading(false)
      console.log('onUpload: Function finished.')
    }
  }

  async function getSuggestions() {
    setLoading(true)
    setError(undefined)
    try {
      const c = new AbortController()
      const t = setTimeout(()=>c.abort(), 60000)
      const res = await fetch('/api/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: c.signal
      })
      clearTimeout(t)
      if (!res.ok) throw new Error(await res.text())
      const { suggestions } = await res.json()
      setSuggestions(suggestions || [])
      setAccepted(new Set())
      setSuggestTried(true)
    } catch (e: any) {
      setError(e?.name === 'AbortError' ? 'Suggestions timed out. Try again.' : (e?.message || 'Suggestion failed'))
    } finally { setLoading(false) }
  }

  function applyAccepted() {
    // Apply only suggestions marked accepted in UI
    let t = text
    // Apply from end to start to keep indices valid
    const selected = suggestions
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => accepted.has(i))
      .map(({ s }) => s)
    const ordered = selected.sort((a,b)=> b.start - a.start)
    for (const s of ordered) {
      t = t.slice(0, s.start) + s.replacement + t.slice(s.end)
    }
    setText(t)
    setSuggestions([])
    // Optionally re-run getSuggestions to continue improvement
  }

  const preview = useMemo(()=>{
    if (!suggestions.length) return null
    // Build a simple preview with inserted markers
    const parts: React.ReactNode[] = []
    let pos = 0
    suggestions
      .slice()
      .sort((a,b)=> a.start - b.start)
      .forEach((s, i) => {
        if (pos < s.start) parts.push(<span key={`t-${i}`}>{text.slice(pos, s.start)}</span>)
        parts.push(
          <span key={`orig-${i}`} className="bg-red-500/30 line-through decoration-red-400">
            {text.slice(s.start, s.end)}
          </span>
        )
        parts.push(
          <span key={`rep-${i}`} className="bg-emerald-500/30 text-emerald-200 ml-1">+ {s.replacement}</span>
        )
        pos = s.end
      })
    if (pos < text.length) parts.push(<span key={`tail`}>{text.slice(pos)}</span>)
    return parts
  }, [suggestions, text])

  async function download(format: 'srt'|'vtt') {
    setError(undefined)
    setBillingWarning(undefined)
    // Require login only at download/charge time
    if (!user) { setError('Please login to download'); return }
    // Attempt charge if not yet charged for this file
    if (!charged) {
      await chargeOnceNonBlocking()
      if (!charged) return // stop download if charge failed or timed out
    }
    // If we have cues, replace cue texts by applying replacements naively by string search
    if (cues && cues.length) {
      const updated = cues.map(c => ({ ...c, text: c.text }))
      const content = format === 'vtt' ? toVTT(updated) : toSRT(updated)
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `captions.${format}`
      a.click()
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'transcript.txt'
      a.click()
    }
  }

  return (
    <div className="px-6 sm:px-10 py-16">
      <section className="max-w-6xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-center">YouTube Transcript Refinement</h1>
        <p className="mt-4 text-white/70 text-lg text-center">Upload a file, get AI suggestions, Accept/Reject fixes. $1 per file.</p>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <form onSubmit={onUpload} className="glass rounded-2xl p-6">
            <label className="block text-sm text-white/70">YouTube file (SRT/VTT/MP3/MP4/WAV)</label>
            <input type="file" accept=".srt,.vtt,.mp3,.mp4,.wav,.m4a,.aac,.flac,.ogg,.webm,.mov,.avi,.mkv,.txt" onChange={e=>{setFile(e.target.files?.[0]||null); setCharged(false); setBillingWarning(undefined)}} className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 disabled:opacity-60" disabled={!user} title={!user ? 'Login required' : undefined} />
            <button
              disabled={loading || !file || !user}
              className="mt-4 rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2 disabled:opacity-60"
            >
              { !user ? 'Login to process' : (loading ? 'Processing…' : (!file ? 'Choose a file' : (charged ? 'Re-process' : 'Process ($1)'))) }
            </button>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            <p className="mt-2 text-xs text-white/50">Balance is charged once per file. Use Wallet to top‑up.</p>
            {billingWarning && <p className="mt-2 text-xs text-white/60">{billingWarning}</p>}
            {!user && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/70">Please login to upload and edit files.</span>
                <Link href="/login" className="text-ink bg-white rounded-lg px-3 py-1.5 hover:bg-white/90">Login</Link>
              </div>
            )}
          </form>

          <div className="glass rounded-2xl p-6">
            <div className="text-sm text-white/70 mb-2">Current transcript</div>
            <textarea ref={taRef} rows={16} value={text} onChange={e=>setText(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" placeholder="Transcript will appear here after processing…" readOnly={!user} />
            <div className="mt-4 flex gap-2">
              <button onClick={getSuggestions} disabled={loading || !text || !user} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5 disabled:opacity-60">Get suggestions</button>
              <button onClick={()=>download('srt')} disabled={!text || !user} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5 disabled:opacity-60">Download SRT</button>
              <button onClick={()=>download('vtt')} disabled={!text || !user} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5 disabled:opacity-60">Download VTT</button>
            </div>
            {suggestTried && suggestions.length === 0 && !error && (
              <p className="mt-3 text-sm text-white/60">No obvious suggestions for this text. For deeper edits enable OPENAI_API_KEY, or try text with common mistakes.</p>
            )}
            {!user && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/70">Sign in to edit and download.</span>
                <Link href="/login" className="text-ink bg-white rounded-lg px-3 py-1.5 hover:bg-white/90">Login</Link>
              </div>
            )}
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold">Proposed changes</h3>
              <div className="mt-4 text-white/80 leading-7 break-words">{preview}</div>
            </div>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-xl font-semibold">Review</h3>
              <ul className="mt-3 space-y-3 text-sm">
                {suggestions.map((s,i)=> (
                  <li key={i} className="rounded-lg border border-white/10 p-3">
                    <div><span className="text-red-300 line-through">{s.original || text.slice(s.start, s.end)}</span> <span className="text-emerald-300 font-medium">→ {s.replacement}</span></div>
                    {s.reason && <div className="text-white/60 mt-1">{s.reason}</div>}
                    <div className="mt-2 flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={()=> setAccepted(prev => new Set(prev).add(i))}
                        className={`rounded-md px-3 py-1 border ${accepted.has(i) ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200' : 'border-white/20 hover:bg-white/5'}`}
                      >Accept ✓</button>
                      <button
                        type="button"
                        onClick={()=> setAccepted(prev => { const n = new Set(prev); n.delete(i); return n })}
                        className={`rounded-md px-3 py-1 border ${!accepted.has(i) ? 'bg-red-500/20 border-red-400 text-red-200' : 'border-white/20 hover:bg-white/5'}`}
                      >Reject ✗</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button onClick={()=> setAccepted(new Set(suggestions.map((_,i)=>i)))} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">Accept all</button>
                <button onClick={applyAccepted} className="rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2">Apply selected ✓</button>
                <button onClick={()=>setSuggestions([])} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">Reject all ✗</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
