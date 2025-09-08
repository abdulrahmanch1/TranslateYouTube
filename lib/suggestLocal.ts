export type Suggestion = { start: number; end: number; original: string; replacement: string; reason?: string }

function english(text: string): Suggestion[] {
  // Sentence-first pass: propose all applicable suggestions per sentence (no caps)
  const rules: { re: RegExp; replacement: string; reason: string; priority: number }[] = [
    // High-signal spelling/grammar
    { re: /\bteh\b/gi, replacement: 'the', reason: 'Spelling', priority: 1 },
    { re: /\brecieve\b/gi, replacement: 'receive', reason: 'Spelling', priority: 1 },
    { re: /\bseperate\b/gi, replacement: 'separate', reason: 'Spelling', priority: 1 },
    { re: /\bdefinately\b/gi, replacement: 'definitely', reason: 'Spelling', priority: 1 },
    { re: /\bwich\b/gi, replacement: 'which', reason: 'Spelling', priority: 1 },
    { re: /\balot\b/gi, replacement: 'a lot', reason: 'Common phrase', priority: 2 },
    { re: /\bdont\b/gi, replacement: "don't", reason: 'Contraction', priority: 2 },
    { re: /\bcant\b/gi, replacement: "can't", reason: 'Contraction', priority: 2 },
    { re: /\bwont\b/gi, replacement: "won't", reason: 'Contraction', priority: 2 },
    { re: /\bive\b/gi, replacement: "I've", reason: 'Contraction', priority: 2 },
    { re: /\bdoesnt\b/gi, replacement: "doesn't", reason: 'Contraction', priority: 2 },
    { re: /\bdidnt\b/gi, replacement: "didn't", reason: 'Contraction', priority: 2 },
    { re: /\bthier\b/gi, replacement: 'their', reason: 'Spelling', priority: 1 },
    { re: /\bhte\b/gi, replacement: 'the', reason: 'Spelling', priority: 1 },
    { re: /\bhallo\b/gi, replacement: 'Hello', reason: 'Spelling', priority: 2 },
    // Targeted phrasing (medium)
    { re: /\bmany\s+car\b/gi, replacement: 'many cars', reason: 'Plural noun', priority: 3 },
    { re: /\bpeople\s+scare\b/gi, replacement: 'people are scared', reason: 'Grammar', priority: 3 },
    { re: /\bgo\s+market\b/gi, replacement: 'go to the market', reason: 'Preposition', priority: 3 },
    { re: /\bsport\s+car\b/gi, replacement: 'sports car', reason: 'Noun form', priority: 3 },
    { re: /\bless\s+repair\b/gi, replacement: 'fewer repairs', reason: 'Countable noun', priority: 3 },
    { re: /\bsometime\b/gi, replacement: 'sometimes', reason: 'Frequency word', priority: 3 },
    { re: /\bfastly\b/gi, replacement: 'quickly', reason: 'Word choice', priority: 3 },
    { re: /\bsound\s+is\s+boom\b/gi, replacement: 'sounds loud', reason: 'Natural phrasing', priority: 4 },
    { re: /\bfuel\s+is\s+finish\b/gi, replacement: 'fuel runs out', reason: 'Natural phrasing', priority: 4 },
    { re: /\bbattery\s+finish\b/gi, replacement: 'battery runs out', reason: 'Natural phrasing', priority: 4 },
    { re: /\bvery\s+trust\b/gi, replacement: 'very reliable', reason: 'Word choice', priority: 4 },
    { re: /\bautomatic\s+easy\b/gi, replacement: 'automatic is easy', reason: 'Grammar', priority: 4 },
    { re: /\bmanual\s+cheap\b/gi, replacement: 'manual is cheaper', reason: 'Comparative', priority: 4 },
    { re: /\btoday\s+i\s+go\b/gi, replacement: 'today I went', reason: 'Tense', priority: 4 },
    { re: /\bone\s+friend\s+buy\b/gi, replacement: 'one friend bought', reason: 'Tense', priority: 4 },
  ]

  const out: Suggestion[] = []

  const lines = text.split('\n')
  let base = 0
  for (const line of lines) {
    // Split line into simple sentences, preserve indices via matchAll
    const pattern = /[^.!?\n]+[.!?]?/g
    const matches = Array.from(line.matchAll(pattern))
    for (const m of matches) {
      const seg = m[0]
      if (!seg || !seg.trim()) continue
      const segStart = base + (m.index || 0)
      // For each sentence, propose non-overlapping suggestions by priority
      const sentenceSugs: Suggestion[] = []
      for (const rule of rules.sort((a,b)=> a.priority - b.priority)) {
        rule.re.lastIndex = 0
        let hit: RegExpExecArray | null
        while ((hit = rule.re.exec(seg))) {
          const hStart = hit.index
          const hEnd = hStart + hit[0].length
          // Check overlap with already selected in this sentence
          if (sentenceSugs.some(s => !(segStart + hEnd <= s.start || segStart + hStart >= s.end))) continue
          sentenceSugs.push({
            start: segStart + hStart,
            end: segStart + hEnd,
            original: hit[0],
            replacement: rule.replacement,
            reason: rule.reason,
          })
        }
      }
      out.push(...sentenceSugs)
    }
    base += line.length + 1
  }
  return out
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
