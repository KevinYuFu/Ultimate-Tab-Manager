// Lightweight fuzzy matching for search — no dependency. Subsequence match:
// every character of `query` must appear in `text` in order, not necessarily
// adjacent. Returns a score (higher = better fit) and the matched character
// indices so callers can highlight them.
//
// The walk is greedy left-to-right: it takes the first occurrence of each query
// char. That's simple, fast, and good enough for tab names/URLs — unlike fzf's
// dynamic-programming search it isn't guaranteed globally optimal (it can pick a
// mid-word run over a slightly better word-start one). Easy to upgrade later.

export type FuzzyResult = {
  matched: boolean
  score: number
  /** Indices into `text` of the matched query chars, for highlighting. */
  positions: number[]
}

// Characters that mark the start of a new "word" in a name or URL.
const SEPARATORS = new Set([' ', '-', '_', '/', '.', ':', '\\', '?', '&', '='])

// Scoring weights, tuned so a match at a word start and a run of adjacent
// matches dominate over scattered ones.
const START_BONUS = 12 // first char of the text
const WORD_BOUNDARY_BONUS = 9 // right after a separator, or a camelCase hump
const CONSECUTIVE_BONUS = 6 // immediately after the previous matched char
const BASE = 1 // per matched char
const LEADING_PENALTY = 1 // per char skipped before the first match

export function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (query === '') return { matched: true, score: 0, positions: [] }

  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const positions: number[] = []
  let score = 0
  let qi = 0
  let prev = -1 // index of the previous matched char

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue

    // Where the char landed.
    if (ti === 0) score += START_BONUS
    else if (SEPARATORS.has(t[ti - 1]) || isCamelHump(text, ti)) score += WORD_BOUNDARY_BONUS

    // How it relates to the previous match.
    if (prev === ti - 1) score += CONSECUTIVE_BONUS
    else if (prev === -1) score -= ti * LEADING_PENALTY // deeper first match ranks lower

    score += BASE
    positions.push(ti)
    prev = ti
    qi++
  }

  // Ran out of text before consuming the query → not a subsequence.
  if (qi < q.length) return { matched: false, score: 0, positions: [] }
  return { matched: true, score, positions }
}

// A lowercase→uppercase transition (e.g. the "H" in "GitHub") starts a new word.
function isCamelHump(text: string, i: number): boolean {
  const prev = text[i - 1]
  const cur = text[i]
  return prev >= 'a' && prev <= 'z' && cur >= 'A' && cur <= 'Z'
}
