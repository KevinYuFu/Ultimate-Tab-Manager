// In-memory stand-ins for the chrome APIs + fetch, so service/logic tests run in
// Node with no browser. installChromeMock() puts a fake `chrome` and `fetch` on
// globalThis and returns a mutable control object: seed state on it before the
// call, inspect it after.

import type { SortAssignment } from '../services/aiProvider'

export type ChromeMock = {
  /** Backing store for chrome.storage.local, keyed like the real one ('tabs', 'bins', …). */
  store: Record<string, unknown>
  /** Tabs returned by getTabsInCurrentWindow(). */
  openTabs: Partial<chrome.tabs.Tab>[]
  /** Tab returned by getActiveTab(). */
  activeTab: Partial<chrome.tabs.Tab> | null
  /** Ids passed to chrome.tabs.remove(), in call order. */
  closed: number[]
  /** How many times fetch was called (assert we did / didn't hit the AI). */
  fetchCalls: number
  /** What fetch resolves to — swap per test to script the AI response or an error. */
  fetchImpl: () => Promise<unknown>
}

export function installChromeMock(): ChromeMock {
  const m: ChromeMock = {
    store: {},
    openTabs: [],
    activeTab: null,
    closed: [],
    fetchCalls: 0,
    fetchImpl: async () => ({ ok: false, status: 500 }),
  }

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: m.store[key] }),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(m.store, obj)
        },
      },
    },
    tabs: {
      // active:true → the single active tab (getActiveTab); else the window's tabs.
      query: async (q: { active?: boolean }) =>
        q?.active ? (m.activeTab ? [m.activeTab] : []) : m.openTabs,
      remove: async (ids: number | number[]) => {
        for (const id of Array.isArray(ids) ? ids : [ids]) m.closed.push(id)
      },
      create: async () => ({}),
    },
    runtime: {
      sendMessage: async () => ({}),
      getURL: (p: string) => p,
    },
  }
  ;(globalThis as { fetch?: unknown }).fetch = async () => {
    m.fetchCalls++
    return m.fetchImpl()
  }

  return m
}

// Canned Anthropic tool_use reply for a set of assignments — assign to
// `mock.fetchImpl` to script a successful AI sort.
export function aiResponse(assignments: SortAssignment[]) {
  return async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'tool_use', input: { assignments } }] }),
  })
}
