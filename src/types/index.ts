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

// A point-in-time copy of the stashed state, pushed onto the undo stack before
// each mutating operation so undo can restore it.
export type Snapshot = {
  tabs: Tab[]
  bins: Bin[]
}

// The operations the user can perform in the app.
export type Operation =
  | 'stash'
  | 'stashAll'
  | 'openFullView'
  | 'newBin'
  | 'editName'
  | 'delete'
  | 'open'
  | 'undo'

// Maps each operation to the key that triggers it.
export type Keybindings = Record<Operation, string>

export const DEFAULT_KEYBINDINGS: Keybindings = {
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
  keybindings: Keybindings
  tabs: Tab[]
  bins: Bin[]
}
