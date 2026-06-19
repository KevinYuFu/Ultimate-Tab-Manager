// Higher-level operations that compose the tabs + storage + naming services.
// Components call these; they never touch the chrome APIs directly.

import type { Tab } from '../types'
import { getStashedTabs, saveStashedTabs } from './storage'
import { closeTab, getActiveTab, openUrl } from './tabs'
import { smartName } from './smartName'

export async function listStashedTabs(): Promise<Tab[]> {
  return getStashedTabs()
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

export async function deleteStashedTab(id: string): Promise<Tab[]> {
  const tabs = await getStashedTabs()
  const updated = tabs.filter(t => t.id !== id)
  await saveStashedTabs(updated)
  return updated
}
