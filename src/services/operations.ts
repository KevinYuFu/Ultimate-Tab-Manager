// Higher-level operations that compose the tabs + storage + naming services.
// Components call these; they never touch the chrome APIs directly.

import type { Bin, Tab } from '../types'
import {
  getBins,
  getStashedTabs,
  saveBins,
  saveStashedTabs,
} from './storage'
import { closeTab, getActiveTab, openUrl } from './tabs'
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

// Move a dragged tab to just before/after a target tab. Returns the new order.
export async function reorderTabs(
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  if (draggedId === targetId) return tabs
  const dragged = tabs.find(t => t.id === draggedId)
  if (!dragged) return tabs

  const rest = tabs.filter(t => t.id !== draggedId)
  let idx = rest.findIndex(t => t.id === targetId)
  if (idx === -1) return tabs
  if (placeAfter) idx += 1

  rest.splice(idx, 0, dragged)
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
