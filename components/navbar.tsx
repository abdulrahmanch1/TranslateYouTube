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
    // Check for user in localStorage on initial load
    const user = localStorage.getItem('sb-user')
    setAuthed(!!user)

    // Listen for auth changes
    const supa = getSupabase()
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    if (signingOut) return
    setSigningOut(true)

    // Manually clear the Supabase session from localStorage
    const supaKey = 'sb-isewjhosvqodcxiwpggr-auth-token'
    localStorage.removeItem(supaKey)
    
    // Also remove our custom user object
    localStorage.removeItem('sb-user')
    
    setAuthed(false)
    setSigningOut(false)
    
    // Hard redirect to ensure app state resets
    window.location.href = '/'
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
