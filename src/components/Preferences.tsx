import { useEffect, useRef, useState } from 'react'
import { THEMES, type Theme } from '../themes'
import { DEFAULT_HOTKEYS, type Hotkeys } from '../types'
import { captureKey, displayKey } from '../utils'

const HOTKEY_LABELS: { key: keyof Hotkeys; label: string }[] = [
  { key: 'stash',        label: 'Stash tab' },
  { key: 'stashAll',     label: 'Stash all tabs' },
  { key: 'newBin',       label: 'New bin' },
  { key: 'open',         label: 'Open tab(s)' },
  { key: 'editName',     label: 'Edit tab name' },
  { key: 'delete',       label: 'Delete' },
  { key: 'openFullView', label: 'Open full view' },
  { key: 'undo',         label: 'Undo' },
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

  return (
    <div className="prefs-view">
      <header className="prefs-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="prefs-title">Preferences</span>
      </header>

      <div className="prefs-content">

        <div className="prefs-section">
          <div className="prefs-section-label">Extension Shortcut</div>
          <button className="shortcut-btn" onClick={copyShortcutUrl}>
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
              <path d="M8.5 2H13v4.5M13 2l-6 6M6 3H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9"
                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {shortcutCopied ? '✓ Copied — paste in your address bar' : 'Set Extension Shortcut'}
          </button>
          <p className="shortcut-hint">
            Paste <code>chrome://extensions/shortcuts</code> in your address bar to bind a key to open UTM.
          </p>
        </div>

        <div className="prefs-section">
          <div className="prefs-section-label-row">
            <div className="prefs-section-label">Hotkeys</div>
            <button className="reset-btn" onClick={() => onHotkeysChange({ ...DEFAULT_HOTKEYS })}>
              Reset to defaults
            </button>
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
                  {[theme.bg, theme.surface2, theme.accent, theme.text1].map((c, i) => (
                    <div key={i} className="swatch-dot" style={{ background: c }} />
                  ))}
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
