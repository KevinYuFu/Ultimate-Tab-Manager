// Thin wrappers around the chrome.tabs API. No UI or storage concerns.

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

export async function getTabsInCurrentWindow(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true })
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId)
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length) await chrome.tabs.remove(tabIds)
}

export async function openUrl(url: string): Promise<void> {
  await chrome.tabs.create({ url })
}

// Open one of the extension's own pages (e.g. the popup) in a full browser tab.
export async function openExtensionPage(page: string): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL(page) })
}
