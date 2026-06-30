// Higher-level operations that compose the tabs + storage + naming services.
// Components call these; they never touch the chrome APIs directly.

import type { Bin, Tab } from '../types'
import {
  getBins,
  getStashedTabs,
  saveBins,
  saveStashedTabs,
} from './storage'
import {
  closeTab,
  closeTabs,
  getActiveTab,
  getTabsInCurrentWindow,
  openUrl,
} from './tabs'
import { smartName } from './smartName'

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
  if (active.id !== undefined) await closeTab(active.id)
  return updated
}

export async function openStashedTab(tab: Tab): Promise<void> {
  await openUrl(tab.url)
}

// Stash every normal (http/https) tab in the current window into a new
// date-named bin, then close them. Returns the new bin's id (or null if there
// was nothing to stash). chrome:// / new-tab pages are skipped.
export async function stashAllTabs(): Promise<string | null> {
  const open = await getTabsInCurrentWindow()
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
  await closeTabs(stashable.map(t => t.id).filter((id): id is number => id !== undefined))
  return bin.id
}

export async function renameStashedTab(id: string, name: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const updated = tabs.map(t => (t.id === id ? { ...t, name } : t))
  await saveStashedTabs(updated)
  return updated
}

export async function deleteStashedTab(id: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const updated = tabs.filter(t => t.id !== id)
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

  rest.splice(idx, 0, moved)
  await saveStashedTabs(rest)
  return rest
}

// Move a tab into a bin (or to root when binId is null), placed at the end.
export async function moveTabToBin(tabId: string, binId: string | null): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const dragged = tabs.find(t => t.id === tabId)
  if (!dragged || dragged.binId === binId) return tabs

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
  return bin
}

export async function renameBin(id: string, name: string): Promise<Bin[]> {
  const bins = await getBins()
  const updated = bins.map(b => (b.id === id ? { ...b, name } : b))
  await saveBins(updated)
  return updated
}

// Delete a bin, moving its child bins and tabs up to its parent (no data loss).
export async function deleteBin(id: string): Promise<void> {
  const bins = await getBins()
  const tabs = await getStashedTabs()
  const target = bins.find(b => b.id === id)
  const newParent = target ? target.parentId : null

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
  let cursor = newParentId
  while (cursor) {
    if (cursor === binId) return bins // newParent is a descendant → would cycle
    cursor = byId.get(cursor)?.parentId ?? null
  }

  const updated = bins.map(b => (b.id === binId ? { ...b, parentId: newParentId } : b))
  await saveBins(updated)
  return updated
}
