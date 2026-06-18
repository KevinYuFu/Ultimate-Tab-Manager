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
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M12.36 2.64l-1.06 1.06M3.7 11.3l-1.06 1.06M12.36 12.36l-1.06-1.06M3.7 3.7 2.64 2.64" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="navigator-area">
        <div className="empty-state">
          <svg className="empty-icon" width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="3" y="10" width="30" height="20" rx="3" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="7" y="6" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="11" y="2" width="14" height="20" rx="3" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
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
