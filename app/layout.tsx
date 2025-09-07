import '@/styles/globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Navbar } from '@/components/navbar'
import { BackgroundFX } from '@/components/background-fx'
import { AuthListener } from '@/components/auth-listener'

export const metadata: Metadata = {
  title: 'TranslateYouTube — AI Captions for Creators',
  description: 'Generate professional SRT/VTT captions for YouTube using AI.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-white">
        <BackgroundFX />
        <Navbar />
        <main className="relative z-10">{children}</main>
        <div className="fixed right-4 bottom-4 z-20"><ThemeToggle /></div>
        <AuthListener />
      </body>
    </html>
  )
}
