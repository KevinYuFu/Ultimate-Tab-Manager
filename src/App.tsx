import { useEffect, useState } from 'react'
import Navigator from './components/Navigator'
import Preferences from './components/Preferences'
import { THEMES, DEFAULT_THEME, type Theme } from './themes'
import type { View } from './types'

export default function App() {
  const [view, setView] = useState<View>('navigator')
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    chrome.storage.local.get('themeId', (result) => {
      if (result.themeId) {
        const found = THEMES.find(t => t.id === result.themeId)
        if (found) setTheme(found)
      }
    })
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    chrome.storage.local.set({ themeId: t.id })
  }

  const cssVars = {
    '--bg': theme.bg,
    '--surface': theme.surface,
    '--border': theme.border,
    '--text': theme.text,
    '--muted': theme.muted,
    '--accent': theme.accent,
  } as React.CSSProperties

  return (
    <div className="app" style={cssVars}>
      {view === 'navigator' ? (
        <Navigator onOpenPreferences={() => setView('preferences')} />
      ) : (
        <Preferences
          currentThemeId={theme.id}
          onThemeChange={applyTheme}
          onBack={() => setView('navigator')}
        />
      )}
    </div>
  )
}
