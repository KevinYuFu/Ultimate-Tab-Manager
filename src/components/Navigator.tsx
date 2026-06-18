import { Layers, Settings } from 'lucide-react'
import type { Hotkeys } from '../types'
import { displayKey } from '../utils'

const PRIMARY: { key: keyof Hotkeys; label: string }[] = [
  { key: 'stash',        label: 'Stash' },
  { key: 'stashAll',     label: 'Stash All' },
]

const SECONDARY: { key: keyof Hotkeys; label: string }[] = [
  { key: 'newBin',       label: 'New Bin' },
  { key: 'openFullView', label: 'Full View' },
  { key: 'editName',     label: 'Edit Name' },
  { key: 'delete',       label: 'Delete' },
  { key: 'open',         label: 'Open' },
  { key: 'undo',         label: 'Undo' },
]

type Props = {
  hotkeys: Hotkeys
  onOpenPreferences: () => void
}

export default function Navigator({ hotkeys, onOpenPreferences }: Props) {
  return (
    <div className="nav-view">

      <header className="nav-header">
        <span className="nav-logo">UTM</span>
        <div className="nav-header-right">
          {PRIMARY.map(({ key, label }) => (
            <button key={key} className="header-action-btn">
              <kbd className="btn-kbd">{displayKey(hotkeys[key])}</kbd>
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
        <div className="empty-state">
          <Layers size={36} className="empty-icon" strokeWidth={1.25} />
          <p className="empty-title">No stashed tabs</p>
          <p className="empty-hint">Stash a tab to get started</p>
        </div>
      </div>

      <div className="action-bar">
        {SECONDARY.map(({ key, label }) => (
          <button key={key} className="action-btn">
            <kbd className="btn-kbd">{displayKey(hotkeys[key])}</kbd>
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
