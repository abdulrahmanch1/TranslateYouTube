"use client"
import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabaseClient'

export function AuthListener() {
  useEffect(() => {
    const supa = getSupabase()

    async function sync() {
      const { data } = await supa.auth.getUser()
      const user = data.user
      if (typeof window === 'undefined') return
      if (user) {
        // Ensure profile and wallet exist, in case DB trigger wasn't applied
        try { await (supa as any).rpc('ensure_profile') } catch {}
        try { await (supa as any).rpc('ensure_wallet') } catch {}
        // حاول جلب بروفايل المستخدم للحصول على الاسم والخطة
        let profile: { display_name?: string | null; plan?: string | null } = {}
        try {
          const { data: prof } = await supa
            .from('profiles')
            .select('display_name, plan')
            .eq('id', user.id)
            .single()
          if (prof) profile = prof
        } catch {}
        localStorage.setItem('sb-user', JSON.stringify({
          id: user.id,
          email: user.email || null,
          name: profile.display_name || null,
          plan: profile.plan || null,
        }))
      } else {
        localStorage.removeItem('sb-user')
      }
    }

    // Initial sync
    sync()

    // Listen to auth changes
    const { data: sub } = supa.auth.onAuthStateChange(async (_event, session) => {
      if (typeof window === 'undefined') return
      const user = session?.user
      if (user) {
        let profile: { display_name?: string | null; plan?: string | null } = {}
        try {
          const { data: prof } = await supa
            .from('profiles')
            .select('display_name, plan')
            .eq('id', user.id)
            .single()
          if (prof) profile = prof
        } catch {}
        localStorage.setItem('sb-user', JSON.stringify({
          id: user.id,
          email: user.email || null,
          name: profile.display_name || null,
          plan: profile.plan || null,
        }))
      } else {
        localStorage.removeItem('sb-user')
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])
  return null
}
