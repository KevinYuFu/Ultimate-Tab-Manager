const HOTKEYS = [
  { key: 'S', action: 'Stash current tab' },
  { key: 'A', action: 'Stash all tabs' },
  { key: 'M', action: 'Open full view' },
  { key: 'B', action: 'New bin' },
  { key: 'E', action: 'Edit tab name' },
  { key: '⌫', action: 'Delete' },
  { key: '↵', action: 'Open tab(s)' },
  { key: '⌃Z', action: 'Undo' },
  { key: '1–9', action: 'Quick select' },
]

type Props = {
  onOpenPreferences: () => void
}

export default function Navigator({ onOpenPreferences }: Props) {
  return (
    <div>
      <div className="nav-header">
        <span className="nav-title">Ultimate Tab Manager</span>
        <button className="prefs-btn" onClick={onOpenPreferences} title="Preferences">
          ⚙
        </button>
      </div>
      <div className="hotkey-list">
        {HOTKEYS.map(({ key, action }) => (
          <div key={key} className="hotkey-row">
            <kbd className="hotkey-key">{key}</kbd>
            <span className="hotkey-action">{action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
