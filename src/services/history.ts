// Undo / redo for stashed-file management (delete, rename, move, bins).
//
// The model is a flat list of Commands plus a cursor (see the History type).
// Each Command carries the data to go BOTH ways, so undo and redo are the exact
// same move in opposite directions: step the cursor and `apply` the command
// with a direction. A new edit truncates the redo "future" and appends.
//
// Recording lives here too: call sites (handlers, the drag hook) call a
// `record*` helper, which captures the "before" state and stores the command.
// The base operations stay pure — they don't know history exists.

import type { BinSpot, Command, TabAt } from '../types'
import {
  getBins,
  getHistory,
  getStashedTabs,
  saveBins,
  saveHistory,
  saveStashedTabs,
} from './storage'

// Cap the history so it can't grow without bound (each command is a small delta).
const MAX_HISTORY = 50

// ── The engine ───────────────────────────────────────────────────────────────

// Apply one command in the given direction. 'redo' replays the original edit;
// 'undo' does the opposite. Splices use the recorded index, so order is exact.
async function apply(command: Command, direction: 'undo' | 'redo'): Promise<void> {
  switch (command.type) {
    case 'removeTabs': {
      const tabs = await getStashedTabs()
      if (direction === 'redo') {
        const ids = new Set(command.items.map(i => i.tab.id))
        await saveStashedTabs(tabs.filter(t => !ids.has(t.id)))
      } else {
        // Re-insert ascending so each splice lands before the next shifts things.
        for (const { tab, index } of [...command.items].sort((a, b) => a.index - b.index)) {
          tabs.splice(Math.min(index, tabs.length), 0, tab)
        }
        await saveStashedTabs(tabs)
      }
      break
    }
    case 'createBin': {
      const bins = await getBins()
      if (direction === 'redo') {
        bins.splice(Math.min(command.index, bins.length), 0, command.bin)
        await saveBins(bins)
      } else {
        await saveBins(bins.filter(b => b.id !== command.bin.id))
      }
      break
    }
    case 'deleteBin': {
      const [tabs, bins] = await Promise.all([getStashedTabs(), getBins()])
      const kidBins = new Set(command.childBinIds)
      const kidTabs = new Set(command.childTabIds)
      if (direction === 'redo') {
        // Remove the bin; its children move up to the bin's parent.
        const up = command.bin.parentId
        await saveBins(
          bins
            .filter(b => b.id !== command.bin.id)
            .map(b => (kidBins.has(b.id) ? { ...b, parentId: up } : b)),
        )
        await saveStashedTabs(tabs.map(t => (kidTabs.has(t.id) ? { ...t, binId: up } : t)))
      } else {
        // Put the bin back and re-adopt its former children.
        bins.splice(Math.min(command.index, bins.length), 0, command.bin)
        await saveBins(bins.map(b => (kidBins.has(b.id) ? { ...b, parentId: command.bin.id } : b)))
        await saveStashedTabs(
          tabs.map(t => (kidTabs.has(t.id) ? { ...t, binId: command.bin.id } : t)),
        )
      }
      break
    }
    case 'renameTab': {
      const name = direction === 'redo' ? command.to : command.from
      const tabs = await getStashedTabs()
      await saveStashedTabs(tabs.map(t => (t.id === command.id ? { ...t, name } : t)))
      break
    }
    case 'renameBin': {
      const name = direction === 'redo' ? command.to : command.from
      const bins = await getBins()
      await saveBins(bins.map(b => (b.id === command.id ? { ...b, name } : b)))
      break
    }
    case 'moveTabs': {
      // Take the target snapshot (from = undo, to = redo), drop those tabs from
      // the current list, then re-insert the snapshot at its recorded indices
      // ascending. The snapshot carries each tab's binId, so bin changes ride
      // along. Works for one tab or many.
      const target = direction === 'redo' ? command.to : command.from
      const ids = new Set(target.map(x => x.tab.id))
      const tabs = (await getStashedTabs()).filter(t => !ids.has(t.id))
      for (const { tab, index } of [...target].sort((a, b) => a.index - b.index)) {
        tabs.splice(Math.min(index, tabs.length), 0, tab)
      }
      await saveStashedTabs(tabs)
      break
    }
    case 'moveBin': {
      const spot = direction === 'redo' ? command.to : command.from
      const bins = await getBins()
      const bin = bins.find(b => b.id === command.id)
      if (!bin) break
      const rest = bins.filter(b => b.id !== command.id)
      rest.splice(Math.min(spot.index, rest.length), 0, { ...bin, parentId: spot.parentId })
      await saveBins(rest)
      break
    }
  }
}

export async function undo(): Promise<boolean> {
  const { commands, cursor } = await getHistory()
  if (cursor === 0) return false
  await apply(commands[cursor - 1], 'undo')
  await saveHistory({ commands, cursor: cursor - 1 })
  return true
}

export async function redo(): Promise<boolean> {
  const { commands, cursor } = await getHistory()
  if (cursor >= commands.length) return false
  await apply(commands[cursor], 'redo')
  await saveHistory({ commands, cursor: cursor + 1 })
  return true
}

// Append a command: drop any redoable future, add this, cap from the front.
async function record(command: Command): Promise<void> {
  const { commands, cursor } = await getHistory()
  const next = [...commands.slice(0, cursor), command].slice(-MAX_HISTORY)
  await saveHistory({ commands: next, cursor: next.length })
}

// ── Recorders (call these at the action site; ops stay pure) ─────────────────

// Rename/move recorders take the values directly; delete/deleteBin/create read
// current state to capture what they need. Call rename/move/delete BEFORE the
// op; call createBin AFTER (the new bin doesn't exist until then).

export function recordRenameTab(id: string, from: string, to: string): Promise<void> {
  if (from === to) return Promise.resolve()
  return record({ type: 'renameTab', id, from, to })
}

export function recordRenameBin(id: string, from: string, to: string): Promise<void> {
  if (from === to) return Promise.resolve()
  return record({ type: 'renameBin', id, from, to })
}

export async function recordDeleteTabs(ids: string[]): Promise<void> {
  const tabs = await getStashedTabs()
  const wanted = new Set(ids)
  const items = tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => wanted.has(tab.id))
  if (items.length) await record({ type: 'removeTabs', items })
}

export async function recordCreateBin(bin: { id: string }): Promise<void> {
  const bins = await getBins()
  const index = bins.findIndex(b => b.id === bin.id)
  if (index !== -1) await record({ type: 'createBin', bin: bins[index], index })
}

export async function recordDeleteBin(id: string): Promise<void> {
  const [tabs, bins] = await Promise.all([getStashedTabs(), getBins()])
  const index = bins.findIndex(b => b.id === id)
  if (index === -1) return
  await record({
    type: 'deleteBin',
    bin: bins[index],
    index,
    childBinIds: bins.filter(b => b.parentId === id).map(b => b.id),
    childTabIds: tabs.filter(t => t.binId === id).map(t => t.id),
  })
}

// Moves need a before/after snapshot. Capture it (tabsSnapshot/binSpot) before
// running the move op, then hand it to recordTabsMove/recordBinMove afterwards.
export async function tabsSnapshot(ids: string[]): Promise<TabAt[]> {
  const wanted = new Set(ids)
  const tabs = await getStashedTabs()
  return tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => wanted.has(tab.id))
}

export async function binSpot(id: string): Promise<BinSpot> {
  const bins = await getBins()
  const index = bins.findIndex(b => b.id === id)
  return { index, parentId: index === -1 ? null : bins[index].parentId }
}

// Record a tab move (one or many). `from` is the snapshot captured before the
// move; we snapshot "after" here and store both. No-op moves are ignored.
export async function recordTabsMove(ids: string[], from: TabAt[]): Promise<void> {
  const to = await tabsSnapshot(ids)
  if (JSON.stringify(from) === JSON.stringify(to)) return
  await record({ type: 'moveTabs', from, to })
}

export async function recordBinMove(id: string, from: BinSpot): Promise<void> {
  const to = await binSpot(id)
  if (to.index === -1 || (to.index === from.index && to.parentId === from.parentId)) return
  await record({ type: 'moveBin', id, from, to })
}
