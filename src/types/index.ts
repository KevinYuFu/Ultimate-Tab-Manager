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

// Where a tab / bin sits: its position in the list and its parent. A move is
// fully described by a "from" spot and a "to" spot.
export type TabSpot = { index: number; binId: string | null }
export type BinSpot = { index: number; parentId: string | null }

// A reversible edit for the history. Each command carries what it needs to go
// BOTH ways, so undo and redo are the same command read in opposite directions
// (see services/history.ts). Stashing is intentionally NOT reversible — history
// is for managing what's already stashed, not for the capture itself.
export type Command =
  | { type: 'removeTabs'; items: { tab: Tab; index: number }[] }
  | { type: 'renameTab'; id: string; from: string; to: string }
  | { type: 'moveTab'; id: string; from: TabSpot; to: TabSpot }
  | { type: 'createBin'; bin: Bin; index: number }
  | { type: 'renameBin'; id: string; from: string; to: string }
  | { type: 'moveBin'; id: string; from: BinSpot; to: BinSpot }
  | { type: 'deleteBin'; bin: Bin; index: number; childTabIds: string[]; childBinIds: string[] }

// The whole undo/redo history: a flat list plus a cursor. commands[0..cursor-1]
// are done (undoable); commands[cursor..] are undone (redoable).
export type History = { commands: Command[]; cursor: number }

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
  | 'redo'

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
  redo: 'Ctrl+Shift+Z',
}

// Whether "Stash all" opens the Full View afterwards, or just closes the tabs.
// Defaults on so new users discover the Full View.
export const DEFAULT_STASH_ALL_OPENS_FULL_VIEW = true

export type Settings = {
  themeId: string
  keybindings: Keybindings
  stashAllOpensFullView: boolean
  tabs: Tab[]
  bins: Bin[]
}
