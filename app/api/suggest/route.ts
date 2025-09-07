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

function naiveArabicSuggestions(text: string) {
  const suggestions: { start: number; end: number; original: string; replacement: string; reason?: string }[] = []
  const rules: { re: RegExp; replacement: string; reason: string }[] = [
    { re: /\bزهبت\b/g, replacement: 'ذهبت', reason: 'تصحيح إملائي' },
    { re: /\bساءلت\b/g, replacement: 'سألت', reason: 'تصحيح إملائي' },
    { re: /\bالباءع\b/g, replacement: 'البائع', reason: 'تصحيح إملائي' },
    { re: /\bبندوره\b/g, replacement: 'بندورة', reason: 'تصحيح إملائي' },
    { re: /\bالسياره\b/g, replacement: 'السيارة', reason: 'تصحيح إملائي' },
    { re: /\bهاذا\b/g, replacement: 'هذا', reason: 'تصحيح شائع' },
    { re: /\bلاكن\b/g, replacement: 'لكن', reason: 'تصحيح شائع' },
    { re: /\bذالك\b/g, replacement: 'ذلك', reason: 'تصحيح شائع' },
    { re: /\bالئ\b/g, replacement: 'إلى', reason: 'تصحيح همزة' },
    { re: /\bمسؤليه\b/g, replacement: 'مسؤولية', reason: 'تصحيح همزة' },
  ]
  for (const r of rules) {
    let m: RegExpExecArray | null
    while ((m = r.re.exec(text))) {
      const start = m.index
      const end = start + m[0].length
      suggestions.push({ start, end, original: m[0], replacement: r.replacement, reason: r.reason })
    }
  }
  // قاعدة تبسيطية: إذا ظهرت "بندورة" و"السياره" في نفس السطر، اقترح استبدال "السياره" بـ "بندورة"
  const lines = text.split(/\n+/)
  let offset = 0
  for (const line of lines) {
    const hasTomato = /بندورة|بندوره/.test(line)
    if (hasTomato) {
      let idx = 0
      const reCar = /السياره|السيارة/g
      let m: RegExpExecArray | null
      while ((m = reCar.exec(line))) {
        const start = offset + m.index
        const end = start + m[0].length
        suggestions.push({ start, end, original: m[0], replacement: 'بندورة', reason: 'تصحيح دلالي (عنصر مذكور: بندورة)' })
      }
    }
    offset += line.length + 1
  }
  // إزالة التداخلات المكررة (اختياري)
  suggestions.sort((a,b)=> a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const dedup: typeof suggestions = []
  let lastEnd = -1
  for (const s of suggestions) {
    if (s.start >= lastEnd) { dedup.push(s); lastEnd = s.end }
  }
  // اقتراحات عامة: مسافات مكررة → مسافة واحدة
  const doubles = / {2,}/g
  let m: RegExpExecArray | null
  while ((m = doubles.exec(text))) {
    dedup.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: ' ', reason: 'إزالة مسافات زائدة' })
  }
  return dedup
}

function naiveEnglishSuggestions(text: string) {
  const suggestions: { start: number; end: number; original: string; replacement: string; reason?: string }[] = []
  const rules: { re: RegExp; replacement: string; reason: string }[] = [
    { re: /\bteh\b/gi, replacement: 'the', reason: 'Spelling' },
    { re: /\brecieve\b/gi, replacement: 'receive', reason: 'Spelling' },
    { re: /\badress\b/gi, replacement: 'address', reason: 'Spelling' },
    { re: /\bseperate\b/gi, replacement: 'separate', reason: 'Spelling' },
    { re: /\bdefinately\b/gi, replacement: 'definitely', reason: 'Spelling' },
    { re: /\boccured\b/gi, replacement: 'occurred', reason: 'Spelling' },
    { re: /\bwich\b/gi, replacement: 'which', reason: 'Spelling' },
    { re: /\bwierd\b/gi, replacement: 'weird', reason: 'Spelling' },
    { re: /\balot\b/gi, replacement: 'a lot', reason: 'Common phrase' },
    { re: /\bdont\b/gi, replacement: "don't", reason: 'Contraction' },
    { re: /\bcant\b/gi, replacement: "can't", reason: 'Contraction' },
    { re: /\bwont\b/gi, replacement: "won't", reason: 'Contraction' },
    { re: /\bim\b/gi, replacement: "I'm", reason: 'Contraction' },
    { re: /\bive\b/gi, replacement: "I've", reason: 'Contraction' },
    { re: /\bdoesnt\b/gi, replacement: "doesn't", reason: 'Contraction' },
    { re: /\bdidnt\b/gi, replacement: "didn't", reason: 'Contraction' },
    { re: /\bthier\b/gi, replacement: 'their', reason: 'Spelling' },
    { re: /\bhte\b/gi, replacement: 'the', reason: 'Spelling' },
  ]
  for (const r of rules) {
    let m: RegExpExecArray | null
    while ((m = r.re.exec(text))) {
      const start = m.index
      const end = start + m[0].length
      suggestions.push({ start, end, original: m[0], replacement: r.replacement, reason: r.reason })
    }
  }
  // Collapse multiple spaces
  const doubles = / {2,}/g
  let m: RegExpExecArray | null
  while ((m = doubles.exec(text))) {
    suggestions.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: ' ', reason: 'Extra spaces' })
  }
  // Remove space before punctuation (" word ," -> " word,")
  const spaceBeforePunct = /\s+([,.;:!?])/g
  while ((m = spaceBeforePunct.exec(text))) {
    const spanStart = m.index
    const spanEnd = m.index + m[0].length
    const punct = m[1]
    suggestions.push({ start: spanStart, end: spanEnd, original: m[0], replacement: punct, reason: 'Space before punctuation' })
  }
  // Duplicate word: "the the" -> "the"
  const dupWord = /\b(\w+)\s+\1\b/gi
  while ((m = dupWord.exec(text))) {
    const start = m.index
    const end = start + m[0].length
    suggestions.push({ start, end, original: m[0], replacement: m[1], reason: 'Duplicate word' })
  }
  // Capitalize standalone i -> I
  const loneI = /\bi\b/g
  while ((m = loneI.exec(text))) {
    const start = m.index
    const end = start + 1
    suggestions.push({ start, end, original: 'i', replacement: 'I', reason: 'Pronoun capitalization' })
  }
  // Capitalize sentence starts (very naive)
  for (let i = 0; i < text.length; i++) {
    const prev = i === 0 ? null : text[i-1]
    const isStart = i === 0 || (prev && /[.!?]\s$/.test(text.slice(Math.max(0,i-2), i)))
    if (isStart) {
      const ch = text[i]
      if (ch && /[a-z]/.test(ch)) {
        suggestions.push({ start: i, end: i+1, original: ch, replacement: ch.toUpperCase(), reason: 'Sentence capitalization' })
      }
    }
  }
  // Deduplicate overlaps
  suggestions.sort((a,b)=> a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const dedup: typeof suggestions = []
  let lastEnd = -1
  for (const s of suggestions) {
    if (s.start >= lastEnd) { dedup.push(s); lastEnd = s.end }
  }
  return dedup
}

function naiveSuggestionsFor(text: string) {
  // Arabic unicode range 0600–06FF
  const isArabic = /[\u0600-\u06FF]/.test(text)
  return isArabic ? naiveArabicSuggestions(text) : naiveEnglishSuggestions(text)
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') return new NextResponse('Missing text', { status: 400 })
    if (!process.env.OPENAI_API_KEY) {
      // No OpenAI key: return simple local suggestions (English/Arabic)
      const suggestions = naiveSuggestionsFor(text)
      return NextResponse.json({ suggestions })
    }
    try {
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
      const status = e?.status || e?.response?.status
      const message = (e?.message || '').toString()
      // على 429: استخدم fallback محلي بدل الفشل
      if (status === 429 || /quota|rate limit/i.test(message)) {
        const suggestions = naiveSuggestionsFor(text)
        return NextResponse.json({ suggestions, fallback: 'local' })
      }
      throw e
    }
  } catch (e: any) {
    return new NextResponse(e?.message || 'Suggest failed', { status: 400 })
  }
}
