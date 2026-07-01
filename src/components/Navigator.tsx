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
  { op: 'undo',         label: 'Undo' },
]

// True when this document is the standalone Full View tab (opened with
// ?view=full) rather than the toolbar popup.
const isFullView = new URLSearchParams(window.location.search).get('view') === 'full'

// What's currently being renamed inline — a tab or a bin.
type Editing = { kind: 'tab' | 'bin'; id: string } | null

type Props = {
  keybindings: Keybindings
  onOpenPreferences: () => void
}

export default function Navigator({ keybindings, onOpenPreferences }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [bins, setBins] = useState<Bin[]>([])
  const [editing, setEditing] = useState<Editing>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sel = useSelection(tabs)

  const refresh = async () => {
    const [t, b] = await Promise.all([listStashedTabs(), listBins()])
    setTabs(t)
    setBins(b)
  }

  const dnd = useDragAndDrop({
    bins,
    onChange: refresh,
    onDragStart: sel.clear,
    onNestInto: id => setExpanded(prev => new Set(prev).add(id)),
  })

  useEffect(() => {
    refresh()
  }, [])

  const handleNewBin = async () => {
    const bin = await createBin(null)
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
    const binId = await stashAllTabs()
    await refresh()
    if (binId) {
      setExpanded(prev => new Set(prev).add(binId))
      // Stashing all clears the window, so from the popup land the user on the
      // Full View to see the result. (Already there when in Full View.)
      if (!isFullView) await openFullView()
    }
  }

  // ── Tabs ──
  const handleDeleteTab = async (id: string) => {
    await deleteStashedTab(id)
    await refresh()
    sel.deselectTab(id)
  }

  const handleDeleteTabs = async (ids: string[]) => {
    await deleteStashedTabs(ids)
    await refresh()
    ids.forEach(sel.deselectTab)
  }

  const handleOpen = (tab: Tab) => openStashedTab(tab)

  const handleCommitTabEdit = async (id: string, name: string) => {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed) return // ignore empty names; keep the existing one
    await renameStashedTab(id, trimmed)
    await refresh()
  }

  // ── Bins ──
  // Open a bin = expand/collapse it.
  const handleOpenBin = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteBin = async (id: string) => {
    await deleteBin(id)
    await refresh()
  }

  const handleCommitBinEdit = async (id: string, name: string) => {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed) return
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
    // undo: not yet implemented — needs an action-history stack.
  }

  // Keyboard: match the pressed combo against the user's keybindings and run
  // the matching handler. While an inline rename is active, the input owns its
  // keys, so we bail early.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) return
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
  }, [handlers, editing, keybindings])

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
          editing={editing?.kind === 'tab' && editing.id === tab.id}
          dragging={dnd.draggingItem?.kind === 'tab' && dnd.draggingItem.id === tab.id}
          onSelect={sel.selectTab}
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
        <button className="action-btn">
          <kbd className="btn-kbd">1–9</kbd>
          <span>Quick Select</span>
        </button>
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
