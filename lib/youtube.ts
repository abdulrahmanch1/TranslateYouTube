import { CaptionItem } from '@/lib/srt'

export function extractVideoId(input: string): string | null {
  try {
    const u = new URL(input)
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v')
    }
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '') || null
    }
    return null
  } catch {
    return null
  }
}

type RawTranscript = { text: string; duration: number; offset: number }[]

export async function fetchYoutubeTranscript(videoId: string): Promise<RawTranscript> {
  // Uses the `youtube-transcript` package at runtime. Keep dynamic import to avoid build issues without deps installed now.
  const mod: any = await import('youtube-transcript').catch(() => null)
  if (!mod || !mod.default?.fetchTranscript) {
    throw new Error('Transcript module not available. Install dependencies and try again.')
  }
  const api = mod.default
  const entries = await api.fetchTranscript(videoId)
  // entries: { text, duration, offset }
  return entries as RawTranscript
}

export function toCaptionItems(segments: RawTranscript): CaptionItem[] {
  return segments.map((s, i) => ({
    id: i + 1,
    start: s.offset / 1000,
    end: (s.offset + s.duration) / 1000,
    text: s.text,
  }))
}

function decodeEntities(input: string) {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

// Fallback: fetch transcript via YouTube timedtext endpoint (public captions only)
export async function fetchTimedTextTranscript(videoId: string, langs: string[] = ['en','a.en','ar','a.ar','es','a.es','fr','a.fr','de','a.de','pt','a.pt','ja','a.ja']): Promise<RawTranscript> {
  const base = 'https://www.youtube.com/api/timedtext'
  const tried: string[] = []

  for (const cand of langs) {
    const auto = cand.startsWith('a.')
    const lang = auto ? cand.slice(2) : cand
    const url = `${base}?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}${auto ? '&kind=asr' : ''}`
    tried.push(cand)
    try {
      const res = await fetch(url, { headers: { 'accept': 'text/xml,*/*' } })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml || xml.indexOf('<text') === -1) continue
      const segments: RawTranscript = []
      const re = /<text[^>]*start="([\d.]+)"[^>]*dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
      let m: RegExpExecArray | null
      while ((m = re.exec(xml))) {
        const startSec = parseFloat(m[1]) || 0
        const durSec = parseFloat(m[2]) || 0
        const raw = m[3]
        const text = decodeEntities(raw.replace(/\n/g, ' ').replace(/<\/?.*?>/g, '')).trim()
        if (!text) continue
        segments.push({ text, offset: Math.round(startSec * 1000), duration: Math.round(durSec * 1000) })
      }
      if (segments.length) return segments
    } catch {
      // ignore and try next
    }
  }
  throw new Error('timedtext_not_available')
}

function parseVttTimestamp(ts: string): number {
  // 00:01:02.345
  const m = ts.trim().match(/(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})/)
  if (!m) return 0
  const h = parseInt(m[1] || '00', 10)
  const min = parseInt(m[2] || '00', 10)
  const s = parseInt(m[3] || '00', 10)
  const ms = parseInt(m[4] || '000', 10)
  return h * 3600 + min * 60 + s + ms / 1000
}

function parseVttToSegments(vtt: string): RawTranscript {
  const lines = vtt.replace(/\r/g, '').split('\n')
  const segs: RawTranscript = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (!line) continue
    if (line.startsWith('WEBVTT')) continue
    // Optional cue id line — if current line is not a timestamp, peek next
    let timeLine = line
    if (!/-->/.test(timeLine) && i < lines.length) {
      timeLine = lines[i].trim()
      if (/-->/.test(timeLine)) i++
      else continue
    }
    const m = timeLine.match(/([^\s]+)\s+-->\s+([^\s]+)/)
    if (!m) continue
    const start = parseVttTimestamp(m[1])
    const end = parseVttTimestamp(m[2])
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i])
      i++
    }
    const text = decodeEntities(textLines.join(' ').replace(/<\/?.*?>/g, '').trim())
    if (text) {
      segs.push({ text, offset: Math.round(start * 1000), duration: Math.max(0, Math.round((end - start) * 1000)) })
    }
  }
  return segs
}

export async function fetchWatchPageTranscript(videoId: string, targetLang?: string): Promise<RawTranscript> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`
  const res = await fetch(url, { headers: { 'accept-language': 'en' } })
  if (!res.ok) throw new Error('watch_html_failed')
  const html = await res.text()

  // Extract ytInitialPlayerResponse JSON
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/)
  if (!match) throw new Error('player_response_not_found')
  let player
  try {
    player = JSON.parse(match[1])
  } catch {
    throw new Error('player_response_parse_error')
  }
  const captionTracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(captionTracks) || captionTracks.length === 0) throw new Error('no_caption_tracks')

  function pickTrack() {
    const prefs: string[] = []
    if (targetLang) prefs.push(targetLang.toLowerCase())
    prefs.push('en', 'en-us', 'en-GB'.toLowerCase())
    // exact languageCode match
    for (const p of prefs) {
      const t = captionTracks.find((t: any) => (t.languageCode || '').toLowerCase() === p)
      if (t) return t
    }
    // otherwise prefer non-autoGenerated
    const manual = captionTracks.find((t: any) => !t.kind)
    return manual || captionTracks[0]
  }

  const track = pickTrack()
  let baseUrl: string = track?.baseUrl
  if (!baseUrl) throw new Error('track_base_url_missing')
  if (!/fmt=/.test(baseUrl)) baseUrl += (baseUrl.includes('?') ? '&' : '?') + 'fmt=vtt'

  const tRes = await fetch(baseUrl)
  if (!tRes.ok) throw new Error('track_fetch_failed')
  const vtt = await tRes.text()
  const segments = parseVttToSegments(vtt)
  if (!segments.length) throw new Error('track_empty')
  return segments
}
