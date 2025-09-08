export type Cue = { id: number; start: number; end: number; text: string }

function tsToSecSrt(ts: string): number {
  // Accept flexible SRT timestamps, e.g., 0:00:05,000 or 00:00:05.123
  const cleaned = ts.replace(/\uFEFF/g, '').trim()
  const m = cleaned.match(/(\d{1,3}):(\d{1,2}):(\d{1,2})[\.,](\d{1,3})/)
  if (!m) return 0
  const h = parseInt(m[1], 10) || 0
  const mi = parseInt(m[2], 10) || 0
  const se = parseInt(m[3], 10) || 0
  const ms = parseInt((m[4] || '0').padEnd(3, '0').slice(0,3), 10) || 0
  return h * 3600 + mi * 60 + se + ms / 1000
}

function tsToSecVtt(ts: string): number {
  const cleaned = ts.replace(/\uFEFF/g, '').trim()
  const m = cleaned.match(/(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[\.,](\d{1,3})/)
  if (!m) return 0
  const h = parseInt(m[1] || '0', 10) || 0
  const min = parseInt(m[2], 10) || 0
  const s = parseInt(m[3], 10) || 0
  const ms = parseInt((m[4] || '0').padEnd(3, '0').slice(0,3), 10) || 0
  return h * 3600 + min * 60 + s + ms / 1000
}

export function parseSrt(input: string): { text: string; cues: Cue[] } {
  const blocks = input.replace(/\r/g, '').split(/\n\n+/)
  const cues: Cue[] = []
  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue
    const time = (lines.find(l => /-->/.test(l)) || '').replace(/\uFEFF/g, '')
    // Robust match for SRT timestamps
    const m = time.match(/(\d{1,3}:\d{1,2}:\d{1,2}[\.,]\d{1,3})\s*-->\s*(\d{1,3}:\d{1,2}:\d{1,2}[\.,]\d{1,3})/)
    if (!m) continue
    const start = tsToSecSrt(m[1])
    const end = tsToSecSrt(m[2])
    const contentIdx = lines.findIndex(l => /-->/.test(l))
    const content = lines.slice(contentIdx + 1).join(' ').replace(/<\/?[^>]+>/g, '')
    cues.push({ id: cues.length + 1, start, end, text: content })
  }
  const full = cues.map(c => c.text).join('\n')
  return { text: full, cues }
}

export function parseVtt(input: string): { text: string; cues: Cue[] } {
  const lines = input.replace(/\r/g, '').split('\n')
  const cues: Cue[] = []
  let i = 0
  while (i < lines.length) {
    let line = (lines[i++] || '').trim()
    if (!line) continue
    if (/^webvtt/i.test(line)) continue
    if (!/-->/.test(line) && i < lines.length) {
      const peek = (lines[i] || '').trim()
      if (/-->/.test(peek)) { line = peek; i++ } else continue
    }
    const m = line.match(/([^\s]+)\s+-->\s+([^\s]+)/)
    if (!m) continue
    const start = tsToSecVtt(m[1])
    const end = tsToSecVtt(m[2])
    const textLines: string[] = []
    while (i < lines.length && (lines[i] || '').trim() !== '') textLines.push(lines[i++])
    const t = textLines.join(' ').replace(/<\/?[^>]+>/g, '').trim()
    if (t) cues.push({ id: cues.length + 1, start, end, text: t })
  }
  const full = cues.map(c => c.text).join('\n')
  return { text: full, cues }
}

export function parseCaptionsFromText(filename: string, content: string): { text: string; cues: Cue[] } {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.vtt')) return parseVtt(content)
  if (lower.endsWith('.srt')) return parseSrt(content)
  // fallback: treat as plain text with naive segmentation (2-5s)
  const parts = content.split(/\n+/).filter(Boolean)
  const cues: Cue[] = []
  let t = 0
  let id = 1
  for (const p of parts) {
    const dur = Math.max(2, Math.min(5, Math.ceil(p.length / 18)))
    cues.push({ id: id++, start: t, end: t + dur, text: p })
    t += dur
  }
  return { text: cues.map(c => c.text).join('\n'), cues }
}
