import { beforeEach, describe, expect, it } from 'vitest'
import { aiResponse, installChromeMock, type ChromeMock } from '../test/chromeMock'
import { aiSortPendingTabs, stashActiveTab, stashAllTabs } from './operations'
import type { Bin, Tab } from '../types'

let c: ChromeMock
beforeEach(() => {
  c = installChromeMock()
})

const bin = (id: string, name: string): Bin => ({ id, name, parentId: null })
const tab = (id: string, needsSort = false): Tab => ({
  id,
  url: `https://${id}.com`,
  name: id,
  favicon: '',
  dateAdded: 1,
  binId: null,
  ...(needsSort ? { needsSort: true } : {}),
})
const tabs = () => c.store.tabs as Tab[]
const bins = () => c.store.bins as Bin[]
const byId = (id: string) => tabs().find(t => t.id === id)!
const byUrl = (url: string) => tabs().find(t => t.url === url)!

describe('stashActiveTab', () => {
  beforeEach(() => {
    c.store.tabs = []
    c.activeTab = { id: 9, url: 'https://x.com', title: 'X', favIconUrl: '' }
  })

  it('flags the tab needsSort and closes it when AI sort is on', async () => {
    c.store.aiSortOnStash = true
    await stashActiveTab()
    expect(tabs()[0].needsSort).toBe(true)
    expect(tabs()[0].binId).toBeNull()
    expect(c.closed).toEqual([9])
  })

  it('does not flag the tab when AI sort is off', async () => {
    c.store.aiSortOnStash = false
    await stashActiveTab()
    expect(tabs()[0].needsSort).toBeFalsy()
  })
})

describe('stashAllTabs', () => {
  beforeEach(() => {
    c.store.tabs = []
    c.store.bins = [bin('b0', 'Work'), bin('b1', 'Recipes')]
    c.openTabs = [
      { id: 1, url: 'https://work.com', title: 'Work doc', pinned: false },
      { id: 2, url: 'https://misc.com', title: 'Misc', pinned: false },
    ]
  })

  it('AI on: fits go to existing bins, leftovers to a fresh date bin, tabs close', async () => {
    c.store.aiSortOnStash = true
    c.fetchImpl = aiResponse([{ tab: 0, bin: 0 }, { tab: 1, bin: -1 }])

    const dateBinId = await stashAllTabs()

    expect(c.fetchCalls).toBe(1)
    expect(byUrl('https://work.com').binId).toBe('b0') // matched existing bin
    expect(byUrl('https://misc.com').binId).toBe(dateBinId) // leftover → date bin
    expect(dateBinId).not.toBeNull()
    expect(bins().some(b => b.id === dateBinId)).toBe(true) // date bin was created
    expect([...c.closed].sort()).toEqual([1, 2])
  })

  it('AI off: everything goes to the date bin, no AI call', async () => {
    c.store.aiSortOnStash = false
    c.fetchImpl = aiResponse([{ tab: 0, bin: 0 }])

    const dateBinId = await stashAllTabs()

    expect(c.fetchCalls).toBe(0)
    expect(byUrl('https://work.com').binId).toBe(dateBinId)
    expect(byUrl('https://misc.com').binId).toBe(dateBinId)
  })

  it('AI errors: degrades to everything in the date bin (no tab lost)', async () => {
    c.store.aiSortOnStash = true
    c.fetchImpl = async () => ({ ok: false, status: 500 })

    const dateBinId = await stashAllTabs()

    expect(byUrl('https://work.com').binId).toBe(dateBinId)
    expect(byUrl('https://misc.com').binId).toBe(dateBinId)
  })

  it('skips pinned tabs', async () => {
    c.store.aiSortOnStash = false
    c.openTabs = [
      { id: 1, url: 'https://keep.com', title: 'Keep', pinned: true },
      { id: 2, url: 'https://go.com', title: 'Go', pinned: false },
    ]
    await stashAllTabs()
    expect(tabs().map(t => t.url)).toEqual(['https://go.com'])
    expect(c.closed).toEqual([2])
  })
})

describe('aiSortPendingTabs', () => {
  const setup = () => {
    c.store.bins = [bin('b0', 'Work'), bin('b1', 'Recipes')]
  }

  it('sorts flagged tabs into bins and clears the flag; a no-fit stays at root', async () => {
    setup()
    c.store.tabs = [tab('a', true), tab('b'), tab('c', true)]
    c.fetchImpl = aiResponse([{ tab: 0, bin: 0 }, { tab: 1, bin: -1 }]) // pending order: [a, c]

    await aiSortPendingTabs()

    expect(byId('a').binId).toBe('b0')
    expect(byId('a').needsSort).toBeFalsy()
    expect(byId('c').binId).toBeNull() // no fit → stays at root…
    expect(byId('c').needsSort).toBeFalsy() // …but the flag is cleared (the sort ran)
    expect(byId('b').binId).toBeNull() // untouched, was never pending
  })

  it('keeps the flag set when the AI call errors, so a later run retries', async () => {
    setup()
    c.store.tabs = [tab('a', true)]
    c.fetchImpl = async () => ({ ok: false, status: 500 })

    await aiSortPendingTabs()

    expect(byId('a').needsSort).toBe(true)
    expect(byId('a').binId).toBeNull()
  })

  it('stash → worker cancelled mid-sort → recovers on the next trigger', async () => {
    setup()
    c.store.tabs = [tab('a', true)]

    // First run: the worker dies before the request lands. Flag must survive.
    c.fetchImpl = async () => {
      throw new Error('worker evicted')
    }
    await aiSortPendingTabs()
    expect(byId('a').needsSort).toBe(true)
    expect(byId('a').binId).toBeNull()

    // Next trigger (onStartup / another stash): the API is reachable now.
    c.fetchImpl = aiResponse([{ tab: 0, bin: 1 }])
    await aiSortPendingTabs()
    expect(byId('a').binId).toBe('b1')
    expect(byId('a').needsSort).toBeFalsy()
  })

  it('clears flags without calling the AI when there are no bins to sort into', async () => {
    c.store.bins = []
    c.store.tabs = [tab('a', true)]

    await aiSortPendingTabs()

    expect(c.fetchCalls).toBe(0)
    expect(byId('a').needsSort).toBeFalsy()
    expect(byId('a').binId).toBeNull()
  })

  it('is a no-op (no AI call) when nothing is pending', async () => {
    setup()
    c.store.tabs = [tab('a'), tab('b')]

    await aiSortPendingTabs()

    expect(c.fetchCalls).toBe(0)
  })

  it('coalesces concurrent calls into a single AI request', async () => {
    setup()
    c.store.tabs = [tab('a', true)]
    c.fetchImpl = async () => {
      await new Promise(r => setTimeout(r, 10))
      return (await aiResponse([{ tab: 0, bin: 0 }])()) as unknown
    }

    await Promise.all([aiSortPendingTabs(), aiSortPendingTabs(), aiSortPendingTabs()])

    expect(c.fetchCalls).toBe(1)
  })
})
