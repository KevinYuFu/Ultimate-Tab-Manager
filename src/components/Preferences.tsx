import { ArrowLeft, Check, ExternalLink } from 'lucide-react'
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

  const openShortcutsPage = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  }

  return (
    <div className="prefs-view">
      <header className="prefs-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={15} strokeWidth={1.75} /></button>
        <span className="prefs-title">Preferences</span>
      </header>

      <div className="prefs-content">

        <div className="prefs-section">
          <div className="prefs-section-label">Theme</div>
          <div className="theme-grid">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                className={`theme-card${currentThemeId === theme.id ? ' selected' : ''}`}
                onClick={() => onThemeChange(theme)}
                style={{ background: theme.bg, borderColor: currentThemeId === theme.id ? theme.accent : theme.borderMd }}
              >
                <div className="theme-card-preview">
                  <span className="theme-card-bar" style={{ background: theme.accent, width: '70%' }} />
                  <span className="theme-card-bar" style={{ background: theme.text2, width: '90%' }} />
                  <span className="theme-card-bar" style={{ background: theme.surface2, width: '50%' }} />
                </div>
                <div className="theme-card-footer">
                  <span className="theme-card-name" style={{ color: theme.text1 }}>{theme.name}</span>
                  {currentThemeId === theme.id && (
                    <span className="theme-card-check" style={{ background: theme.accent }}>
                      <Check size={9} strokeWidth={3} color={theme.bg} />
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
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
          <div className="prefs-section-label">Extension Shortcut</div>
          <button className="shortcut-btn" onClick={openShortcutsPage}>
            <ExternalLink size={13} strokeWidth={1.75} />
            Set Extension Shortcut
          </button>
          <p className="shortcut-hint">
            Opens <code>chrome://extensions/shortcuts</code> where you can bind a key to open UTM.
          </p>
        </div>

      </div>
    </div>
  )
}
