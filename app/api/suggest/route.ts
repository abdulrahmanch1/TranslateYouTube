import { NextRequest, NextResponse } from 'next/server'
import { naiveSuggestionsFor } from '@/lib/suggestLocal'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    const t = String(text || '')
    if (!t) return NextResponse.json({ suggestions: [] })
    // Guard: limit extremely large inputs to keep latency bounded
    const limited = t.slice(0, 200_000) // ~200KB of text
    const suggestions = naiveSuggestionsFor(limited)
    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Suggest failed', { status: 400 })
  }
}

