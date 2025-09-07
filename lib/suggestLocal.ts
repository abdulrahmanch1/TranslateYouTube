export type Suggestion = { start: number; end: number; original: string; replacement: string; reason?: string }

function english(text: string): Suggestion[] {
  const out: Suggestion[] = []
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
      out.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: r.replacement, reason: r.reason })
    }
  }
  // Extra spaces
  let m: RegExpExecArray | null
  const doubles = / {2,}/g
  while ((m = doubles.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: ' ', reason: 'Extra spaces' })
  const spaceBeforePunct = /\s+([,.;:!?])/g
  while ((m = spaceBeforePunct.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: m[1], reason: 'Space before punctuation' })
  const dupWord = /\b(\w+)\s+\1\b/gi
  while ((m = dupWord.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: m[1], reason: 'Duplicate word' })
  const loneI = /\bi\b/g
  while ((m = loneI.exec(text))) out.push({ start: m.index, end: m.index + 1, original: 'i', replacement: 'I', reason: 'Pronoun capitalization' })
  out.sort((a,b)=> a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const dedup: Suggestion[] = []
  let lastEnd = -1
  for (const s of out) { if (s.start >= lastEnd) { dedup.push(s); lastEnd = s.end } }
  return dedup
}

function arabic(text: string): Suggestion[] {
  const out: Suggestion[] = []
  const rules: { re: RegExp; replacement: string; reason: string }[] = [
    { re: /\bزهبت\b/g, replacement: 'ذهبت', reason: 'تصحيح إملائي' },
    { re: /\bساءلت\b/g, replacement: 'سألت', reason: 'تصحيح إملائي' },
    { re: /\bالباءع\b/g, replacement: 'البائع', reason: 'تصحيح إملائي' },
    { re: /\bبندوره\b/g, replacement: 'بندورة', reason: 'تصحيح إملائي' },
    { re: /\bالسياره\b/g, replacement: 'السيارة', reason: 'تصحيح إملائي' },
  ]
  for (const r of rules) {
    let m: RegExpExecArray | null
    while ((m = r.re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, original: m[0], replacement: r.replacement, reason: r.reason })
  }
  return out
}

export function naiveSuggestionsFor(text: string): Suggestion[] {
  const isArabic = /[\u0600-\u06FF]/.test(text)
  return isArabic ? arabic(text) : english(text)
}

