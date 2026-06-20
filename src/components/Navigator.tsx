import { Layers, Settings } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Keybindings, Operation, Tab } from '../types'
import { captureKey, displayKey } from '../utils'
import {
  deleteStashedTab,
  listStashedTabs,
  openStashedTab,
  renameStashedTab,
  reorderTabs,
  stashActiveTab,
} from '../services/operations'
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

type Props = {
  keybindings: Keybindings
  onOpenPreferences: () => void
}

export default function Navigator({ keybindings, onOpenPreferences }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
  const anchorRef = useRef<string | null>(null)

  useEffect(() => {
    listStashedTabs().then(setTabs)
  }, [])

  // Keyboard: open selected tabs (open binding), edit selected tab (editName).
  // While an inline edit is active, the input handles its own keys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingId) return
      const combo = captureKey(e)
      if (!combo) return

      if (combo === keybindings.open && selectedIds.size > 0) {
        e.preventDefault()
        tabs.filter(t => selectedIds.has(t.id)).forEach(openStashedTab)
      } else if (combo === keybindings.editName && selectedIds.size === 1) {
        e.preventDefault()
        const [id] = [...selectedIds]
        setEditingId(id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, tabs, editingId, keybindings])

  const handleStash = async () => setTabs(await stashActiveTab())

  const handleDelete = async (id: string) => {
    setTabs(await deleteStashedTab(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleOpen = (tab: Tab) => openStashedTab(tab)

  const handleStartEdit = (id: string) => setEditingId(id)
  const handleCancelEdit = () => setEditingId(null)
  const handleCommitEdit = async (id: string, name: string) => {
    setEditingId(null)
    const trimmed = name.trim()
    if (!trimmed) return // ignore empty names; keep the existing one
    setTabs(await renameStashedTab(id, trimmed))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    anchorRef.current = null
  }

  const handleSelect = (tab: Tab, e: React.MouseEvent) => {
    // Don't let the click reach the background handler that clears selection.
    e.stopPropagation()
    const id = tab.id

    // Shift: range-select from the anchor to the clicked tab.
    if (e.shiftKey && anchorRef.current) {
      const anchorIdx = tabs.findIndex(t => t.id === anchorRef.current)
      const clickedIdx = tabs.findIndex(t => t.id === id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedIds(new Set(tabs.slice(lo, hi + 1).map(t => t.id)))
        return
      }
    }

    // Cmd/Ctrl: toggle the clicked tab in the selection.
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

    // Plain click: select only this tab.
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
      setTabs(await reorderTabs(draggingId, dropTarget.id, dropTarget.after))
    }
    setDraggingId(null)
    setDropTarget(null)
  }

  // Only 'stash' is wired in P1. Others land with their features (P2+).
  const handlers: Partial<Record<Operation, () => void>> = { stash: handleStash }

  // Gap (between rows) where the dragged tab would land. null = hidden,
  // including when the drop wouldn't move the tab from its current spot.
  let dropGap: number | null = null
  if (dropTarget) {
    const targetIdx = tabs.findIndex(t => t.id === dropTarget.id)
    const draggingIdx = draggingId ? tabs.findIndex(t => t.id === draggingId) : -1
    if (targetIdx !== -1) {
      const gap = dropTarget.after ? targetIdx + 1 : targetIdx
      if (gap !== draggingIdx && gap !== draggingIdx + 1) dropGap = gap
    }
  }

  return (
    <div className="nav-view">

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
        {tabs.length === 0 ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No stashed tabs</p>
            <p className="empty-hint">Stash a tab to get started</p>
          </div>
        ) : (
          <div className="tab-list">
            {tabs.map((tab, i) => (
              <Fragment key={tab.id}>
                {dropGap === i && <div className="drop-line" />}
                <TabRow
                  tab={tab}
                  selected={selectedIds.has(tab.id)}
                  editing={editingId === tab.id}
                  dragging={draggingId === tab.id}
                  onSelect={handleSelect}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                  onStartEdit={handleStartEdit}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={handleCancelEdit}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              </Fragment>
            ))}
            {dropGap === tabs.length && <div className="drop-line" />}
          </div>
        )}
      </div>

      <div className="action-bar">
        {SECONDARY.map(({ op, label }) => (
          <button key={op} className="action-btn">
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
