import { Layers, Settings } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Bin, Keybindings, Operation, Tab } from '../types'
import { captureKey, displayKey } from '../utils'
import {
  createBin,
  deleteBin,
  deleteStashedTab,
  listBins,
  listStashedTabs,
  moveTabToBin,
  openStashedTab,
  renameBin,
  renameStashedTab,
  reorderTabs,
  stashActiveTab,
} from '../services/operations'
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

// What's currently being renamed inline — a tab or a bin.
type Editing = { kind: 'tab' | 'bin'; id: string } | null

// Where a dragged tab would land: between tabs, into a bin, or out at root.
type DropState =
  | { kind: 'tab'; id: string; after: boolean }
  | { kind: 'bin'; id: string }
  | { kind: 'root' }
  | null

type Props = {
  keybindings: Keybindings
  onOpenPreferences: () => void
}

export default function Navigator({ keybindings, onOpenPreferences }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [bins, setBins] = useState<Bin[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Editing>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropState, setDropState] = useState<DropState>(null)
  const anchorRef = useRef<string | null>(null)

  const refresh = async () => {
    const [t, b] = await Promise.all([listStashedTabs(), listBins()])
    setTabs(t)
    setBins(b)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleNewBin = async () => {
    const bin = await createBin(null)
    await refresh()
    setExpanded(prev => new Set(prev).add(bin.id))
    setSelectedBinId(bin.id)
    setEditing({ kind: 'bin', id: bin.id })
  }

  // Keyboard: open selected tabs, edit the selected tab, create a bin.
  // While an inline rename is active, the input handles its own keys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) return
      const combo = captureKey(e)
      if (!combo) return

      if (combo === keybindings.open) {
        // Open: a selected bin expands/collapses; selected tabs open in browser.
        if (selectedBinId) {
          e.preventDefault()
          handleOpenBin(selectedBinId)
        } else if (selectedIds.size > 0) {
          e.preventDefault()
          tabs.filter(t => selectedIds.has(t.id)).forEach(openStashedTab)
        }
      } else if (combo === keybindings.editName) {
        // Edit: rename the selected bin, or the single selected tab.
        if (selectedBinId) {
          e.preventDefault()
          setEditing({ kind: 'bin', id: selectedBinId })
        } else if (selectedIds.size === 1) {
          e.preventDefault()
          const [id] = [...selectedIds]
          setEditing({ kind: 'tab', id })
        }
      } else if (combo === keybindings.newBin) {
        e.preventDefault()
        handleNewBin()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, selectedBinId, tabs, editing, keybindings])

  const handleStash = async () => {
    await stashActiveTab()
    await refresh()
  }

  // ── Tabs ──
  const handleDeleteTab = async (id: string) => {
    await deleteStashedTab(id)
    await refresh()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
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
  // Select a bin (single selection, separate from the tab multi-selection).
  const handleSelectBin = (id: string) => {
    setSelectedBinId(id)
    setSelectedIds(new Set())
    anchorRef.current = null
  }

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

  // ── Selection (tabs only) ──
  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectedBinId(null)
    anchorRef.current = null
  }

  const handleSelect = (tab: Tab, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedBinId(null) // selecting a tab clears any bin selection
    const id = tab.id

    if (e.shiftKey && anchorRef.current) {
      const anchorIdx = tabs.findIndex(t => t.id === anchorRef.current)
      const clickedIdx = tabs.findIndex(t => t.id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedIds(new Set(tabs.slice(lo, hi + 1).map(t => t.id)))
        return
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      anchorRef.current = id
      return
    }

    setSelectedIds(new Set([id]))
    anchorRef.current = id
  }

  // ── Drag and drop: reorder tabs and move them into / out of bins ──
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggingId(id)
    clearSelection()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  // Over a tab → reorder before/after it.
  const handleTabDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggingId) {
      setDropState(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropState({ kind: 'tab', id, after })
  }

  // Over a bin → move the tab into it.
  const handleBinDragOver = (id: string, e: React.DragEvent) => {
    if (!draggingId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropState({ kind: 'bin', id })
  }

  // Over the empty area → move the tab out to root.
  const handleRootDragOver = (e: React.DragEvent) => {
    if (!draggingId || e.target !== e.currentTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropState({ kind: 'root' })
  }

  // Accept the drop; the move is committed in handleDragEnd, which fires on
  // every release — even when the cursor overshoots onto a non-row element.
  const handleItemDrop = (_id: string, e: React.DragEvent) => {
    if (draggingId) e.preventDefault()
  }

  // Accept the drop anywhere in the popup during a drag, so a release over a
  // non-row spot doesn't trigger the slow snap-back animation.
  const handleViewDragOver = (e: React.DragEvent) => {
    if (draggingId) e.preventDefault()
  }
  const handleViewDrop = (e: React.DragEvent) => {
    if (draggingId) e.preventDefault()
  }

  const handleDragEnd = async () => {
    const id = draggingId
    const drop = dropState
    setDraggingId(null)
    setDropState(null)
    if (!id || !drop) return

    if (drop.kind === 'tab') {
      await reorderTabs(id, drop.id, drop.after)
    } else if (drop.kind === 'bin') {
      await moveTabToBin(id, drop.id)
      setExpanded(prev => new Set(prev).add(drop.id)) // reveal where it landed
    } else if (drop.kind === 'root') {
      await moveTabToBin(id, null)
    }
    await refresh()
  }

  const handlers: Partial<Record<Operation, () => void>> = {
    stash: handleStash,
    newBin: handleNewBin,
  }

  // Bins are still flat (root-only); nesting is slice 3. Tabs can now live in bins.
  const rootBins = bins.filter(b => b.parentId === null)
  const rootTabs = tabs.filter(t => t.binId === null)

  // A tab renders with an insertion line before or after it when it's the
  // reorder target. Renders the row plus its lines so it works in any group.
  const renderTab = (tab: Tab) => {
    const dropBefore = dropState?.kind === 'tab' && dropState.id === tab.id && !dropState.after
    const dropAfter = dropState?.kind === 'tab' && dropState.id === tab.id && dropState.after
    return (
      <Fragment key={tab.id}>
        {dropBefore && <div className="drop-line" />}
        <TabRow
          tab={tab}
          selected={selectedIds.has(tab.id)}
          editing={editing?.kind === 'tab' && editing.id === tab.id}
          dragging={draggingId === tab.id}
          onSelect={handleSelect}
          onOpen={handleOpen}
          onDelete={handleDeleteTab}
          onStartEdit={id => setEditing({ kind: 'tab', id })}
          onCommitEdit={handleCommitTabEdit}
          onCancelEdit={cancelEdit}
          onDragStart={handleDragStart}
          onDragOver={handleTabDragOver}
          onDrop={handleItemDrop}
          onDragEnd={handleDragEnd}
        />
        {dropAfter && <div className="drop-line" />}
      </Fragment>
    )
  }

  const isEmpty = tabs.length === 0 && bins.length === 0

  return (
    <div className="nav-view" onDragOver={handleViewDragOver} onDrop={handleViewDrop}>

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
        className={`navigator-area${dropState?.kind === 'root' ? ' drop-root' : ''}`}
        onClick={clearSelection}
        onDragOver={handleRootDragOver}
      >
        {isEmpty ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No stashed tabs</p>
            <p className="empty-hint">Stash a tab to get started</p>
          </div>
        ) : (
          <div className="tab-list">
            {rootBins.map(bin => (
              <Fragment key={bin.id}>
                <BinRow
                  bin={bin}
                  expanded={expanded.has(bin.id)}
                  selected={selectedBinId === bin.id}
                  editing={editing?.kind === 'bin' && editing.id === bin.id}
                  dropInto={dropState?.kind === 'bin' && dropState.id === bin.id}
                  onSelect={handleSelectBin}
                  onOpen={handleOpenBin}
                  onStartEdit={id => setEditing({ kind: 'bin', id })}
                  onCommitEdit={handleCommitBinEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={handleDeleteBin}
                  onDragOver={handleBinDragOver}
                  onDrop={handleItemDrop}
                />
                {expanded.has(bin.id) && tabs.filter(t => t.binId === bin.id).map(renderTab)}
              </Fragment>
            ))}

            {rootTabs.map(renderTab)}
          </div>
        )}
      </div>

      <div className="action-bar">
        {SECONDARY.map(({ op, label }) => (
          <button key={op} className="action-btn" onClick={handlers[op]}>
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
