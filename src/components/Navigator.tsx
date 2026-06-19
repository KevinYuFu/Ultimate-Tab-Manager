import { Layers, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    listStashedTabs().then(setTabs)
  }, [])

  const handleStash = async () => setTabs(await stashActiveTab())
  const handleDelete = async (id: string) => setTabs(await deleteStashedTab(id))
  const handleOpen = (tab: Tab) => openStashedTab(tab)

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
              <TabRow key={tab.id} tab={tab} onOpen={handleOpen} onDelete={handleDelete} />
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
