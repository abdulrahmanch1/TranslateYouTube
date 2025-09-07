"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
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

  useEffect(() => {
    setLoading(false) // Ensure loading is false on mount
    setText('') // Reset text on mount
    setCues(null) // Reset cues on mount
    setSuggestions([]) // Reset suggestions on mount
    setCharged(false) // Reset charged on mount
    setSuggestTried(false) // Reset suggestTried on mount

    const supa = getSupabase()
    const { data: { subscription } } = supa.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setSupabaseSessionLoaded(true)
    })

    // Initial check in case onAuthStateChange doesn't fire immediately
    supa.auth.getUser().then(({ data: { user } }) => {
      setUser(user || null)
      setSupabaseSessionLoaded(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function chargeOnce() {
    console.log('chargeOnce: Starting...')
    const supa = getSupabase()
    if (!user) throw new Error('Please login to process files')
    // Add a 10s timeout around RPC to avoid hanging UI
    const rpc = (supa as any).rpc('ledger_charge', { amount_cents: 100 })
    console.log('chargeOnce: Attempting RPC call...')
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Billing timed out')), 30000))
    try {
      const res = await Promise.race([rpc, timeout]) as any
      console.log('chargeOnce: RPC call completed.', res)
      if (res?.error) throw new Error(res.error.message)
      if (res?.data === null) throw new Error('Insufficient balance. Top‑up your wallet.')
      setCharged(true)
    } catch (e:any) {
      console.error('chargeOnce: Charge failed: ' + (e?.message || e))
      throw e // Re-throw the error to stop processing
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!file) { setError('Choose a file first'); return }
    console.log('onUpload: File selected.')
    if (!supabaseSessionLoaded) { setError('Loading user session, please wait...'); return }
    console.log('onUpload: Supabase session loaded.')
    if (!user) { setError('Please login to process files'); return }
    console.log('onUpload: User authenticated.')
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

  function download(format: 'srt'|'vtt') {
    // If we have cues, replace cue texts by applying replacements naively by string search
    if (cues && cues.length) {
      const updated = cues.map(c => ({ ...c, text: c.text }))
      // Simple: do nothing extra since we applied to global text — in MVP keep original timing
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
            <input type="file" accept=".srt,.vtt,.mp3,.mp4,.wav,.m4a,.aac,.flac,.ogg,.webm,.mov,.avi,.mkv,.txt" onChange={e=>{setFile(e.target.files?.[0]||null); setCharged(false)}} className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" />
            <button disabled={loading || !file} className="mt-4 rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2">{loading ? 'Processing…' : (charged ? 'Re-process' : 'Process ($1)')}</button>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            <p className="mt-2 text-xs text-white/50">Balance is charged once per file. Use Wallet to top‑up.</p>
          </form>

          <div className="glass rounded-2xl p-6">
            <div className="text-sm text-white/70 mb-2">Current transcript</div>
            <textarea ref={taRef} rows={16} value={text} onChange={e=>setText(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" placeholder="Transcript will appear here after processing…" />
            <div className="mt-4 flex gap-2">
              <button onClick={getSuggestions} disabled={loading || !text} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">Get suggestions</button>
              <button onClick={()=>download('srt')} disabled={!text} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">Download SRT</button>
              <button onClick={()=>download('vtt')} disabled={!text} className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">Download VTT</button>
            </div>
            {suggestTried && suggestions.length === 0 && !error && (
              <p className="mt-3 text-sm text-white/60">No obvious suggestions for this text. For deeper edits enable OPENAI_API_KEY, or try text with common mistakes.</p>
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
