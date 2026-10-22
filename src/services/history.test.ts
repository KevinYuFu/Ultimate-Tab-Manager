import { beforeEach, describe, expect, it } from 'vitest'
import { aiResponse, installChromeMock, type ChromeMock } from '../test/chromeMock'
import { sortBin, sortRootTabs } from './operations'
import { recordSort, redo, sortSnapshot, undo } from './history'
import type { Bin, Tab } from '../types'

let c: ChromeMock
beforeEach(() => {
  c = installChromeMock()
})

const bin = (id: string): Bin => ({ id, name: id, parentId: null })
const tab = (id: string, binId: string | null): Tab => ({
  id,
  url: `https://${id}.com`,
  name: id,
  favicon: '',
  dateAdded: 1,
  binId,
})
const tabs = () => c.store.tabs as Tab[]
const bins = () => c.store.bins as Bin[]
const binOf = (id: string) => tabs().find(t => t.id === id)!.binId

describe('undo an AI sort', () => {
  it('one undo moves the tabs back; redo sorts them again', async () => {
    c.store.bins = [bin('b0'), bin('b1')]
    c.store.tabs = [tab('a', null), tab('b', null)]
    c.fetchImpl = aiResponse([{ tab: 0, bin: 1 }, { tab: 1, bin: -1 }])

    const before = await sortSnapshot(null)
    await sortRootTabs()
    await recordSort(before)
    expect(binOf('a')).toBe('b1')

    await undo()
    expect(binOf('a')).toBeNull()
    expect(binOf('b')).toBeNull()

    await redo()
    expect(binOf('a')).toBe('b1')
  })

  it('one undo also brings back a bin the sort emptied and deleted', async () => {
    c.store.bins = [bin('b0'), bin('b1')]
    c.store.tabs = [tab('a', 'b0')]
    c.fetchImpl = aiResponse([{ tab: 0, bin: 0 }]) // targets = [b1]

    const before = await sortSnapshot('b0')
    await sortBin('b0')
    await recordSort(before)
    expect(bins().map(b => b.id)).toEqual(['b1'])

    await undo()
    expect(bins().map(b => b.id)).toEqual(['b0', 'b1'])
    expect(binOf('a')).toBe('b0')

    await redo()
    expect(bins().map(b => b.id)).toEqual(['b1'])
    expect(binOf('a')).toBe('b1')
  })

  it('records nothing when the sort moved nothing', async () => {
    c.store.bins = [bin('b0'), bin('b1')]
    c.store.tabs = [tab('a', 'b0')]
    c.fetchImpl = aiResponse([{ tab: 0, bin: -1 }])

    const before = await sortSnapshot('b0')
    await sortBin('b0')
    await recordSort(before)

    expect(await undo()).toBe(false)
  })
})
