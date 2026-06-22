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
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
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

  // ── Drag and drop: reorder the tab list ──
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggingId(id)
    clearSelection()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggingId) {
      setDropTarget(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropTarget(prev =>
      prev && prev.id === id && prev.after === after ? prev : { id, after },
    )
  }

  // Accept the drop (prevents the snap-back animation); the reorder is committed
  // in handleDragEnd, which fires on every release — even when the cursor
  // overshoots onto a non-row element. To cancel, drag back to the start.
  const handleDrop = (_id: string, e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnd = async () => {
    if (draggingId && dropTarget) {
      await reorderTabs(draggingId, dropTarget.id, dropTarget.after)
      await refresh()
    }
    setDraggingId(null)
    setDropTarget(null)
  }

  // Accept the drop anywhere in the popup during a tab drag, so a release over a
  // non-row spot doesn't trigger the slow snap-back animation.
  const handleViewDragOver = (e: React.DragEvent) => {
    if (draggingId) e.preventDefault()
  }
  const handleViewDrop = (e: React.DragEvent) => {
    if (draggingId) e.preventDefault()
  }

  const handlers: Partial<Record<Operation, () => void>> = {
    stash: handleStash,
    newBin: handleNewBin,
  }

  // Slice 1: bins are flat (all at root) and can't hold tabs yet.
  const rootBins = bins.filter(b => b.parentId === null)
  const rootTabs = tabs.filter(t => t.binId === null)

  // Gap (between root tabs) where a dragged tab would land. null = hidden,
  // including when the drop wouldn't move the tab from its current spot.
  let dropGap: number | null = null
  if (dropTarget) {
    const targetIdx = rootTabs.findIndex(t => t.id === dropTarget.id)
    const draggingIdx = draggingId ? rootTabs.findIndex(t => t.id === draggingId) : -1
    if (targetIdx !== -1) {
      const gap = dropTarget.after ? targetIdx + 1 : targetIdx
      if (gap !== draggingIdx && gap !== draggingIdx + 1) dropGap = gap
    }
  }

  const renderTab = (tab: Tab) => (
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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    />
  )

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

      <div className="navigator-area" onClick={clearSelection}>
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
                  onSelect={handleSelectBin}
                  onOpen={handleOpenBin}
                  onStartEdit={id => setEditing({ kind: 'bin', id })}
                  onCommitEdit={handleCommitBinEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={handleDeleteBin}
                />
                {expanded.has(bin.id) &&
                  tabs
                    .filter(t => t.binId === bin.id)
                    .map(tab => <Fragment key={tab.id}>{renderTab(tab)}</Fragment>)}
              </Fragment>
            ))}

            {rootTabs.map((tab, i) => (
              <Fragment key={tab.id}>
                {dropGap === i && <div className="drop-line" />}
                {renderTab(tab)}
              </Fragment>
            ))}
            {dropGap === rootTabs.length && <div className="drop-line" />}
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
