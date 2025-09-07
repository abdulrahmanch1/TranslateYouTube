import { NextRequest, NextResponse } from 'next/server'
import { naiveSegment } from '@/lib/srt'
import { parseCaptionsFromText } from '@/lib/subs'
import OpenAI from 'openai'

function extOf(name?: string|null) {
  const n = (name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

async function readText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer())
  return buf.toString('utf8')
}

function parseSrtOrVtt(name: string, text: string) {
  return parseCaptionsFromText(name, text)
}

export const runtime = 'nodejs'

function makeOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  return new OpenAI({ apiKey, timeout: 120000 }) // 120s timeout
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return new NextResponse('Missing file', { status: 400 })
    // Guard: file size limit 25MB for now
    const fileSize = (file as any).size as number | undefined
    if (typeof fileSize === 'number' && fileSize > 25 * 1024 * 1024) {
      return new NextResponse('File too large. Max 25MB.', { status: 413 })
    }
    const ext = extOf(file.name)
    if (/(srt|vtt|txt)/i.test(ext)) {
      const txt = await readText(file)
      if (ext === 'txt') {
        const cues = naiveSegment(txt)
        const plain = cues.map(c=>c.text).join('\n')
        return NextResponse.json({ text: plain, cues })
      }
      const { text, cues } = parseSrtOrVtt(file.name, txt)
      return NextResponse.json({ text, cues })
    }

    // Audio/video: transcribe via Whisper if key is available
    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse('Audio/video requires OPENAI_API_KEY (whisper)', { status: 400 })
    }
    const openai = makeOpenAI()
    const ab = await file.arrayBuffer()
    const blob = new Blob([ab], { type: file.type || 'application/octet-stream' })
    const f = new File([blob], file.name, { type: file.type })
    const tr = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: f as any,
      response_format: 'verbose_json'
    }) as any
    const transcript: string = tr?.text || ''
    const cues = naiveSegment(transcript)
    const plain = cues.map(c=>c.text).join('\n')
    return NextResponse.json({ text: plain, cues })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Processing failed', { status: 400 })
  }
}