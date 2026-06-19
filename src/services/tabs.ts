// Thin wrappers around the chrome.tabs API. No UI or storage concerns.

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId)
}

export async function openUrl(url: string): Promise<void> {
  await chrome.tabs.create({ url })
}
