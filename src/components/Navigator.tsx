import type { Hotkeys } from '../types'
import { displayKey } from '../utils'

const HOTKEY_ITEMS: { key: keyof Hotkeys; action: string }[] = [
  { key: 'stash', action: 'Stash current tab' },
  { key: 'stashAll', action: 'Stash all tabs' },
  { key: 'openFullView', action: 'Open full view' },
  { key: 'newBin', action: 'New bin' },
  { key: 'editName', action: 'Edit tab name' },
  { key: 'delete', action: 'Delete' },
  { key: 'open', action: 'Open tab(s)' },
  { key: 'undo', action: 'Undo' },
]

type Props = {
  hotkeys: Hotkeys
  onOpenPreferences: () => void
}

export default function Navigator({ hotkeys, onOpenPreferences }: Props) {
  return (
    <div className="nav-view">
      <div className="nav-header">
        <span className="nav-title">Ultimate Tab Manager</span>
        <button className="prefs-btn" onClick={onOpenPreferences} title="Preferences">⚙</button>
      </div>

      <div className="navigator-area">
        {/* Navigator content goes here in P1+ */}
      </div>

      <div className="hotkey-bar">
        {HOTKEY_ITEMS.map(({ key, action }) => (
          <div key={key} className="hotkey-row">
            <kbd className="hotkey-key">{displayKey(hotkeys[key])}</kbd>
            <span className="hotkey-action">{action}</span>
          </div>
        ))}
        <div className="hotkey-row">
          <kbd className="hotkey-key">1–9</kbd>
          <span className="hotkey-action">Quick select</span>
        </div>
      </div>
    </div>
  )
}
