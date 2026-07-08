import { beforeEach, describe, expect, it } from 'vitest'
import { installChromeMock, type ChromeMock } from '../test/chromeMock'
import { isAiSortEnabled, sortIntoExistingBins } from './aiSort'
import type { SortAssignment, SortRequest } from './aiProvider'
import type { Bin, Tab } from '../types'

let c: ChromeMock
beforeEach(() => {
  c = installChromeMock()
})

const bin = (id: string, name: string): Bin => ({ id, name, parentId: null })
const tab = (id: string): Tab => ({
  id,
  url: `https://${id}.com`,
  name: id,
  favicon: '',
  dateAdded: 1,
  binId: null,
})
// A fake provider that returns fixed assignments (no network).
const provider = (a: SortAssignment[]) => async (_req: SortRequest) => a

describe('sortIntoExistingBins', () => {
  const bins = [bin('b0', 'Work'), bin('b1', 'Recipes')]

  it('places tabs into their assigned bins; a -1 assignment is a leftover', async () => {
    const r = await sortIntoExistingBins(
      [tab('a'), tab('b'), tab('c')],
      bins,
      provider([{ tab: 0, bin: 0 }, { tab: 1, bin: 1 }, { tab: 2, bin: -1 }]),
    )
    expect(r.placements.map(p => [p.tab.id, p.binId])).toEqual([['a', 'b0'], ['b', 'b1']])
    expect(r.leftovers.map(t => t.id)).toEqual(['c'])
    expect(r.succeeded).toBe(true)
  })

  it('guards an out-of-range bin index into a leftover', async () => {
    const r = await sortIntoExistingBins(
      [tab('a'), tab('b')],
      bins,
      provider([{ tab: 0, bin: 5 }, { tab: 1, bin: 0 }]),
    )
    expect(r.placements.map(p => p.tab.id)).toEqual(['b'])
    expect(r.leftovers.map(t => t.id)).toEqual(['a'])
  })

  it('treats a tab with no assignment as a leftover', async () => {
    const r = await sortIntoExistingBins([tab('a'), tab('b')], bins, provider([{ tab: 0, bin: 1 }]))
    expect(r.placements.map(p => p.tab.id)).toEqual(['a'])
    expect(r.leftovers.map(t => t.id)).toEqual(['b'])
  })

  it('skips the call entirely when there are no bins (not an error)', async () => {
    let called = false
    const r = await sortIntoExistingBins([tab('a')], [], async () => {
      called = true
      return []
    })
    expect(called).toBe(false)
    expect(r.leftovers.map(t => t.id)).toEqual(['a'])
    expect(r.succeeded).toBe(true)
  })

  it('degrades to all-leftovers with succeeded=false when the provider throws', async () => {
    const r = await sortIntoExistingBins([tab('a'), tab('b')], bins, async () => {
      throw new Error('network down')
    })
    expect(r.placements).toEqual([])
    expect(r.leftovers.map(t => t.id)).toEqual(['a', 'b'])
    expect(r.succeeded).toBe(false)
  })
})

describe('isAiSortEnabled', () => {
  it('is true only when the toggle is on (premium is stubbed on in dev)', async () => {
    c.store.aiSortOnStash = true
    expect(await isAiSortEnabled()).toBe(true)

    c.store.aiSortOnStash = false
    expect(await isAiSortEnabled()).toBe(false)

    delete c.store.aiSortOnStash
    expect(await isAiSortEnabled()).toBe(false)
  })
})
