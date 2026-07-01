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

// One reversible edit on the undo stack: the minimal data needed to invert a
// single operation (a "delta"), rather than a full state snapshot.
export type UndoEntry =
  // Reverse a stash / stash-all: drop the added tabs (and any created bin) and
  // reopen the browser tabs that stashing had closed.
  | { kind: 'unstash'; tabIds: string[]; binIds: string[]; urls: string[] }
  // Reverse a delete: re-insert the removed tabs at their original indices.
  | { kind: 'restoreTabs'; tabs: { tab: Tab; index: number }[] }
  // Reverse a bin delete: re-insert the bin and re-adopt its former children.
  | { kind: 'restoreBin'; bin: Bin; index: number; childBinIds: string[]; childTabIds: string[] }
  // Reverse a bin create: remove it.
  | { kind: 'removeBin'; id: string }
  | { kind: 'renameTab'; id: string; name: string }
  | { kind: 'renameBin'; id: string; name: string }
  // Reverse a tab move/reorder: put the tab back at its old index and bin.
  | { kind: 'moveTab'; id: string; index: number; binId: string | null }
  // Reverse a bin move/reorder: put the bin back at its old index and parent.
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
