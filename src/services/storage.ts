import type { Bin, Tab } from '../types'

const TABS_KEY = 'tabs'
const BINS_KEY = 'bins'

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
