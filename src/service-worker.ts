// Background service worker: AI-sorts tabs left flagged `needsSort` from a
// stable context, so sorting happens even when the manager isn't open.
//
// Two triggers: browser startup (catch tabs left pending from a previous
// session) and a nudge from the manager after a single stash. The pending flag
// is the source of truth — if the worker is evicted mid-sort, the flag survives
// and the next trigger picks it up.

import { aiSortPendingTabs } from './services/operations'

chrome.runtime.onStartup.addListener(() => {
  void aiSortPendingTabs()
})

// Nudge from the manager after a stash. Return true + sendResponse so Chrome
// keeps the worker alive until the sort finishes, and the sender can refresh.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'AI_SORT_PENDING') return
  aiSortPendingTabs().finally(() => sendResponse({ done: true }))
  return true
})
