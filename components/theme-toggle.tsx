"use client"
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(true)
  useEffect(()=>{
    document.documentElement.classList.toggle('dark', dark)
  },[dark])
  return (
    <button
      onClick={()=>setDark(v=>!v)}
      className="glass rounded-full px-4 py-2 text-sm"
      title="Toggle theme"
    >
      {dark ? 'Dark' : 'Light'}
    </button>
  )
}

