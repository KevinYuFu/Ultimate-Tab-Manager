import { ArrowLeft, Check, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { THEMES, type Theme } from '../themes'
import { DEFAULT_KEYBINDINGS, type Keybindings, type Operation } from '../types'
import { captureKey, displayKey } from '../utils'

const OPERATION_LABELS: { op: Operation; label: string }[] = [
  { op: 'stash',        label: 'Stash tab' },
  { op: 'stashAll',     label: 'Stash all tabs' },
  { op: 'newBin',       label: 'New bin' },
  { op: 'open',         label: 'Open tab(s)' },
  { op: 'goBack',       label: 'Go back a scope' },
  { op: 'editName',     label: 'Edit tab name' },
  { op: 'delete',       label: 'Delete' },
  { op: 'openFullView', label: 'Open full view' },
  { op: 'undo',         label: 'Undo' },
  { op: 'redo',         label: 'Redo' },
]

type Props = {
  currentThemeId: string
  onThemeChange: (theme: Theme) => void
  keybindings: Keybindings
  onKeybindingsChange: (keybindings: Keybindings) => void
  stashAllOpensFullView: boolean
  onStashAllOpensFullViewChange: (value: boolean) => void
  onBack: () => void
}

export default function Preferences({
  currentThemeId,
  onThemeChange,
  keybindings,
  onKeybindingsChange,
  stashAllOpensFullView,
  onStashAllOpensFullViewChange,
  onBack,
}: Props) {
  const [editingOp, setEditingOp] = useState<Operation | null>(null)
  const editingRef = useRef<Operation | null>(null)
  editingRef.current = editingOp

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingRef.current) return
      e.preventDefault()
      const captured = captureKey(e)
      if (!captured) return
      onKeybindingsChange({ ...keybindings, [editingRef.current]: captured })
      setEditingOp(null)
    }
    const handleClickOutside = () => {
      if (editingRef.current) setEditingOp(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [keybindings, onKeybindingsChange])

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
          <div className="prefs-section-label">Behaviour</div>
          <div className="setting-row">
            <div className="setting-text">
              <span className="setting-label">Display Manager After Stash All</span>
              <span className="setting-desc">Open the full-screen manager in a new tab when you stash all tabs.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={stashAllOpensFullView}
              aria-label="Display Manager After Stash All"
              className={`switch${stashAllOpensFullView ? ' on' : ''}`}
              onClick={() => onStashAllOpensFullViewChange(!stashAllOpensFullView)}
            >
              <span className="switch-knob" />
            </button>
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

        <div className="prefs-section">
          <div className="prefs-section-label-row">
            <div className="prefs-section-label">Hotkeys</div>
            <button className="reset-btn" onClick={() => onKeybindingsChange({ ...DEFAULT_KEYBINDINGS })}>
              Reset to defaults
            </button>
          </div>
          <div className="hotkey-editor-list">
            {OPERATION_LABELS.map(({ op, label }) => (
              <div key={op} className="hotkey-editor-row">
                <span className="hotkey-editor-label">{label}</span>
                <button
                  className={`hotkey-editor-key${editingOp === op ? ' listening' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingOp(prev => prev === op ? null : op)
                  }}
                >
                  {editingOp === op ? '…' : displayKey(keybindings[op])}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
