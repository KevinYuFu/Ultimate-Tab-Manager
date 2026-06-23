import { useRef, useState, type MouseEvent } from 'react'
import type { Tab } from '../types'

// Selection model for the navigator: tabs support multi-select (click,
// Cmd/Ctrl to toggle, Shift to range-select); bins are selected one at a time,
// separately from the tabs. Selecting one kind clears the other.
export function useSelection(tabs: Tab[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const anchorRef = useRef<string | null>(null) // range-select anchor

  const clear = () => {
    setSelectedIds(new Set())
    setSelectedBinId(null)
    anchorRef.current = null
  }

  const selectTab = (tab: Tab, e: MouseEvent) => {
    e.stopPropagation() // don't let it reach the background clear handler
    setSelectedBinId(null) // selecting a tab clears any bin selection
    const id = tab.id

    if (e.shiftKey && anchorRef.current) {
      const anchorIdx = tabs.findIndex(t => t.id === anchorRef.current)
      const clickedIdx = tabs.findIndex(t => t.id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedIds(new Set(tabs.slice(lo, hi + 1).map(t => t.id)))
        return
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      anchorRef.current = id
      return
    }

    setSelectedIds(new Set([id]))
    anchorRef.current = id
  }

  // Single bin selection (clears the tab selection).
  const selectBin = (id: string) => {
    setSelectedBinId(id)
    setSelectedIds(new Set())
    anchorRef.current = null
  }

  const deselectTab = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return { selectedIds, selectedBinId, clear, selectTab, selectBin, deselectTab }
}
