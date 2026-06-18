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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
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
