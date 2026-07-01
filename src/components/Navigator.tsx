import { Layers, Settings } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import type { Bin, Keybindings, Operation, Tab } from '../types'
import { captureKey, displayKey } from '../utils'
import {
  createBin,
  deleteBin,
  deleteStashedTab,
  deleteStashedTabs,
  listBins,
  listStashedTabs,
  openFullView,
  openStashedTab,
  renameBin,
  renameStashedTab,
  stashActiveTab,
  stashAllTabs,
} from '../services/operations'
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
  // The container whose direct children are addressable by number (1–9).
  // null = root; otherwise an expanded bin's id. See scopeItems / handleOpenBin.
  const [scope, setScope] = useState<string | null>(null)

  const sel = useSelection(tabs)

  // The numbered items: the scope's direct children in render order (bins, then
  // tabs), first 9 get numbers 1–9. numberOf maps an id to its badge number.
  const scopeItems = [
    ...bins.filter(b => b.parentId === scope).map(b => ({ kind: 'bin' as const, id: b.id })),
    ...tabs.filter(t => t.binId === scope).map(t => ({ kind: 'tab' as const, id: t.id })),
  ]
  const numberOf = new Map<string, number>()
  scopeItems.slice(0, 9).forEach((item, i) => numberOf.set(item.id, i + 1))

  // If the scope bin disappears (deleted/undone), fall back to root.
  useEffect(() => {
    if (scope !== null && !bins.some(b => b.id === scope)) setScope(null)
  }, [bins, scope])

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

  useEffect(() => {
    refresh()
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
    await refresh()
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
  const handleDeleteTab = async (id: string) => {
    await recordDeleteTabs([id])
    await deleteStashedTab(id)
    await refresh()
    sel.deselectTab(id)
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
  // Open a bin = expand/collapse it. The scope follows: opening moves it into
  // the bin, closing moves it up to the bin's parent (so numbers track what the
  // user is looking at).
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

  // Enter a bin (from number quick-select): ensure it's open and scoped in.
  const enterBin = (id: string) => {
    setExpanded(prev => new Set(prev).add(id))
    setScope(id)
    sel.selectBin(id)
  }

  // Selecting a tab with the mouse moves the scope to its parent bin.
  const handleSelectTab = (tab: Tab, e: React.MouseEvent) => {
    sel.selectTab(tab, e)
    setScope(tab.binId)
  }

  // Number key (1–9): act on the Nth item in scope — enter a bin, select a tab.
  const quickSelect = (item: { kind: 'bin' | 'tab'; id: string }) => {
    if (item.kind === 'bin') enterBin(item.id)
    else sel.selectTabId(item.id)
  }

  const handleDeleteBin = async (id: string) => {
    await recordDeleteBin(id)
    await deleteBin(id)
    await refresh()
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
    if (sel.selectedBinId) handleOpenBin(sel.selectedBinId)
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
    undo: handleUndo,
    redo: handleRedo,
  }

  // Keyboard: match the pressed combo against the user's keybindings and run
  // the matching handler. While an inline rename is active, the input owns its
  // keys, so we bail early.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) return
      // Quick-select: 1–9 acts on the Nth item in the current scope.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const item = scopeItems[Number(e.key) - 1]
        if (item) {
          e.preventDefault()
          quickSelect(item)
        }
        return
      }
      const combo = captureKey(e)
      if (!combo) return
      const op = (Object.keys(keybindings) as Operation[]).find(
        o => keybindings[o] === combo,
      )
      const handler = op && handlers[op]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers, editing, keybindings, scopeItems, quickSelect])

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
    const childBins = bins.filter(b => b.parentId === parentId)
    const childTabs = tabs.filter(t => t.binId === parentId)
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
                expanded={expanded.has(bin.id)}
                selected={sel.selectedBinId === bin.id}
                number={numberOf.get(bin.id)}
                editing={editing?.kind === 'bin' && editing.id === bin.id}
                dropInto={dnd.dropState?.kind === 'bin' && dnd.dropState.id === bin.id}
                dragging={dnd.draggingItem?.kind === 'bin' && dnd.draggingItem.id === bin.id}
                onSelect={sel.selectBin}
                onOpen={handleOpenBin}
                onStartEdit={id => setEditing({ kind: 'bin', id })}
                onCommitEdit={handleCommitBinEdit}
                onCancelEdit={cancelEdit}
                onDelete={handleDeleteBin}
                onDragStart={(id, e) => dnd.startDrag('bin', id, e)}
                onDragOver={dnd.binDragOver}
                onDrop={dnd.itemDrop}
                onDragEnd={dnd.dragEnd}
              />
              {expanded.has(bin.id) && renderLevel(bin.id, depth + 1)}
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
      </div>

      <div className="status-bar">
        <span className="status-item"><kbd className="status-kbd">↑↓</kbd>navigate</span>
        <span className="status-item"><kbd className="status-kbd">↵</kbd>open</span>
        <span className="status-item"><kbd className="status-kbd">⌫</kbd>delete</span>
        <span className="status-item"><kbd className="status-kbd">Esc</kbd>close</span>
      </div>

    </div>
  )
}
