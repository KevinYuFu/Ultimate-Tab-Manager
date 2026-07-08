import { describe, expect, it } from 'vitest'
import { fuzzyMatch } from './fuzzy'

const score = (q: string, t: string) => fuzzyMatch(q, t).score

describe('fuzzyMatch — matching', () => {
  it('matches a contiguous substring and reports its positions', () => {
    const r = fuzzyMatch('doc', 'docs.google.com')
    expect(r.matched).toBe(true)
    expect(r.positions).toEqual([0, 1, 2])
  })

  it('matches a non-contiguous subsequence', () => {
    const r = fuzzyMatch('ggl', 'google')
    expect(r.matched).toBe(true)
    expect(r.positions).toEqual([0, 3, 4]) // g(0) o o g(3) l(4) e
  })

  it('is case-insensitive', () => {
    expect(fuzzyMatch('GH', 'github').matched).toBe(true)
    expect(fuzzyMatch('gh', 'GitHub').matched).toBe(true)
  })

  it('rejects when the chars are out of order or absent', () => {
    expect(fuzzyMatch('cod', 'doc').matched).toBe(false) // wrong order
    expect(fuzzyMatch('xyz', 'docs').matched).toBe(false) // absent
  })

  it('treats an empty query as a trivial match', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ matched: true, score: 0, positions: [] })
  })
})

describe('fuzzyMatch — ranking', () => {
  it('ranks a contiguous match above a scattered one', () => {
    expect(score('abc', 'abcdef')).toBeGreaterThan(score('abc', 'axbxcx'))
  })

  it('ranks a start-of-text match above a mid-word one', () => {
    expect(score('doc', 'docs.google')).toBeGreaterThan(score('doc', 'my-document'))
  })

  it('ranks word-start matches (incl. camelCase) above buried ones', () => {
    // g@0 (start) + H hump vs. g,h buried mid-word in "spaghetti"
    expect(score('gh', 'GitHub')).toBeGreaterThan(score('gh', 'spaghetti'))
  })

  it('ranks an earlier first match above a deeper one', () => {
    expect(score('api', 'api.example.com')).toBeGreaterThan(score('api', 'my-old-api'))
  })
})
