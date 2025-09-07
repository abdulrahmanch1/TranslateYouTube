"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const [isAuthed, setAuthed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const supa = getSupabase()
    supa.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setAuthed(!!data.user)
    })
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    if (signingOut) return
    setSigningOut(true)
    const supa = getSupabase()
    try {
      const { error } = await supa.auth.signOut()
      if (error) {
        // Even if error, force local UI sign-out to avoid a stuck state
        console.error('signOut error:', error)
      }
    } catch (e) {
      console.error('signOut exception:', e)
    } finally {
      // Proactively update UI and local cache in case the auth event is delayed
      try { if (typeof window !== 'undefined') localStorage.removeItem('sb-user') } catch {}
      setAuthed(false)
      setSigningOut(false)
      router.replace('/')
    }
  }

  return (
    <header className="sticky top-0 z-20 backdrop-blur-sm bg-ink/60 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">TranslateYouTube</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/wallet" className="text-white/80 hover:text-white">Wallet</Link>
          {isAuthed ? (
            <button onClick={logout} disabled={signingOut} className="text-white/80 hover:text-white disabled:opacity-60">{signingOut ? 'Logging out…' : 'Logout'}</button>
          ) : (
            <>
              <Link href="/login" className="text-white/80 hover:text-white">Login</Link>
              <Link href="/signup" className="text-ink bg-white rounded-lg px-3 py-1.5 hover:bg-white/90">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
