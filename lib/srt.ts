export type CaptionItem = {
  id: number
  start: number // seconds
  end: number // seconds
  text: string
}

function toTimestamp(s: number) {
  const h = Math.floor(s/3600).toString().padStart(2,'0')
  const m = Math.floor((s%3600)/60).toString().padStart(2,'0')
  const sec = Math.floor(s%60).toString().padStart(2,'0')
  const ms = Math.floor((s%1)*1000).toString().padStart(3,'0')
  return `${h}:${m}:${sec},${ms}`
}

function toVttTimestamp(s: number) {
  return toTimestamp(s).replace(',', '.')
}

export function toSRT(cues: CaptionItem[]) {
  return cues.map(c => `${c.id}\n${toTimestamp(c.start)} --> ${toTimestamp(c.end)}\n${c.text}\n`).join('\n')
}

export function toVTT(cues: CaptionItem[]) {
  return `WEBVTT\n\n` + cues.map(c => `${toVttTimestamp(c.start)} --> ${toVttTimestamp(c.end)}\n${c.text}\n`).join('\n')
}

export function naiveSegment(text: string, chunkSec = 5): CaptionItem[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
  const cues: CaptionItem[] = []
  let t = 0
  let id = 1
  for (const p of parts) {
    const dur = Math.max(2, Math.min(chunkSec, Math.ceil(p.length/18)))
    cues.push({ id: id++, start: t, end: t + dur, text: p })
    t += dur
  }
  return cues
}

export function withText(cues: CaptionItem[], texts: string[]): CaptionItem[] {
  const n = Math.min(cues.length, texts.length)
  const out = cues.slice(0, n).map((c, i) => ({ ...c, text: texts[i] }))
  return out
}

