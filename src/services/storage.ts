import type { Bin, History, Tab } from '../types'

const TABS_KEY = 'tabs'
const BINS_KEY = 'bins'
const HISTORY_KEY = 'history'

export async function getStashedTabs(): Promise<Tab[]> {
  const result = await chrome.storage.local.get(TABS_KEY)
  return (result[TABS_KEY] as Tab[] | undefined) ?? []
}

export async function saveStashedTabs(tabs: Tab[]): Promise<void> {
  await chrome.storage.local.set({ [TABS_KEY]: tabs })
}

export async function getBins(): Promise<Bin[]> {
  const result = await chrome.storage.local.get(BINS_KEY)
  return (result[BINS_KEY] as Bin[] | undefined) ?? []
}

export async function saveBins(bins: Bin[]): Promise<void> {
  await chrome.storage.local.set({ [BINS_KEY]: bins })
}

export async function getHistory(): Promise<History> {
  const result = await chrome.storage.local.get(HISTORY_KEY)
  return (result[HISTORY_KEY] as History | undefined) ?? { commands: [], cursor: 0 }
}

export async function saveHistory(history: History): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: history })
}
