// Local smoke test for the REAL AI sort call (not a mock). Validates that the
// provider's request/response shape actually works against Anthropic.
//
//   1. cp .env.example .env   and put your key in VITE_ANTHROPIC_API_KEY
//   2. npm run test:ai
//
// Your key is read from .env (gitignored) — it never touches source or git.
// The provider reads import.meta.env.VITE_ANTHROPIC_API_KEY; the npm script maps
// that to process.env when bundling for node, so the real code runs unchanged.

import type { Bin, Tab } from '../src/types'
import { sortIntoExistingBins } from '../src/services/aiSort'

const bins: Bin[] = [
  { id: 'b-work', name: 'Work', parentId: null },
  { id: 'b-recipes', name: 'Recipes', parentId: null },
  { id: 'b-ml', name: 'ML Papers', parentId: null },
]

const tab = (id: string, name: string, url: string): Tab =>
  ({ id, name, url, favicon: '', dateAdded: Date.now(), binId: null })

const tabs: Tab[] = [
  tab('t1', 'Attention Is All You Need', 'https://arxiv.org/abs/1706.03762'),
  tab('t2', 'Best pasta carbonara recipe', 'https://www.seriouseats.com/carbonara'),
  tab('t3', 'Q3 board deck — final', 'https://docs.google.com/presentation/xyz'),
  tab('t4', 'How to repot a monstera', 'https://www.thespruce.com/monstera'),
]

async function main() {
  if (!process.env.VITE_ANTHROPIC_API_KEY) {
    console.error('No VITE_ANTHROPIC_API_KEY — copy .env.example to .env and add your key.')
    process.exit(1)
  }
  console.log('Calling the real AI sorter…\n')
  const { placements, leftovers } = await sortIntoExistingBins(tabs, bins)

  const binName = (id: string) => bins.find(b => b.id === id)?.name ?? id
  for (const p of placements) console.log(`  ${p.tab.name}  →  ${binName(p.binId)}`)
  for (const t of leftovers) console.log(`  ${t.name}  →  (leftover / no fit)`)

  console.log(`\n${placements.length} placed, ${leftovers.length} leftover.`)
  console.log(
    leftovers.length === tabs.length
      ? '\n⚠️  Everything fell through — likely an API/key error (this is the graceful fallback).'
      : '\n✅ The real provider call works.',
  )
}
main()
