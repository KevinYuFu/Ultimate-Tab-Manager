import { useEffect, useRef, useState } from 'react'
import { THEMES, type Theme } from '../themes'
import { DEFAULT_HOTKEYS, type Hotkeys } from '../types'
import { captureKey, displayKey } from '../utils'

const HOTKEY_LABELS: { key: keyof Hotkeys; label: string }[] = [
  { key: 'stash', label: 'Stash tab' },
  { key: 'stashAll', label: 'Stash all tabs' },
  { key: 'openFullView', label: 'Open full view' },
  { key: 'newBin', label: 'New bin' },
  { key: 'editName', label: 'Edit tab name' },
  { key: 'delete', label: 'Delete' },
  { key: 'open', label: 'Open tab(s)' },
  { key: 'undo', label: 'Undo' },
]

type Props = {
  currentThemeId: string
  onThemeChange: (theme: Theme) => void
  hotkeys: Hotkeys
  onHotkeysChange: (hotkeys: Hotkeys) => void
  onBack: () => void
}

export default function Preferences({
  currentThemeId,
  onThemeChange,
  hotkeys,
  onHotkeysChange,
  onBack,
}: Props) {
  const [editingKey, setEditingKey] = useState<keyof Hotkeys | null>(null)
  const [shortcutCopied, setShortcutCopied] = useState(false)
  const editingRef = useRef<keyof Hotkeys | null>(null)
  editingRef.current = editingKey

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingRef.current) return
      e.preventDefault()
      const captured = captureKey(e)
      if (!captured) return
      onHotkeysChange({ ...hotkeys, [editingRef.current]: captured })
      setEditingKey(null)
    }

    const handleClickOutside = () => {
      if (editingRef.current) setEditingKey(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [hotkeys, onHotkeysChange])

  const copyShortcutUrl = () => {
    navigator.clipboard.writeText('chrome://extensions/shortcuts')
    setShortcutCopied(true)
    setTimeout(() => setShortcutCopied(false), 2500)
  }

  const resetHotkeys = () => {
    onHotkeysChange({ ...DEFAULT_HOTKEYS })
    setEditingKey(null)
  }

  return (
    <div className="prefs-view">
      <div className="prefs-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="prefs-title">Preferences</span>
      </div>

      <div className="prefs-content">

        {/* Extension Shortcut */}
        <div className="prefs-section">
          <div className="prefs-section-label">Extension Shortcut</div>
          <button className="shortcut-btn" onClick={copyShortcutUrl}>
            {shortcutCopied ? '✓ Copied — paste in address bar' : 'Set Extension Shortcut'}
          </button>
          <p className="shortcut-hint">
            Opens <code>chrome://extensions/shortcuts</code> where you can bind a key to open this extension.
          </p>
        </div>

        {/* Hotkeys */}
        <div className="prefs-section">
          <div className="prefs-section-label-row">
            <div className="prefs-section-label">Hotkeys</div>
            <button className="reset-btn" onClick={resetHotkeys}>Reset</button>
          </div>
          <div className="hotkey-editor-list">
            {HOTKEY_LABELS.map(({ key, label }) => (
              <div key={key} className="hotkey-editor-row">
                <span className="hotkey-editor-label">{label}</span>
                <button
                  className={`hotkey-editor-key${editingKey === key ? ' listening' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingKey(prev => prev === key ? null : key)
                  }}
                >
                  {editingKey === key ? '…' : displayKey(hotkeys[key])}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="prefs-section">
          <div className="prefs-section-label">Theme</div>
          <div className="theme-list">
            {THEMES.map(theme => (
              <div
                key={theme.id}
                className={`theme-option${currentThemeId === theme.id ? ' selected' : ''}`}
                onClick={() => onThemeChange(theme)}
              >
                <div className="theme-swatch">
                  <div className="swatch-dot" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }} />
                  <div className="swatch-dot" style={{ backgroundColor: theme.surface }} />
                  <div className="swatch-dot" style={{ backgroundColor: theme.accent }} />
                  <div className="swatch-dot" style={{ backgroundColor: theme.text }} />
                </div>
                <span className="theme-name">{theme.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
