export type Theme = {
  id: string
  name: string
  bg: string
  surface: string
  surface2: string
  hover: string
  border: string
  borderMd: string
  borderHi: string
  text1: string
  text2: string
  text3: string
  accent: string
  accentSoft: string
  accent2: string
}

export const THEMES: Theme[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    bg: '#1a1b2e',
    surface: '#1f2335',
    surface2: '#24283b',
    hover: '#292e42',
    border: 'rgba(255,255,255,0.07)',
    borderMd: 'rgba(255,255,255,0.13)',
    borderHi: 'rgba(255,255,255,0.24)',
    text1: '#c0caf5',
    text2: '#a9b1d6',
    text3: '#565f89',
    accent: '#7aa2f7',
    accentSoft: 'rgba(122,162,247,0.12)',
    accent2: '#bb9af7',
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    bg: '#1d2021',
    surface: '#282828',
    surface2: '#32302f',
    hover: '#3c3836',
    border: 'rgba(255,255,255,0.07)',
    borderMd: 'rgba(255,255,255,0.12)',
    borderHi: 'rgba(255,255,255,0.22)',
    text1: '#ebdbb2',
    text2: '#d5c4a1',
    text3: '#928374',
    accent: '#d79921',
    accentSoft: 'rgba(215,153,33,0.12)',
    accent2: '#689d6a',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    bg: '#191a21',
    surface: '#282a36',
    surface2: '#2d303f',
    hover: '#363848',
    border: 'rgba(255,255,255,0.07)',
    borderMd: 'rgba(255,255,255,0.13)',
    borderHi: 'rgba(255,255,255,0.23)',
    text1: '#f8f8f2',
    text2: '#c8c8c2',
    text3: '#6272a4',
    accent: '#bd93f9',
    accentSoft: 'rgba(189,147,249,0.12)',
    accent2: '#ff79c6',
  },
  {
    id: 'nord',
    name: 'Nord',
    bg: '#242933',
    surface: '#2e3440',
    surface2: '#3b4252',
    hover: '#434c5e',
    border: 'rgba(255,255,255,0.06)',
    borderMd: 'rgba(255,255,255,0.11)',
    borderHi: 'rgba(255,255,255,0.20)',
    text1: '#eceff4',
    text2: '#d8dee9',
    text3: '#4c566a',
    accent: '#88c0d0',
    accentSoft: 'rgba(136,192,208,0.12)',
    accent2: '#81a1c1',
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    bg: '#181825',
    surface: '#1e1e2e',
    surface2: '#313244',
    hover: '#383850',
    border: 'rgba(255,255,255,0.06)',
    borderMd: 'rgba(255,255,255,0.11)',
    borderHi: 'rgba(255,255,255,0.20)',
    text1: '#cdd6f4',
    text2: '#bac2de',
    text3: '#6c7086',
    accent: '#cba6f7',
    accentSoft: 'rgba(203,166,247,0.12)',
    accent2: '#89b4fa',
  },
]

export const DEFAULT_THEME = THEMES[0]
