import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { naiveSegment, toSRT, toVTT, withText } from '@/lib/srt'
import { extractVideoId, fetchYoutubeTranscript, fetchTimedTextTranscript, fetchWatchPageTranscript, toCaptionItems } from '@/lib/youtube'

const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

async function chatWithFallback(openai: OpenAI, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], temperature = 0.2) {
  const candidates = Array.from(new Set([
    PREFERRED_MODEL,
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
  ]))

  let lastErr: any = null
  for (const model of candidates) {
    try {
      const resp = await openai.chat.completions.create({ model, messages, temperature })
      const content = resp.choices[0]?.message?.content?.trim() || ''
      if (content) return { content, modelUsed: model }
    } catch (e: any) {
      lastErr = e
      // If model missing or not accessible, try next
      const msg = (e?.message || '').toLowerCase()
      const code = (e?.code || '').toString()
      const status = e?.status || e?.response?.status
      // On quota/rate limit, do NOT try other models (same account quota)
      if (status === 429 || /quota|rate limit/i.test(msg)) {
        throw e
      }
      const notFound = status === 404 || msg.includes('does not exist') || code.includes('model_not_found')
      if (!notFound) {
        // For other transient errors we still try next candidate
        continue
      }
    }
  }
  throw lastErr || new Error('All OpenAI models failed')
}

function makeOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  const organization = process.env.OPENAI_ORG
  return new OpenAI({ apiKey, organization })
}

export async function POST(req: NextRequest) {
  try {
    const { url, targetLang = 'en', format = 'srt', transcript } = await req.json()
    if (!url) return new NextResponse('Missing YouTube URL', { status: 400 })

    const vid = extractVideoId(url)
    if (!vid && !transcript) return new NextResponse('Invalid YouTube URL', { status: 400 })

    let cues = [] as ReturnType<typeof toCaptionItems>
    let sourceText = ''

    if (vid) {
      // 1) حاول جلب الترجمة من يوتيوب مع التوقيت
      let capItems: ReturnType<typeof toCaptionItems> | null = null
      try {
        const segments = await fetchYoutubeTranscript(vid)
        capItems = toCaptionItems(segments)
      } catch (_) {
        capItems = null
      }

      // Extra fallback A: YouTube timedtext endpoint (public captions)
      if (!capItems || capItems.length === 0) {
        try {
          const langHints = Array.from(new Set([
            'en', 'a.en',
            targetLang, `a.${targetLang}`,
            'ar','a.ar','es','a.es','fr','a.fr','de','a.de','pt','a.pt','ja','a.ja'
          ].filter(Boolean))) as string[]
          const tt = await fetchTimedTextTranscript(vid, langHints)
          capItems = toCaptionItems(tt)
        } catch (_) {
          // still null
        }
      }

      // Extra fallback B: Parse watch page captionTracks and fetch VTT
      if (!capItems || capItems.length === 0) {
        try {
          const segs = await fetchWatchPageTranscript(vid, targetLang)
          capItems = toCaptionItems(segs)
        } catch (_) {
          // still null
        }
      }

      if (capItems && capItems.length > 0) {
        // 2) لو عندنا مفتاح OpenAI، حاول ترجمة سطر-بسطر؛ وإلا ارجع النص الأصلي مع نفس التوقيت
        const hasKey = !!process.env.OPENAI_API_KEY
        if (hasKey) {
          try {
            sourceText = capItems.map(c => c.text).join('\n')
            const openai = makeOpenAI()
            const prompt = `Translate the following subtitle lines into ${targetLang}.\nRules: Keep the exact number of lines, do not merge or split, one output line per input line, no numbering.\n\n` + sourceText
            const { content: translated } = await chatWithFallback(openai, [{ role: 'user', content: prompt }])
            const lines = translated.split(/\r?\n/).filter(Boolean)
            cues = withText(capItems, lines)
          } catch (_) {
            // فشل الترجمة ⇒ رجّع النص الأصلي مع نفس التوقيت
            cues = capItems
          }
        } else {
          cues = capItems
        }
      } else {
        // لم نتمكن من جلب نص اليوتيوب. جرّب نص خام إن أُرسل
        if (transcript) {
          const hasKey = !!process.env.OPENAI_API_KEY
          if (hasKey) {
            try {
              const openai = makeOpenAI()
              const prompt = `Translate the following transcript into ${targetLang} with natural, subtitle-friendly phrasing. Preserve sentence boundaries.\n\nTranscript:\n${transcript}`
              const { content: translated } = await chatWithFallback(openai, [{ role: 'user', content: prompt }])
              cues = naiveSegment(translated)
            } catch (_) {
              cues = naiveSegment(transcript)
            }
          } else {
            cues = naiveSegment(transcript)
          }
        } else {
          return new NextResponse('Could not fetch YouTube transcript for this video', { status: 400 })
        }
      }
    } else {
      // No video id, but a raw transcript provided by client
      const baseText: string = transcript
      if (!baseText) return new NextResponse('Invalid YouTube URL', { status: 400 })
      const hasKey = !!process.env.OPENAI_API_KEY
      if (hasKey) {
        try {
          const openai = makeOpenAI()
          const prompt = `Translate the following transcript into ${targetLang} with natural, subtitle-friendly phrasing. Preserve sentence boundaries.\n\nTranscript:\n${baseText}`
          const { content: translated } = await chatWithFallback(openai, [{ role: 'user', content: prompt }])
          cues = naiveSegment(translated)
        } catch (_) {
          cues = naiveSegment(baseText)
        }
      } else {
        cues = naiveSegment(baseText)
      }
    }
    const filename = `captions-${targetLang}.${format === 'vtt' ? 'vtt' : 'srt'}`
    const content = format === 'vtt' ? toVTT(cues) : toSRT(cues)
    return NextResponse.json({ filename, content })
  } catch (e: any) {
    const status = e?.status || e?.response?.status
    const message = (e?.message || '').toString()
    if (status === 429 || /quota|rate limit/i.test(message)) {
      return new NextResponse('OpenAI quota exceeded. Check billing or try again later.', { status: 429 })
    }
    return new NextResponse(e?.message || 'Subtitle generation failed', { status: status && Number.isInteger(status) ? status : 400 })
  }
}
