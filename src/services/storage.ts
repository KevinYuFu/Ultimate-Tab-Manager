import type { Tab } from '../types'

const TABS_KEY = 'tabs'

export async function getStashedTabs(): Promise<Tab[]> {
  const result = await chrome.storage.local.get(TABS_KEY)
  return (result[TABS_KEY] as Tab[] | undefined) ?? []
}

export async function saveStashedTabs(tabs: Tab[]): Promise<void> {
  await chrome.storage.local.set({ [TABS_KEY]: tabs })
}
