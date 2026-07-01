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

// One reversible edit: the minimal data needed to invert a single operation (a
// "delta"), not a full snapshot. The kinds form inverse PAIRS, so applying any
// entry can return its own inverse — that symmetry is what lets undo and redo
// share one code path (see applyUndo in operations).
export type UndoEntry =
  // stash/stash-all ⇄ re-add: remove the stashed tabs (+ bin) and reopen the
  // browser tabs stashing closed ⇄ put the tabs (+ bin) back at their indices.
  | { kind: 'unstash'; tabIds: string[]; binIds: string[]; urls: string[] }
  | { kind: 'restore'; tabs: { tab: Tab; index: number }[]; bins: { bin: Bin; index: number }[] }
  // bin delete ⇄ bin restore (re-adopting the bin's former children).
  | { kind: 'deleteBin'; id: string }
  | { kind: 'restoreBin'; bin: Bin; index: number; childBinIds: string[]; childTabIds: string[] }
  // rename ⇄ rename (old name); move ⇄ move (old spot) — each is its own pair.
  | { kind: 'renameTab'; id: string; name: string }
  | { kind: 'renameBin'; id: string; name: string }
  | { kind: 'moveTab'; id: string; index: number; binId: string | null }
  | { kind: 'moveBin'; id: string; index: number; parentId: string | null }

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
