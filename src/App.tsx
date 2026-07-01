import { useEffect, useState } from 'react'
import Navigator from './components/Navigator'
import Preferences from './components/Preferences'
import { THEMES, DEFAULT_THEME, type Theme } from './themes'
import {
  DEFAULT_KEYBINDINGS,
  DEFAULT_STASH_ALL_OPENS_FULL_VIEW,
  type Keybindings,
  type View,
} from './types'

export default function App() {
  const [view, setView] = useState<View>('navigator')
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [keybindings, setKeybindings] = useState<Keybindings>(DEFAULT_KEYBINDINGS)
  const [stashAllOpensFullView, setStashAllOpensFullView] = useState(
    DEFAULT_STASH_ALL_OPENS_FULL_VIEW,
  )

  useEffect(() => {
    chrome.storage.local.get(['themeId', 'keybindings', 'stashAllOpensFullView'], (result) => {
      if (result.themeId) {
        const found = THEMES.find(t => t.id === result.themeId)
        if (found) setTheme(found)
      }
      if (result.keybindings) {
        setKeybindings({ ...DEFAULT_KEYBINDINGS, ...result.keybindings })
      }
      if (typeof result.stashAllOpensFullView === 'boolean') {
        setStashAllOpensFullView(result.stashAllOpensFullView)
      }
    })
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    chrome.storage.local.set({ themeId: t.id })
  }

  const saveKeybindings = (k: Keybindings) => {
    setKeybindings(k)
    chrome.storage.local.set({ keybindings: k })
  }

  const saveStashAllOpensFullView = (v: boolean) => {
    setStashAllOpensFullView(v)
    chrome.storage.local.set({ stashAllOpensFullView: v })
  }

  useEffect(() => {
    const vars: Record<string, string> = {
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
    }
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  }, [theme])

  return (
    <div className="app">
      {view === 'navigator' ? (
        <Navigator
          keybindings={keybindings}
          stashAllOpensFullView={stashAllOpensFullView}
          onOpenPreferences={() => setView('preferences')}
        />
      ) : (
        <Preferences
          currentThemeId={theme.id}
          onThemeChange={applyTheme}
          keybindings={keybindings}
          onKeybindingsChange={saveKeybindings}
          stashAllOpensFullView={stashAllOpensFullView}
          onStashAllOpensFullViewChange={saveStashAllOpensFullView}
          onBack={() => setView('navigator')}
        />
      )}
    </div>
  )
}
