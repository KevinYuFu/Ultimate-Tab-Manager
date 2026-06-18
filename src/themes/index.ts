export type Theme = {
  id: string
  name: string
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  accent: string
}

export const THEMES: Theme[] = [
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    bg: '#282828',
    surface: '#3c3836',
    border: '#504945',
    text: '#ebdbb2',
    muted: '#928374',
    accent: '#d79921',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    bg: '#282a36',
    surface: '#44475a',
    border: '#6272a4',
    text: '#f8f8f2',
    muted: '#6272a4',
    accent: '#bd93f9',
  },
  {
    id: 'nord',
    name: 'Nord',
    bg: '#2e3440',
    surface: '#3b4252',
    border: '#4c566a',
    text: '#eceff4',
    muted: '#4c566a',
    accent: '#88c0d0',
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    bg: '#1a1b26',
    surface: '#24283b',
    border: '#414868',
    text: '#c0caf5',
    muted: '#565f89',
    accent: '#7aa2f7',
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    bg: '#1e1e2e',
    surface: '#313244',
    border: '#45475a',
    text: '#cdd6f4',
    muted: '#6c7086',
    accent: '#cba6f7',
  },
]

export const DEFAULT_THEME = THEMES[0]
