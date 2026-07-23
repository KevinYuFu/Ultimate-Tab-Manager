import { BrushCleaning, Layers, LoaderCircle, Search, Settings, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Bin, Keybindings, Operation, Tab } from '../types'
import { captureKey, displayKey } from '../utils'
import {
  createBin,
  deleteBin,
  deleteStashedTabs,
  listBins,
  listStashedTabs,
  openFullView,
  openStashedTab,
  renameBin,
  renameStashedTab,
  aiSortPendingTabs,
  sortBin,
  sortRootTabs,
  stashActiveTab,
  stashAllTabs,
} from '../services/operations'
import { hasPremium } from '../services/premium'
import { fuzzyMatch } from '../services/fuzzy'
import {
  recordCreateBin,
  recordDeleteBin,
  recordDeleteTabs,
  recordRenameBin,
  recordRenameTab,
  redo,
  undo,
} from '../services/history'
import { useDragAndDrop } from '../hooks/useDragAndDrop'
import { useSelection } from '../hooks/useSelection'
import BinRow from './BinRow'
import TabRow from './TabRow'

const PRIMARY: { op: Operation; label: string }[] = [
  { op: 'stash',        label: 'Stash' },
  { op: 'stashAll',     label: 'Stash All' },
]

const SECONDARY: { op: Operation; label: string }[] = [
  { op: 'newBin',       label: 'New Bin' },
  { op: 'openFullView', label: 'Full View' },
  { op: 'editName',     label: 'Edit Name' },
  { op: 'delete',       label: 'Delete' },
  { op: 'open',         label: 'Open' },
]

// True when this document is the standalone Full View tab (opened with
// ?view=full) rather than the toolbar popup.
const isFullView = new URLSearchParams(window.location.search).get('view') === 'full'

// What's currently being renamed inline — a tab or a bin.
type Editing = { kind: 'tab' | 'bin'; id: string } | null

type Props = {
  keybindings: Keybindings
  stashAllOpensFullView: boolean
  onOpenPreferences: () => void
}

export default function Navigator({
  keybindings,
  stashAllOpensFullView,
  onOpenPreferences,
}: Props) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [bins, setBins] = useState<Bin[]>([])
  const [editing, setEditing] = useState<Editing>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // The container whose direct children are numbered (1–9). null = root. It's
  // set per-action: clicking/entering a bin scopes into it; arrowing onto a bin
  // scopes to that bin's level (its parent). See handleOpenBin / moveCursor.
  const [scope, setScope] = useState<string | null>(null)
  // Which bin is mid AI-sort (shows a spinner on its button). null = none.
  const [sortingBinId, setSortingBinId] = useState<string | null>(null)
  // True while "Tidy Root" is sorting the loose tabs (shows a spinner).
  const [tidyingRoot, setTidyingRoot] = useState(false)

  const sel = useSelection(tabs)
  // AI sort is a premium entitlement; gate the per-bin sort button on it.
  const premium = hasPremium()
  // Fuzzy search: while `query` is non-empty the tree is filtered to matches.
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const searching = query.trim() !== ''

  // Reset to root if the scope bin disappears (deleted/undone).
  useEffect(() => {
    if (scope !== null && !bins.some(b => b.id === scope)) setScope(null)
  }, [bins, scope])

  // While searching, a tab matches on its name or (scheme-stripped) URL, and a
  // bin is kept if it matches by name OR has any visible descendant — so the
  // tree collapses to just the paths that lead to a match.
  const cleanUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const matchesTab = (t: Tab) =>
    fuzzyMatch(query, t.name).matched || fuzzyMatch(query, cleanUrl(t.url)).matched
  const visibleTabIds = new Set<string>()
  const visibleBinIds = new Set<string>()
  if (searching) {
    for (const t of tabs) if (matchesTab(t)) visibleTabIds.add(t.id)
    const keepBin = (id: string, name: string): boolean => {
      let keep = fuzzyMatch(query, name).matched
      for (const t of tabs) if (t.binId === id && visibleTabIds.has(t.id)) keep = true
      for (const b of bins) if (b.parentId === id && keepBin(b.id, b.name)) keep = true
      if (keep) visibleBinIds.add(id)
      return keep
    }
    for (const b of bins) if (b.parentId === null) keepBin(b.id, b.name)
  }
  const showBin = (b: Bin) => !searching || visibleBinIds.has(b.id)
  const showTab = (t: Tab) => !searching || visibleTabIds.has(t.id)

  // The flat visible tree in render order (bins with their subtrees, then tabs)
  // — the sequence the arrow keys walk. When searching we recurse regardless of
  // the collapse state, so matches buried in closed bins are still reachable.
  const visibleItems: { kind: 'bin' | 'tab'; id: string }[] = []
  const walkVisible = (parentId: string | null) => {
    for (const b of bins.filter(x => x.parentId === parentId && showBin(x))) {
      visibleItems.push({ kind: 'bin', id: b.id })
      if (searching || expanded.has(b.id)) walkVisible(b.id)
    }
    for (const t of tabs.filter(x => x.binId === parentId && showTab(x))) {
      visibleItems.push({ kind: 'tab', id: t.id })
    }
  }
  walkVisible(null)

  // Numbered items (badges 1–9): while searching, the top visible results; else
  // the current scope's direct children in render order.
  const scopeItems = searching
    ? visibleItems.slice(0, 9)
    : [
        ...bins.filter(b => b.parentId === scope).map(b => ({ kind: 'bin' as const, id: b.id })),
        ...tabs.filter(t => t.binId === scope).map(t => ({ kind: 'tab' as const, id: t.id })),
      ]
  const numberOf = new Map<string, number>()
  scopeItems.slice(0, 9).forEach((item, i) => numberOf.set(item.id, i + 1))

  // Follow the selection into view ONLY when arrow-key nav moved it (moveCursor
  // sets this flag). Mouse clicks, deletes, and the auto-selected search result
  // change the selection too, but scrolling to those yanks the viewport around —
  // so they leave the scroll position alone.
  const followSelectionRef = useRef(false)
  useEffect(() => {
    if (!followSelectionRef.current) return
    followSelectionRef.current = false
    document
      .querySelector('.tab-row.selected, .bin-row.selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [sel.selectedIds, sel.selectedBinId])

  // As the query narrows, keep the selection on the top result so ↓/Enter feel
  // natural — but only when the current selection has dropped out of the results.
  useEffect(() => {
    if (!searching) return
    const first = visibleItems[0]
    if (!first) return
    const stillVisible = visibleItems.some(it =>
      it.kind === 'bin' ? sel.selectedBinId === it.id : sel.selectedIds.has(it.id),
    )
    if (stillVisible) return
    if (first.kind === 'bin') sel.selectBin(first.id)
    else sel.selectTabId(first.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const refresh = async () => {
    const [t, b] = await Promise.all([listStashedTabs(), listBins()])
    setTabs(t)
    setBins(b)
  }

  const dnd = useDragAndDrop({
    bins,
    onChange: refresh,
    // Drag the whole selection when the grabbed tab is part of it; else just it.
    resolveTabDrag: id =>
      sel.selectedIds.has(id) && sel.selectedIds.size > 1 ? [...sel.selectedIds] : [id],
    onNestInto: id => setExpanded(prev => new Set(prev).add(id)),
  })

  // Ask the background worker to AI-sort any pending tabs (it survives the popup
  // closing). If it isn't reachable, sort here instead. Refresh when it's done.
  const sortPending = () => {
    chrome.runtime
      .sendMessage({ type: 'AI_SORT_PENDING' })
      .then(() => refresh())
      .catch(() => aiSortPendingTabs().then(refresh))
  }

  useEffect(() => {
    refresh()
    sortPending() // catch tabs left pending from a previous session
  }, [])

  const handleNewBin = async () => {
    const bin = await createBin(null)
    await recordCreateBin(bin)
    await refresh()
    setExpanded(prev => new Set(prev).add(bin.id))
    sel.selectBin(bin.id)
    setEditing({ kind: 'bin', id: bin.id })
  }

  const handleStash = async () => {
    await stashActiveTab()
    await refresh() // show it immediately (pending), then sort in the background
    sortPending()
  }

  const handleStashAll = async () => {
    // From the popup with the preference on, hand Stash All off to a freshly
    // opened Full View tab (see the stash-on-open effect below). Stashing there
    // is safe: closing the window's tabs can't tear down a normal tab the way it
    // would this popup. The popup's only job is this one fire-and-forget call.
    if (stashAllOpensFullView && !isFullView) {
      await openFullView({ stashOnOpen: true })
      return
    }
    const binId = await stashAllTabs()
    await refresh()
    if (binId) setExpanded(prev => new Set(prev).add(binId))
  }

  // If this is the Full View tab the popup opened to run Stash All (?stashOnOpen),
  // do it now — from here the stash+close can't destroy our own context. Strip
  // the flag first so a manual reload doesn't stash again.
  useEffect(() => {
    if (!isFullView) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('stashOnOpen') !== '1') return
    params.delete('stashOnOpen')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    handleStashAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tabs ──
  // Deleting a tab that's part of the selection deletes the whole selection
  // (matches drag); deleting an unselected tab removes just that one.
  const handleDeleteTab = async (id: string) => {
    const ids = sel.selectedIds.has(id) && sel.selectedIds.size > 1 ? [...sel.selectedIds] : [id]
    await handleDeleteTabs(ids)
  }

  const handleDeleteTabs = async (ids: string[]) => {
    await recordDeleteTabs(ids)
    await deleteStashedTabs(ids)
    await refresh()
    ids.forEach(sel.deselectTab)
  }

  const handleOpen = (tab: Tab) => openStashedTab(tab)

  const handleCommitTabEdit = async (id: string, name: string) => {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed) return // ignore empty names; keep the existing one
    const from = tabs.find(t => t.id === id)?.name ?? ''
    await recordRenameTab(id, from, trimmed)
    await renameStashedTab(id, trimmed)
    await refresh()
  }

  // ── Bins ──
  // Mouse toggle: open a bin scopes into it (its children get numbered);
  // closing it scopes back out to the bin's level.
  const handleOpenBin = (id: string) => {
    const willExpand = !expanded.has(id)
    setExpanded(prev => {
      const next = new Set(prev)
      if (willExpand) next.add(id)
      else next.delete(id)
      return next
    })
    setScope(willExpand ? id : bins.find(b => b.id === id)?.parentId ?? null)
  }

  // Enter (drill into) a bin: expand it, scope into it, and move the cursor to
  // its first child so its children become the numbered set. An empty bin just
  // opens with the cursor left on it.
  const enterBin = (id: string) => {
    setExpanded(prev => new Set(prev).add(id))
    setScope(id)
    const childBin = bins.find(b => b.parentId === id)
    const childTab = tabs.find(t => t.binId === id)
    if (childBin) sel.selectBin(childBin.id)
    else if (childTab) sel.selectTabId(childTab.id)
    else sel.selectBin(id)
  }

  // Clicking a tab scopes to its parent (so you can switch levels by clicking).
  const handleSelectTab = (tab: Tab, e: React.MouseEvent) => {
    sel.selectTab(tab, e)
    setScope(tab.binId)
  }

  // Number key (1–9): act on the Nth item in scope. A bin is entered; a tab is
  // selected, or opened if it was already the selection (press-again to open).
  const quickSelect = (item: { kind: 'bin' | 'tab'; id: string }) => {
    if (item.kind === 'bin') {
      enterBin(item.id)
    } else if (sel.selectedIds.has(item.id)) {
      const tab = tabs.find(t => t.id === item.id)
      if (tab) openStashedTab(tab)
    } else {
      sel.selectTabId(item.id)
    }
  }

  // Go back = close the bin we're in and land on it: the selected bin if it's
  // open, otherwise the scope bin (the one containing the cursor). Root does
  // nothing.
  const handleGoBack = () => {
    const binToClose =
      sel.selectedBinId && expanded.has(sel.selectedBinId) ? sel.selectedBinId : scope
    if (binToClose === null) return
    setExpanded(prev => {
      const next = new Set(prev)
      next.delete(binToClose)
      return next
    })
    sel.selectBin(binToClose)
    setScope(bins.find(b => b.id === binToClose)?.parentId ?? null)
  }

  // Arrow ↑/↓: move the selection freely through the whole visible tree; scope
  // follows to the new cursor's level (a bin scopes to its parent, a tab to its
  // bin), so the numbers re-map as you cross levels.
  const moveCursor = (delta: 1 | -1) => {
    if (visibleItems.length === 0) return
    followSelectionRef.current = true // arrow nav should scroll to follow
    const cur = visibleItems.findIndex(it =>
      it.kind === 'bin' ? sel.selectedBinId === it.id : sel.selectedIds.has(it.id),
    )
    const next = cur === -1
      ? (delta > 0 ? 0 : visibleItems.length - 1)
      : Math.min(Math.max(cur + delta, 0), visibleItems.length - 1)
    const item = visibleItems[next]
    if (item.kind === 'bin') {
      sel.selectBin(item.id)
      setScope(bins.find(b => b.id === item.id)?.parentId ?? null)
    } else {
      sel.selectTabId(item.id)
      setScope(tabs.find(t => t.id === item.id)?.binId ?? null)
    }
  }

  const handleDeleteBin = async (id: string) => {
    await recordDeleteBin(id)
    await deleteBin(id)
    await refresh()
  }

  // Sort this bin's tabs into the other bins (matches move out; leftovers stay).
  // Runs in the foreground since the user is here clicking — the spinner keeps
  // the bin's actions visible until it resolves.
  const handleSortBin = async (id: string) => {
    setSortingBinId(id)
    try {
      await sortBin(id)
      await refresh()
    } finally {
      setSortingBinId(null)
    }
  }

  // Tidy Root: AI-sort the loose (root) tabs into existing bins; leftovers stay.
  const handleTidyRoot = async () => {
    setTidyingRoot(true)
    try {
      await sortRootTabs()
      await refresh()
    } finally {
      setTidyingRoot(false)
    }
  }

  const handleCommitBinEdit = async (id: string, name: string) => {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed) return
    const from = bins.find(b => b.id === id)?.name ?? ''
    await recordRenameBin(id, from, trimmed)
    await renameBin(id, trimmed)
    await refresh()
  }

  const cancelEdit = () => setEditing(null)

  // ── Selection-aware operations ──
  // These act on the current selection so the keyboard and the toolbar buttons
  // share one behaviour. "Open"/"Edit"/"Delete" are type-specific (bin vs tab).
  const handleOpenSelection = () => {
    if (sel.selectedBinId) enterBin(sel.selectedBinId)
    else tabs.filter(t => sel.selectedIds.has(t.id)).forEach(openStashedTab)
  }

  const handleEditSelection = () => {
    if (sel.selectedBinId) setEditing({ kind: 'bin', id: sel.selectedBinId })
    else if (sel.selectedIds.size === 1) {
      const [id] = [...sel.selectedIds]
      setEditing({ kind: 'tab', id })
    }
  }

  const handleDeleteSelection = () => {
    if (sel.selectedBinId) {
      handleDeleteBin(sel.selectedBinId)
      sel.clear()
    } else if (sel.selectedIds.size > 0) {
      handleDeleteTabs([...sel.selectedIds])
    }
  }

  const handleUndo = async () => {
    if (await undo()) {
      sel.clear()
      await refresh()
    }
  }

  const handleRedo = async () => {
    if (await redo()) {
      sel.clear()
      await refresh()
    }
  }

  // ── Search ──
  const handleFocusSearch = () => searchRef.current?.focus()

  const clearSearch = () => {
    setQuery('')
    searchRef.current?.blur()
    sel.clear()
  }

  // The search box owns its keys: arrows move the selection through the filtered
  // results, Enter opens it, Escape clears. Typed letters just edit the query —
  // the global hotkey handler bails while the box is focused (see below).
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); clearSearch() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); handleOpenSelection() }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') e.preventDefault()
  }

  // Single source of truth for both the toolbar buttons and the keyboard
  // handler below. Adding an op here wires up its hotkey automatically; an op
  // with no handler (e.g. undo) stays inert and its button renders disabled.
  const handlers: Partial<Record<Operation, () => void>> = {
    stash: handleStash,
    stashAll: handleStashAll,
    newBin: handleNewBin,
    openFullView: openFullView,
    editName: handleEditSelection,
    delete: handleDeleteSelection,
    open: handleOpenSelection,
    goBack: handleGoBack,
    search: handleFocusSearch,
    tidyRoot: handleTidyRoot,
    undo: handleUndo,
    redo: handleRedo,
  }

  // Keyboard: match the pressed combo against the user's keybindings and run
  // the matching handler. While an inline rename is active, the input owns its
  // keys, so we bail early.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) return
      // While the search box is focused it owns its keys (see handleSearchKeyDown).
      if (document.activeElement === searchRef.current) return
      // Quick-select: 1–9 acts on the Nth item in the current scope.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const item = scopeItems[Number(e.key) - 1]
        if (item) {
          e.preventDefault()
          quickSelect(item)
        }
        return
      }
      // Arrow navigation: ↑/↓ move freely through the visible tree, → drills
      // into a bin, ← goes back (close/up).
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        moveCursor(e.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (sel.selectedBinId) enterBin(sel.selectedBinId)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleGoBack()
        return
      }
      // Enter also opens (in addition to the rebindable open key).
      if (e.key === 'Enter') {
        e.preventDefault()
        handleOpenSelection()
        return
      }
      const combo = captureKey(e)
      if (!combo) return
      const op = (Object.keys(keybindings) as Operation[]).find(
        o => keybindings[o] === combo,
      )
      const handler = op && handlers[op]
      if (handler) {
        e.preventDefault()
        handler()
        return
      }
      // A bare `f` also opens search, on top of the rebindable search key. Checked
      // after the lookup so an explicit rebinding to F still wins.
      if (combo === 'F') {
        e.preventDefault()
        handlers.search?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers, editing, keybindings, scopeItems, quickSelect, moveCursor, enterBin, handleGoBack, handleOpenSelection])

  // A tab renders with an insertion line before or after it when it's the
  // reorder target. Renders the row plus its lines so it works in any group.
  const renderTab = (tab: Tab, depth: number, firstInGroup = false, lastInGroup = false) => {
    const dropBefore = dnd.dropState?.kind === 'tab' && dnd.dropState.id === tab.id && !dnd.dropState.after
    const dropAfter = dnd.dropState?.kind === 'tab' && dnd.dropState.id === tab.id && dnd.dropState.after
    const lineStyle = { marginLeft: depth * 16 + 6 }
    return (
      <Fragment key={tab.id}>
        {dropBefore && <div className="drop-line" style={lineStyle} />}
        <TabRow
          tab={tab}
          depth={depth}
          firstInGroup={firstInGroup}
          lastInGroup={lastInGroup}
          selected={sel.selectedIds.has(tab.id)}
          number={numberOf.get(tab.id)}
          editing={editing?.kind === 'tab' && editing.id === tab.id}
          dragging={dnd.dragTabIds.includes(tab.id)}
          onSelect={handleSelectTab}
          onOpen={handleOpen}
          onDelete={handleDeleteTab}
          onStartEdit={id => setEditing({ kind: 'tab', id })}
          onCommitEdit={handleCommitTabEdit}
          onCancelEdit={cancelEdit}
          onDragStart={(id, e) => dnd.startDrag('tab', id, e)}
          onDragOver={dnd.tabDragOver}
          onDrop={dnd.itemDrop}
          onDragEnd={dnd.dragEnd}
        />
        {dropAfter && <div className="drop-line" style={lineStyle} />}
      </Fragment>
    )
  }

  // Recursively render one level of the tree: child bins (each with their
  // subtree when expanded), then child tabs.
  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const childBins = bins.filter(b => b.parentId === parentId && showBin(b))
    const childTabs = tabs.filter(t => t.binId === parentId && showTab(t))
    const lineStyle = { marginLeft: depth * 16 + 6 }
    return (
      <>
        {childBins.map(bin => {
          const before = dnd.dropState?.kind === 'binReorder' && dnd.dropState.id === bin.id && !dnd.dropState.after
          const after = dnd.dropState?.kind === 'binReorder' && dnd.dropState.id === bin.id && dnd.dropState.after
          return (
            <Fragment key={bin.id}>
              {before && <div className="drop-line" style={lineStyle} />}
              <BinRow
                bin={bin}
                depth={depth}
                expanded={searching || expanded.has(bin.id)}
                selected={sel.selectedBinId === bin.id}
                number={numberOf.get(bin.id)}
                editing={editing?.kind === 'bin' && editing.id === bin.id}
                dropInto={dnd.dropState?.kind === 'bin' && dnd.dropState.id === bin.id}
                dragging={dnd.draggingItem?.kind === 'bin' && dnd.draggingItem.id === bin.id}
                canSort={premium}
                sorting={sortingBinId === bin.id}
                onSelect={sel.selectBin}
                onOpen={handleOpenBin}
                onSort={handleSortBin}
                onStartEdit={id => setEditing({ kind: 'bin', id })}
                onCommitEdit={handleCommitBinEdit}
                onCancelEdit={cancelEdit}
                onDelete={handleDeleteBin}
                onDragStart={(id, e) => dnd.startDrag('bin', id, e)}
                onDragOver={dnd.binDragOver}
                onDrop={dnd.itemDrop}
                onDragEnd={dnd.dragEnd}
              />
              {(searching || expanded.has(bin.id)) && renderLevel(bin.id, depth + 1)}
              {after && <div className="drop-line" style={lineStyle} />}
            </Fragment>
          )
        })}
        {childTabs.map((t, i) =>
          renderTab(t, depth, i === 0, i === childTabs.length - 1),
        )}
      </>
    )
  }

  const isEmpty = tabs.length === 0 && bins.length === 0
  const noMatches = searching && visibleItems.length === 0

  return (
    <div className="nav-view" onDragOver={dnd.viewDragOver} onDrop={dnd.viewDrop}>

      <header className="nav-header">
        <span className="nav-logo">UTM</span>
        <div className="nav-header-right">
          {PRIMARY.map(({ op, label }) => (
            <button
              key={op}
              className="header-action-btn"
              onClick={handlers[op]}
              disabled={!handlers[op]}
            >
              <kbd className="btn-kbd">{displayKey(keybindings[op])}</kbd>
              <span>{label}</span>
            </button>
          ))}
          <div className="header-divider" />
          <button className="icon-btn" onClick={onOpenPreferences} title="Preferences">
            <Settings size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="nav-search">
        <Search className="nav-search-icon" size={14} strokeWidth={2} />
        <input
          ref={searchRef}
          className="nav-search-input"
          placeholder="Search tabs and bins…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {searching && (
          <button className="nav-search-clear" onClick={clearSearch} title="Clear (Esc)">
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <div
        className={`navigator-area${dnd.dropState?.kind === 'root' ? ' drop-root' : ''}`}
        onClick={sel.clear}
        onDragOver={dnd.rootDragOver}
      >
        {isEmpty ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No stashed tabs</p>
            <p className="empty-hint">Stash a tab to get started</p>
          </div>
        ) : noMatches ? (
          <div className="empty-state">
            <Search size={32} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No matches</p>
            <p className="empty-hint">Nothing matches “{query.trim()}”</p>
          </div>
        ) : (
          <div className="tab-list">{renderLevel(null, 0)}</div>
        )}
      </div>

      <div className="action-bar">
        {SECONDARY.map(({ op, label }) => (
          <button
            key={op}
            className="action-btn"
            onClick={handlers[op]}
            disabled={!handlers[op]}
          >
            <kbd className="btn-kbd">{displayKey(keybindings[op])}</kbd>
            <span>{label}</span>
          </button>
        ))}
        {/* Tidy Root: broom icon + short "Tidy" label; fuller name in aria-label
            / title for screen readers and the tooltip. */}
        {premium && (
          <button
            className="action-btn"
            onClick={handleTidyRoot}
            disabled={tidyingRoot}
            aria-label="Tidy Root"
            title="Tidy Root"
          >
            {tidyingRoot ? (
              <LoaderCircle className="tab-spinner" size={15} strokeWidth={2} />
            ) : (
              <BrushCleaning size={15} strokeWidth={1.75} />
            )}
            <span>Tidy</span>
          </button>
        )}
      </div>

      <div className="status-bar">
        <span className="status-item"><kbd className="status-kbd">1–9</kbd>select</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.open)}</kbd>open</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.goBack)}</kbd>back</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.delete)}</kbd>delete</span>
      </div>

    </div>
  )
}
