"use client"
import { useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState<string|undefined>()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onGoogle() {
    try {
      setErr(undefined)
      await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
      })
    } catch (e: any) {
      setErr(e?.message || 'Google sign-in failed')
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(undefined)
    setLoading(true)
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setErr(error.message)
    else router.push('/')
  }

  return (
    <div className="px-6 sm:px-10 py-16">
      <div className="max-w-md mx-auto glass rounded-2xl p-6">
        <h2 className="text-2xl font-semibold">Login</h2>
        <div className="mt-6">
          <button
            type="button"
            onClick={onGoogle}
            className="w-full bg-white text-ink border border-[#dadce0] hover:bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.66 0 6.95 1.26 9.54 3.35l7.13-7.13C35.92 1.99 30.3 0 24 0 14.62 0 6.51 5.38 2.56 13.2l8.82 6.84C13.3 14.76 18.23 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24c0-1.64-.15-3.22-.44-4.74H24v9.03h12.7c-.55 2.95-2.18 5.45-4.66 7.14l7.13 7.13C43.91 38.52 46.5 31.73 46.5 24z"/>
              <path fill="#FBBC05" d="M11.38 28.04A14.5 14.5 0 0 1 11 24c0-1.4.2-2.76.56-4.04l-8.82-6.84C.97 15.75 0 19.77 0 24c0 4.22.97 8.24 2.74 11.88l8.64-7.84z"/>
              <path fill="#34A853" d="M24 48c6.3 0 11.92-2.07 16.17-5.63l-7.13-7.13c-2.01 1.37-4.6 2.18-7.54 2.18-5.77 0-10.7-5.26-12.62-10.54l-8.64 7.84C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
          <div className="my-4 h-px bg-white/10" />
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 pr-12"
            />
            <button
              type="button"
              onClick={()=>setShowPw(s=>!s)}
              className="absolute inset-y-0 right-2 my-1 px-3 rounded-md text-white/80 hover:bg-white/10"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <button disabled={loading} className="w-full rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-3 font-medium">{loading ? 'Signing in…' : 'Sign in'}</button>
          {err && <p className="text-sm text-red-300">{err}</p>}
        </form>
      </div>
    </div>
  )
}
