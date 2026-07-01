// Higher-level operations that compose the tabs + storage + naming services.
// Components call these; they never touch the chrome APIs directly.

import type { Bin, Tab, UndoEntry } from '../types'
import {
  getBins,
  getStashedTabs,
  getUndoStack,
  saveBins,
  saveStashedTabs,
  saveUndoStack,
} from './storage'
import {
  closeTab,
  closeTabs,
  getActiveTab,
  getTabsInCurrentWindow,
  openExtensionPage,
  openUrl,
} from './tabs'
import { smartName } from './smartName'

// How many undo steps we keep. Each entry is a small delta, not a full snapshot.
const MAX_UNDO = 25

// Push the inverse of an operation onto the undo stack (persisted, so undo
// survives the popup closing).
async function pushUndo(entry: UndoEntry): Promise<void> {
  const stack = await getUndoStack()
  const next = [...stack, entry]
  while (next.length > MAX_UNDO) next.shift()
  await saveUndoStack(next)
}

// Undo the last operation by applying its inverse delta. Returns true if
// something was undone.
export async function undo(): Promise<boolean> {
  const stack = await getUndoStack()
  const entry = stack[stack.length - 1]
  if (!entry) return false
  await saveUndoStack(stack.slice(0, -1))
  await applyUndo(entry)
  return true
}

// Apply one inverse delta. Each case reverses exactly the mutation that
// recorded it; splices use the recorded original index so order is restored.
async function applyUndo(entry: UndoEntry): Promise<void> {
  switch (entry.kind) {
    case 'unstash': {
      const [tabs, bins] = await Promise.all([getStashedTabs(), getBins()])
      const dropTabs = new Set(entry.tabIds)
      const dropBins = new Set(entry.binIds)
      await saveStashedTabs(tabs.filter(t => !dropTabs.has(t.id)))
      if (entry.binIds.length) await saveBins(bins.filter(b => !dropBins.has(b.id)))
      for (const url of entry.urls) await openUrl(url)
      break
    }
    case 'restoreTabs': {
      const tabs = await getStashedTabs()
      // Ascending index so each insert lands before the next one shifts things.
      for (const { tab, index } of [...entry.tabs].sort((a, b) => a.index - b.index)) {
        tabs.splice(Math.min(index, tabs.length), 0, tab)
      }
      await saveStashedTabs(tabs)
      break
    }
    case 'restoreBin': {
      const [tabs, bins] = await Promise.all([getStashedTabs(), getBins()])
      const kids = new Set(entry.childBinIds)
      const kidTabs = new Set(entry.childTabIds)
      bins.splice(Math.min(entry.index, bins.length), 0, entry.bin)
      await saveBins(bins.map(b => (kids.has(b.id) ? { ...b, parentId: entry.bin.id } : b)))
      await saveStashedTabs(
        tabs.map(t => (kidTabs.has(t.id) ? { ...t, binId: entry.bin.id } : t)),
      )
      break
    }
    case 'removeBin': {
      const bins = await getBins()
      await saveBins(bins.filter(b => b.id !== entry.id))
      break
    }
    case 'renameTab': {
      const tabs = await getStashedTabs()
      await saveStashedTabs(tabs.map(t => (t.id === entry.id ? { ...t, name: entry.name } : t)))
      break
    }
    case 'renameBin': {
      const bins = await getBins()
      await saveBins(bins.map(b => (b.id === entry.id ? { ...b, name: entry.name } : b)))
      break
    }
    case 'moveTab': {
      const tabs = await getStashedTabs()
      const tab = tabs.find(t => t.id === entry.id)
      if (!tab) break
      const rest = tabs.filter(t => t.id !== entry.id)
      rest.splice(Math.min(entry.index, rest.length), 0, { ...tab, binId: entry.binId })
      await saveStashedTabs(rest)
      break
    }
    case 'moveBin': {
      const bins = await getBins()
      const bin = bins.find(b => b.id === entry.id)
      if (!bin) break
      const rest = bins.filter(b => b.id !== entry.id)
      rest.splice(Math.min(entry.index, rest.length), 0, { ...bin, parentId: entry.parentId })
      await saveBins(rest)
      break
    }
  }
}

export async function listStashedTabs(): Promise<Tab[]> {
  return getStashedTabs()
}

export async function listBins(): Promise<Bin[]> {
  return getBins()
}

// Stash the active tab: save it first, then close it (so an interrupted
// close never loses the tab). Returns the updated list.
export async function stashActiveTab(): Promise<Tab[]> {
  const active = await getActiveTab()
  const existing = await getStashedTabs()
  if (!active?.url) return existing

  const tab: Tab = {
    id: crypto.randomUUID(),
    url: active.url,
    name: smartName(active.title, active.url),
    favicon: active.favIconUrl ?? '',
    dateAdded: Date.now(),
    binId: null,
  }

  const updated = [tab, ...existing]
  await saveStashedTabs(updated)
  await pushUndo({ kind: 'unstash', tabIds: [tab.id], binIds: [], urls: [tab.url] })
  if (active.id !== undefined) await closeTab(active.id)
  return updated
}

export async function openStashedTab(tab: Tab): Promise<void> {
  await openUrl(tab.url)
}

// Open the tab manager in its own full browser tab (more room for organizing).
export async function openFullView(): Promise<void> {
  await openExtensionPage('popup.html?view=full')
}

// Stash every normal (http/https) tab in the current window into a new
// date-named bin, then close them. Returns the new bin's id (or null if there
// was nothing to stash). chrome:// / new-tab pages are skipped.
export async function stashAllTabs(): Promise<string | null> {
  const open = await getTabsInCurrentWindow()
  // Skip pinned tabs: a pinned tab is a deliberate "keep this open" signal.
  const stashable = open.filter(t => t.url && !t.pinned && /^https?:/i.test(t.url))
  if (stashable.length === 0) return null

  const bins = await getBins()
  const existing = await getStashedTabs()

  const bin: Bin = {
    id: crypto.randomUUID(),
    name: new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    parentId: null,
  }
  const now = Date.now()
  const stashed: Tab[] = stashable.map(t => ({
    id: crypto.randomUUID(),
    url: t.url!,
    name: smartName(t.title, t.url!),
    favicon: t.favIconUrl ?? '',
    dateAdded: now,
    binId: bin.id,
  }))

  await saveBins([bin, ...bins])
  await saveStashedTabs([...stashed, ...existing])
  await pushUndo({
    kind: 'unstash',
    tabIds: stashed.map(t => t.id),
    binIds: [bin.id],
    urls: stashed.map(t => t.url),
  })
  await closeTabs(stashable.map(t => t.id).filter((id): id is number => id !== undefined))
  return bin.id
}

export async function renameStashedTab(id: string, name: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const target = tabs.find(t => t.id === id)
  if (!target) return tabs
  await pushUndo({ kind: 'renameTab', id, name: target.name })
  const updated = tabs.map(t => (t.id === id ? { ...t, name } : t))
  await saveStashedTabs(updated)
  return updated
}

export async function deleteStashedTab(id: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const index = tabs.findIndex(t => t.id === id)
  if (index === -1) return tabs
  await pushUndo({ kind: 'restoreTabs', tabs: [{ tab: tabs[index], index }] })
  const updated = tabs.filter(t => t.id !== id)
  await saveStashedTabs(updated)
  return updated
}

// Delete several tabs in one write (a per-id loop would race on the shared list).
export async function deleteStashedTabs(ids: string[]): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const remove = new Set(ids)
  const removed = tabs
    .map((tab, index) => ({ tab, index }))
    .filter(({ tab }) => remove.has(tab.id))
  if (removed.length === 0) return tabs
  await pushUndo({ kind: 'restoreTabs', tabs: removed })
  const updated = tabs.filter(t => !remove.has(t.id))
  await saveStashedTabs(updated)
  return updated
}

// Reorder a tab relative to a sibling, adopting that sibling's bin (so dropping
// a tab among a bin's tabs also moves it into that bin). Returns the new order.
export async function reorderTabs(
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  if (draggedId === targetId) return tabs
  const dragged = tabs.find(t => t.id === draggedId)
  const target = tabs.find(t => t.id === targetId)
  if (!dragged || !target) return tabs

  const moved: Tab = { ...dragged, binId: target.binId }
  const rest = tabs.filter(t => t.id !== draggedId)
  let idx = rest.findIndex(t => t.id === targetId)
  if (idx === -1) return tabs
  if (placeAfter) idx += 1

  const prevIndex = tabs.findIndex(t => t.id === draggedId)
  await pushUndo({ kind: 'moveTab', id: draggedId, index: prevIndex, binId: dragged.binId })
  rest.splice(idx, 0, moved)
  await saveStashedTabs(rest)
  return rest
}

// Move a tab into a bin (or to root when binId is null), placed at the end.
export async function moveTabToBin(tabId: string, binId: string | null): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const dragged = tabs.find(t => t.id === tabId)
  if (!dragged || dragged.binId === binId) return tabs

  const prevIndex = tabs.findIndex(t => t.id === tabId)
  await pushUndo({ kind: 'moveTab', id: tabId, index: prevIndex, binId: dragged.binId })
  const rest = tabs.filter(t => t.id !== tabId)
  rest.push({ ...dragged, binId })
  await saveStashedTabs(rest)
  return rest
}

// ── Bins (slice 1: create / rename / delete) ──

export async function createBin(parentId: string | null): Promise<Bin> {
  const bins = await getBins()
  const bin: Bin = { id: crypto.randomUUID(), name: 'New Bin', parentId }
  await saveBins([...bins, bin])
  await pushUndo({ kind: 'removeBin', id: bin.id })
  return bin
}

export async function renameBin(id: string, name: string): Promise<Bin[]> {
  const bins = await getBins()
  const target = bins.find(b => b.id === id)
  if (!target) return bins
  await pushUndo({ kind: 'renameBin', id, name: target.name })
  const updated = bins.map(b => (b.id === id ? { ...b, name } : b))
  await saveBins(updated)
  return updated
}

// Delete a bin, moving its child bins and tabs up to its parent (no data loss).
export async function deleteBin(id: string): Promise<void> {
  const bins = await getBins()
  const tabs = await getStashedTabs()
  const index = bins.findIndex(b => b.id === id)
  if (index === -1) return
  const target = bins[index]
  const newParent = target.parentId

  await pushUndo({
    kind: 'restoreBin',
    bin: target,
    index,
    childBinIds: bins.filter(b => b.parentId === id).map(b => b.id),
    childTabIds: tabs.filter(t => t.binId === id).map(t => t.id),
  })

  await saveBins(
    bins
      .filter(b => b.id !== id)
      .map(b => (b.parentId === id ? { ...b, parentId: newParent } : b)),
  )
  await saveStashedTabs(
    tabs.map(t => (t.binId === id ? { ...t, binId: newParent } : t)),
  )
}

// Reorder a bin relative to a sibling bin, adopting that sibling's parent.
// Rejects moves that would create a cycle (target inside the dragged subtree).
export async function reorderBins(
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): Promise<Bin[]> {
  const bins = await getBins()
  if (draggedId === targetId) return bins
  const dragged = bins.find(b => b.id === draggedId)
  const target = bins.find(b => b.id === targetId)
  if (!dragged || !target) return bins

  // Walk up from target; if we reach the dragged bin, the move would cycle.
  const byId = new Map(bins.map(b => [b.id, b]))
  let cursor: string | null = target.parentId
  while (cursor) {
    if (cursor === draggedId) return bins
    cursor = byId.get(cursor)?.parentId ?? null
  }

  const moved: Bin = { ...dragged, parentId: target.parentId }
  const rest = bins.filter(b => b.id !== draggedId)
  let idx = rest.findIndex(b => b.id === targetId)
  if (idx === -1) return bins
  if (placeAfter) idx += 1

  const prevIndex = bins.findIndex(b => b.id === draggedId)
  await pushUndo({ kind: 'moveBin', id: draggedId, index: prevIndex, parentId: dragged.parentId })
  rest.splice(idx, 0, moved)
  await saveBins(rest)
  return rest
}

// Nest a bin under newParentId (or root when null), rejecting cycles
// (can't drop a bin into itself or one of its descendants).
export async function moveBin(binId: string, newParentId: string | null): Promise<Bin[]> {
  const bins = await getBins()
  if (binId === newParentId) return bins

  const byId = new Map(bins.map(b => [b.id, b]))
  const target = byId.get(binId)
  if (!target || target.parentId === newParentId) return bins
  let cursor = newParentId
  while (cursor) {
    if (cursor === binId) return bins // newParent is a descendant → would cycle
    cursor = byId.get(cursor)?.parentId ?? null
  }

  const prevIndex = bins.findIndex(b => b.id === binId)
  await pushUndo({ kind: 'moveBin', id: binId, index: prevIndex, parentId: target.parentId })
  const updated = bins.map(b => (b.id === binId ? { ...b, parentId: newParentId } : b))
  await saveBins(updated)
  return updated
}
