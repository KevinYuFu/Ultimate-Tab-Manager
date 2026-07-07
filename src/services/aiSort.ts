// AI sorting: place tabs into the user's EXISTING bins by topic. Tabs that
// don't clearly fit any bin come back as "leftovers" for the default stash
// logic to handle. This never creates bins.
//
// Every failure path — no key, no bins, network error, malformed response — is
// swallowed into "everything is a leftover", so a stash can never break or lose
// a tab because of the AI.

import type { Bin, Tab } from '../types'
import { hasPremium } from './premium'
import { requestSort, type SortAssignment, type SortRequest } from './aiProvider'

export type Placement = { tab: Tab; binId: string }
// `ok` is false only when the AI call itself errored (network/malformed/no key).
// It's true when the call succeeded — including when nothing matched. Callers
// that retry (resolvePendingSorts) use it to keep the pending flag on error.
export type SortResult = { placements: Placement[]; leftovers: Tab[]; ok: boolean }

// AI sorting runs only when it's a premium entitlement AND the user turned it on.
export async function isAiSortEnabled(): Promise<boolean> {
  if (!hasPremium()) return false
  const { aiSortOnStash } = await chrome.storage.local.get('aiSortOnStash')
  return aiSortOnStash === true
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// `sort` is injectable so tests can supply a fake provider; production uses the
// real Anthropic call.
export async function sortIntoExistingBins(
  tabs: Tab[],
  bins: Bin[],
  sort: (req: SortRequest) => Promise<SortAssignment[]> = requestSort,
): Promise<SortResult> {
  // No bins → nothing to sort into; skip the call entirely (saves cost). Not an
  // error, so ok: true.
  if (tabs.length === 0 || bins.length === 0) {
    return { placements: [], leftovers: tabs, ok: true }
  }

  try {
    const req: SortRequest = {
      tabs: tabs.map((t, i) => ({ index: i, name: t.name, host: host(t.url) })),
      bins: bins.map((b, i) => ({ index: i, name: b.name })),
    }
    const assignments = await sort(req)

    // tab index → bin id, keeping only in-range assignments (guards against a
    // model returning a bin/tab index that doesn't exist).
    const binOf = new Map<number, string>()
    for (const a of assignments) {
      if (a.tab >= 0 && a.tab < tabs.length && a.bin >= 0 && a.bin < bins.length) {
        binOf.set(a.tab, bins[a.bin].id)
      }
    }

    const placements: Placement[] = []
    const leftovers: Tab[] = []
    tabs.forEach((tab, i) => {
      const binId = binOf.get(i)
      if (binId) placements.push({ tab, binId })
      else leftovers.push(tab)
    })
    return { placements, leftovers, ok: true }
  } catch {
    return { placements: [], leftovers: tabs, ok: false }
  }
}
