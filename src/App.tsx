import { useEffect, useState } from 'react'
import Navigator from './components/Navigator'
import Preferences from './components/Preferences'
import { THEMES, DEFAULT_THEME, type Theme } from './themes'
import { DEFAULT_HOTKEYS, type Hotkeys, type View } from './types'

export default function App() {
  const [view, setView] = useState<View>('navigator')
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [hotkeys, setHotkeys] = useState<Hotkeys>(DEFAULT_HOTKEYS)

  useEffect(() => {
    chrome.storage.local.get(['themeId', 'hotkeys'], (result) => {
      if (result.themeId) {
        const found = THEMES.find(t => t.id === result.themeId)
        if (found) setTheme(found)
      }
      if (result.hotkeys) {
        setHotkeys({ ...DEFAULT_HOTKEYS, ...result.hotkeys })
      }
    })
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    chrome.storage.local.set({ themeId: t.id })
  }

  const saveHotkeys = (h: Hotkeys) => {
    setHotkeys(h)
    chrome.storage.local.set({ hotkeys: h })
  }

  const cssVars = {
    '--bg':          theme.bg,
    '--surface':     theme.surface,
    '--surface-2':   theme.surface2,
    '--hover':       theme.hover,
    '--border':      theme.border,
    '--border-md':   theme.borderMd,
    '--border-hi':   theme.borderHi,
    '--text-1':      theme.text1,
    '--text-2':      theme.text2,
    '--text-3':      theme.text3,
    '--accent':      theme.accent,
    '--accent-soft': theme.accentSoft,
    '--accent-2':    theme.accent2,
  } as React.CSSProperties

  return (
    <div className="app" style={cssVars}>
      {view === 'navigator' ? (
        <Navigator hotkeys={hotkeys} onOpenPreferences={() => setView('preferences')} />
      ) : (
        <Preferences
          currentThemeId={theme.id}
          onThemeChange={applyTheme}
          hotkeys={hotkeys}
          onHotkeysChange={saveHotkeys}
          onBack={() => setView('navigator')}
        />
      )}
    </div>
  )
}
