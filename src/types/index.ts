export type View = 'navigator' | 'preferences'

export type Tab = {
  id: string
  url: string
  name: string
  favicon: string
  dateAdded: number
  binId: string | null
}

export type Bin = {
  id: string
  name: string
  parentId: string | null
}

export type Hotkeys = {
  stash: string
  stashAll: string
  openFullView: string
  newBin: string
  editName: string
  delete: string
  open: string
  undo: string
}

export const DEFAULT_HOTKEYS: Hotkeys = {
  stash: 'S',
  stashAll: 'A',
  openFullView: 'M',
  newBin: 'B',
  editName: 'E',
  delete: 'Backspace',
  open: 'Enter',
  undo: 'Ctrl+Z',
}

export type Settings = {
  themeId: string
  hotkeys: Hotkeys
  tabs: Tab[]
  bins: Bin[]
}
