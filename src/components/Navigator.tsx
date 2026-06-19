import { Layers, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Keybindings, Operation, Tab } from '../types'
import { displayKey } from '../utils'
import {
  deleteStashedTab,
  listStashedTabs,
  openStashedTab,
  stashActiveTab,
} from '../services/operations'
import TabRow from './TabRow'

const PRIMARY: { op: Operation; label: string }[] = [
  { op: 'stash',        label: 'Stash' },
  { op: 'stashAll',     label: 'Stash All' },
]

const SECONDARY: { op: Operation; label: string }[] = [
  { op: 'newBin',       label: 'New Bin' },
  { op: 'openFullView', label: 'Full View' },
  { op: 'editName',     label: 'Edit Name' },
  { op: 'delete',       label: 'Delete' },
  { op: 'open',         label: 'Open' },
  { op: 'undo',         label: 'Undo' },
]

type Props = {
  keybindings: Keybindings
  onOpenPreferences: () => void
}

export default function Navigator({ keybindings, onOpenPreferences }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const anchorRef = useRef<string | null>(null)

  useEffect(() => {
    listStashedTabs().then(setTabs)
  }, [])

  // Enter opens every selected tab.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedIds.size > 0) {
        e.preventDefault()
        tabs.filter(t => selectedIds.has(t.id)).forEach(openStashedTab)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, tabs])

  const handleStash = async () => setTabs(await stashActiveTab())

  const handleDelete = async (id: string) => {
    setTabs(await deleteStashedTab(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleOpen = (tab: Tab) => openStashedTab(tab)

  const handleSelect = (tab: Tab, e: React.MouseEvent) => {
    const id = tab.id

    // Shift: range-select from the anchor to the clicked tab.
    if (e.shiftKey && anchorRef.current) {
      const anchorIdx = tabs.findIndex(t => t.id === anchorRef.current)
      const clickedIdx = tabs.findIndex(t => t.id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedIds(new Set(tabs.slice(lo, hi + 1).map(t => t.id)))
        return
      }
    }

    // Cmd/Ctrl: toggle the clicked tab in the selection.
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

    // Plain click: select only this tab.
    setSelectedIds(new Set([id]))
    anchorRef.current = id
  }

  // Only 'stash' is wired in P1. Others land with their features (P2+).
  const handlers: Partial<Record<Operation, () => void>> = { stash: handleStash }

  return (
    <div className="nav-view">

      <header className="nav-header">
        <span className="nav-logo">UTM</span>
        <div className="nav-header-right">
          {PRIMARY.map(({ op, label }) => (
            <button
              key={op}
              className="header-action-btn"
              onClick={handlers[op]}
              disabled={!handlers[op]}
            >
              <kbd className="btn-kbd">{displayKey(keybindings[op])}</kbd>
              <span>{label}</span>
            </button>
          ))}
          <div className="header-divider" />
          <button className="icon-btn" onClick={onOpenPreferences} title="Preferences">
            <Settings size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="navigator-area">
        {tabs.length === 0 ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No stashed tabs</p>
            <p className="empty-hint">Stash a tab to get started</p>
          </div>
        ) : (
          <div className="tab-list">
            {tabs.map(tab => (
              <TabRow
                key={tab.id}
                tab={tab}
                selected={selectedIds.has(tab.id)}
                onSelect={handleSelect}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <div className="action-bar">
        {SECONDARY.map(({ op, label }) => (
          <button key={op} className="action-btn">
            <kbd className="btn-kbd">{displayKey(keybindings[op])}</kbd>
            <span>{label}</span>
          </button>
        ))}
        <button className="action-btn">
          <kbd className="btn-kbd">1–9</kbd>
          <span>Quick Select</span>
        </button>
      </div>

      <div className="status-bar">
        <span className="status-item"><kbd className="status-kbd">↑↓</kbd>navigate</span>
        <span className="status-item"><kbd className="status-kbd">↵</kbd>open</span>
        <span className="status-item"><kbd className="status-kbd">⌫</kbd>delete</span>
        <span className="status-item"><kbd className="status-kbd">Esc</kbd>close</span>
      </div>

    </div>
  )
}
