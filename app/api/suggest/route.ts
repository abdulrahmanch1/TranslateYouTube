import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

async function chatJSON(openai: OpenAI, prompt: string) {
  const candidates = Array.from(new Set([
    PREFERRED_MODEL,
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
  ]))
  let lastErr: any = null
  for (const model of candidates) {
    try {
      const resp = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' } as any,
      })
      const content = resp.choices[0]?.message?.content?.trim() || '{}'
      return JSON.parse(content)
    } catch (e: any) {
      lastErr = e
      const status = e?.status || e?.response?.status
      const msg = (e?.message || '').toLowerCase()
      if (status === 429 || /quota|rate limit/i.test(msg)) throw e
      continue
    }
  }
  throw lastErr || new Error('All models failed')
}

function makeOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 }) }

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') return new NextResponse('Missing text', { status: 400 })
    if (!process.env.OPENAI_API_KEY) {
      // No key: return empty suggestions
      return NextResponse.json({ suggestions: [] })
    }
    const openai = makeOpenAI()
    const prompt = `You are a subtitle proofreader. Identify clearly incorrect words and propose replacements.
Return JSON with an array 'suggestions'. Each item: { start:number, end:number, original:string, replacement:string, reason:string }.
Constraints: indices are 0-based over the input UTF-8 string. Keep suggestions minimal and safe.
Text:\n${text}`
    const json = await chatJSON(openai, prompt)
    const suggestions = Array.isArray(json?.suggestions) ? json.suggestions : []
    // Basic shape validation
    const norm = suggestions
      .filter((s: any) => Number.isFinite(s?.start) && Number.isFinite(s?.end) && typeof s?.replacement === 'string')
      .map((s: any) => ({
        start: Math.max(0, Math.floor(s.start)),
        end: Math.max(0, Math.floor(s.end)),
        original: String(s.original ?? ''),
        replacement: String(s.replacement ?? ''),
        reason: s.reason ? String(s.reason) : undefined,
      }))
      .filter((s: any) => s.end > s.start && s.end <= text.length)
    return NextResponse.json({ suggestions: norm })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Suggest failed', { status: 400 })
  }
}
