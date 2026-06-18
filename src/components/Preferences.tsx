import { THEMES, type Theme } from '../themes'

type Props = {
  currentThemeId: string
  onThemeChange: (theme: Theme) => void
  onBack: () => void
}

export default function Preferences({ currentThemeId, onThemeChange, onBack }: Props) {
  return (
    <div>
      <div className="prefs-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="prefs-title">Preferences</span>
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
  )
}
