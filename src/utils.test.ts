import { describe, expect, it } from 'vitest'
import { timeAgo } from './utils'

describe('timeAgo', () => {
  const now = 1_000_000_000_000
  const ago = (ms: number) => timeAgo(now - ms, now)
  const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR

  it('labels each range', () => {
    expect(ago(30_000)).toBe('now')
    expect(ago(5 * MIN)).toBe('5m')
    expect(ago(3 * HR)).toBe('3h')
    expect(ago(2 * DAY)).toBe('2d')
    expect(ago(15 * DAY)).toBe('2w')
    expect(ago(65 * DAY)).toBe('2mo')
    expect(ago(400 * DAY)).toBe('1y')
  })
})
