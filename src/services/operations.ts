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
  openExtensionPage,
  openUrl,
} from './tabs'
import { smartName } from './smartName'
import { isAiSortEnabled, sortIntoExistingBins } from './aiSort'
import { hasPremium } from './premium'

// Name for the catch-all bin new stashes land in: the current date/time.
function dateBinName(): string {
  return new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
    // With AI on, park it at root flagged for sorting; aiSortPendingTabs moves
    // it into a bin afterwards (so the stash itself stays instant).
    ...((await isAiSortEnabled()) ? { needsSort: true } : {}),
  }

  const updated = [tab, ...existing]
  await saveStashedTabs(updated)
  if (active.id !== undefined) await closeTab(active.id)
  return updated
}

// Sort any tabs still flagged `needsSort` into existing bins — one batched call
// for all of them. Called when the manager opens and after a single stash; safe
// to call repeatedly (coalesced, and a no-op when nothing is pending). Flags are
// cleared only when the AI call actually succeeds, so a cancelled or errored run
// leaves them pending for a later retry — that's what makes it self-healing.
let sorting: Promise<void> | null = null
export function aiSortPendingTabs(): Promise<void> {
  if (!sorting) {
    sorting = doAiSortPendingTabs().finally(() => {
      sorting = null
    })
  }
  return sorting
}

async function doAiSortPendingTabs(): Promise<void> {
  const tabs = await getStashedTabs()
  const pending = tabs.filter(t => t.needsSort)
  if (pending.length === 0) return

  const bins = await getBins()
  if (bins.length === 0) {
    // Nothing to sort into — resolve in place (clear the flag; they stay at root).
    await saveStashedTabs(tabs.map(t => (t.needsSort ? { ...t, needsSort: false } : t)))
    return
  }

  const { placements, succeeded } = await sortIntoExistingBins(pending, bins)
  if (!succeeded) return // AI call errored — leave the flags set to retry later.

  const binOf = new Map(placements.map(p => [p.tab.id, p.binId]))
  await saveStashedTabs(
    tabs.map(t =>
      t.needsSort ? { ...t, binId: binOf.get(t.id) ?? t.binId, needsSort: false } : t,
    ),
  )
}

// Sort one bin's tabs into the OTHER bins by topic (AI, on demand). Tabs that
// best fit a different bin move there; tabs that fit none stay in this bin. The
// bin being sorted is excluded as a target, so "leftovers stay put" is automatic.
// Premium-gated and fully graceful: no premium, no other bins, or an AI error
// leaves every tab exactly where it was. Returns the updated tab list.
export async function sortBin(binId: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  if (!hasPremium()) return tabs

  const inBin = tabs.filter(t => t.binId === binId)
  const others = (await getBins()).filter(b => b.id !== binId)
  if (inBin.length === 0 || others.length === 0) return tabs

  const { placements, succeeded } = await sortIntoExistingBins(inBin, others)
  if (!succeeded) return tabs // AI errored — leave the bin untouched.

  const binOf = new Map(placements.map(p => [p.tab.id, p.binId]))
  const updated = tabs.map(t => (binOf.has(t.id) ? { ...t, binId: binOf.get(t.id)! } : t))
  await saveStashedTabs(updated)
  return updated
}

export async function openStashedTab(tab: Tab): Promise<void> {
  await openUrl(tab.url)
}

// Open the tab manager in its own full browser tab (more room for organizing).
// With { stashOnOpen }, the opened tab runs Stash All on load (see Navigator).
// Stash All closes tabs, which can tear the popup down mid-operation, so we do
// it from the Full View tab — a stable context — instead of the popup.
export async function openFullView(options?: { stashOnOpen?: boolean }): Promise<void> {
  const query = options?.stashOnOpen ? 'view=full&stashOnOpen=1' : 'view=full'
  await openExtensionPage(`popup.html?${query}`)
}

// Stash every normal (http/https) tab in the current window, then close them.
// With AI sorting on, tabs that fit an existing bin go there; the rest fall into
// a new date-named bin (the default). Returns the date bin's id if one was
// created (so the caller can expand it), else null. chrome:// pages are skipped.
export async function stashAllTabs(): Promise<string | null> {
  const open = await getTabsInCurrentWindow()
  // Skip pinned tabs: a pinned tab is a deliberate "keep this open" signal.
  const stashable = open.filter(t => t.url && !t.pinned && /^https?:/i.test(t.url))
  if (stashable.length === 0) return null

  const bins = await getBins()
  const existing = await getStashedTabs()
  const now = Date.now()

  const built: Tab[] = stashable.map(t => ({
    id: crypto.randomUUID(),
    url: t.url!,
    name: smartName(t.title, t.url!),
    favicon: t.favIconUrl ?? '',
    dateAdded: now,
    binId: null,
  }))

  // AI pre-pass: place what fits into existing bins; the rest are leftovers.
  let placed: Tab[] = []
  let leftovers = built
  if ((await isAiSortEnabled()) && bins.length > 0) {
    const result = await sortIntoExistingBins(built, bins)
    placed = result.placements.map(p => ({ ...p.tab, binId: p.binId }))
    leftovers = result.leftovers
  }

  // Leftovers go into a fresh date bin — created only if there are any.
  const newBins: Bin[] = []
  let dateBinId: string | null = null
  if (leftovers.length > 0) {
    const dateBin: Bin = { id: crypto.randomUUID(), name: dateBinName(), parentId: null }
    newBins.push(dateBin)
    dateBinId = dateBin.id
    leftovers = leftovers.map(t => ({ ...t, binId: dateBin.id }))
  }

  await saveBins([...newBins, ...bins])
  await saveStashedTabs([...placed, ...leftovers, ...existing])
  await closeTabs(stashable.map(t => t.id).filter((id): id is number => id !== undefined))
  return dateBinId
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

// Delete several tabs in one write (a per-id loop would race on the shared list).
export async function deleteStashedTabs(ids: string[]): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const remove = new Set(ids)
  const updated = tabs.filter(t => !remove.has(t.id))
  await saveStashedTabs(updated)
  return updated
}

// Reorder one or more tabs next to a sibling, adopting that sibling's bin (so
// dropping among a bin's tabs also moves them into that bin). The dragged tabs
// keep their current relative order and land contiguously. Returns the new order.
export async function reorderTabs(
  draggedIds: string[],
  targetId: string,
  placeAfter: boolean,
): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const set = new Set(draggedIds)
  if (set.has(targetId)) return tabs // can't drop a selection onto one of its own
  const target = tabs.find(t => t.id === targetId)
  if (!target) return tabs

  const moving = tabs.filter(t => set.has(t.id)).map(t => ({ ...t, binId: target.binId }))
  if (moving.length === 0) return tabs
  const rest = tabs.filter(t => !set.has(t.id))
  let idx = rest.findIndex(t => t.id === targetId)
  if (idx === -1) return tabs
  if (placeAfter) idx += 1

  rest.splice(idx, 0, ...moving)
  await saveStashedTabs(rest)
  return rest
}

// Move one or more tabs into a bin (or to root when binId is null), placed at
// the end in their current relative order.
export async function moveTabsToBin(tabIds: string[], binId: string | null): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const set = new Set(tabIds)
  const moving = tabs.filter(t => set.has(t.id))
  if (moving.length === 0) return tabs

  const rest = tabs.filter(t => !set.has(t.id))
  const updated = [...rest, ...moving.map(t => ({ ...t, binId }))]
  await saveStashedTabs(updated)
  return updated
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
  const index = bins.findIndex(b => b.id === id)
  if (index === -1) return
  const target = bins[index]
  const newParent = target.parentId

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
  const target = byId.get(binId)
  if (!target || target.parentId === newParentId) return bins
  let cursor = newParentId
  while (cursor) {
    if (cursor === binId) return bins // newParent is a descendant → would cycle
    cursor = byId.get(cursor)?.parentId ?? null
  }

  const updated = bins.map(b => (b.id === binId ? { ...b, parentId: newParentId } : b))
  await saveBins(updated)
  return updated
}
