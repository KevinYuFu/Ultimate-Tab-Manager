// AI sorting: place tabs into the user's EXISTING bins by topic. Tabs that
// don't clearly fit any bin come back as "leftovers" for the default stash
// logic to handle. This never creates bins.
//
// Every failure path — no key, no bins, network error, malformed response — is
// swallowed into "everything is a leftover", so a stash can never break or lose
// a tab because of the AI.

import type { Bin, Tab } from '../types'
import { requestSort, type SortAssignment, type SortRequest } from './aiProvider'

export type Placement = { tab: Tab; binId: string }
export type SortResult = { placements: Placement[]; leftovers: Tab[] }

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
  // No bins → nothing to sort into; skip the call entirely (saves cost).
  if (tabs.length === 0 || bins.length === 0) {
    return { placements: [], leftovers: tabs }
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
    return { placements, leftovers }
  } catch {
    return { placements: [], leftovers: tabs }
  }
}
