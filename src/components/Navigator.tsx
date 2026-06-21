import { Layers, Settings } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Keybindings, Operation, Tab } from '../types'
import { captureKey, displayKey } from '../utils'
import {
  createBin,
  deleteBin,
  deleteStashedTab,
  listBins,
  listStashedTabs,
  moveBin,
  moveTabToBin,
  openStashedTab,
  renameBin,
  renameStashedTab,
  reorderTabs,
  stashActiveTab,
} from '../services/operations'
import type { Bin } from '../types'
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

type Editing = { kind: 'tab' | 'bin'; id: string }
type DragItem = { kind: 'tab' | 'bin'; id: string }
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
  const [editing, setEditing] = useState<Editing | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draggingItem, setDraggingItem] = useState<DragItem | null>(null)
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
    setEditing({ kind: 'bin', id: bin.id })
  }

  // Keyboard: open selected tabs, edit selected tab, create a bin.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editing) return
      const combo = captureKey(e)
      if (!combo) return

      if (combo === keybindings.open && selectedIds.size > 0) {
        e.preventDefault()
        tabs.filter(t => selectedIds.has(t.id)).forEach(openStashedTab)
      } else if (combo === keybindings.editName && selectedIds.size === 1) {
        e.preventDefault()
        const [id] = [...selectedIds]
        setEditing({ kind: 'tab', id })
      } else if (combo === keybindings.newBin) {
        e.preventDefault()
        handleNewBin()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, tabs, editing, keybindings])

  const handleStash = async () => {
    await stashActiveTab()
    await refresh()
  }

  // ── Tab handlers ──
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
    if (!trimmed) return
    await renameStashedTab(id, trimmed)
    await refresh()
  }

  // ── Bin handlers ──
  const handleToggle = (id: string) => {
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
    anchorRef.current = null
  }

  const handleSelect = (tab: Tab, e: React.MouseEvent) => {
    e.stopPropagation()
    const id = tab.id

    if (e.shiftKey && anchorRef.current) {
      const flat = tabs.map(t => t.id)
      const anchorIdx = flat.indexOf(anchorRef.current)
      const clickedIdx = flat.indexOf(id)
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
        setSelectedIds(new Set(flat.slice(lo, hi + 1)))
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

  // ── Drag and drop ──
  const handleDragStart = (kind: 'tab' | 'bin', id: string, e: React.DragEvent) => {
    setDraggingItem({ kind, id })
    if (kind === 'tab') clearSelection()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleTabDragOver = (tabId: string, e: React.DragEvent) => {
    if (!draggingItem || draggingItem.kind !== 'tab') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (tabId === draggingItem.id) {
      setDropState(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropState({ kind: 'tab', id: tabId, after })
  }

  const handleBinDragOver = (binId: string, e: React.DragEvent) => {
    if (!draggingItem) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingItem.kind === 'bin' && draggingItem.id === binId) {
      setDropState(null)
      return
    }
    setDropState({ kind: 'bin', id: binId })
  }

  const handleRootDragOver = (e: React.DragEvent) => {
    if (!draggingItem || e.target !== e.currentTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropState({ kind: 'root' })
  }

  // Accept the drop anywhere in the popup (avoids the slow snap-back animation).
  const handleViewDragOver = (e: React.DragEvent) => {
    if (draggingItem) e.preventDefault()
  }
  const handleItemDrop = (e: React.DragEvent) => {
    if (draggingItem) e.preventDefault()
  }

  // Commit on drag end so releasing anywhere (even off a row) applies the move.
  const handleDragEnd = async () => {
    const item = draggingItem
    const drop = dropState
    setDraggingItem(null)
    setDropState(null)
    if (!item || !drop) return

    if (item.kind === 'tab') {
      if (drop.kind === 'bin') await moveTabToBin(item.id, drop.id)
      else if (drop.kind === 'tab') await reorderTabs(item.id, drop.id, drop.after)
      else if (drop.kind === 'root') await moveTabToBin(item.id, null)
    } else {
      if (drop.kind === 'bin') await moveBin(item.id, drop.id)
      else if (drop.kind === 'root') await moveBin(item.id, null)
    }
    await refresh()
  }

  const handlers: Partial<Record<Operation, () => void>> = {
    stash: handleStash,
    newBin: handleNewBin,
  }

  // ── Recursive tree render ──
  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const childBins = bins.filter(b => b.parentId === parentId)
    const childTabs = tabs.filter(t => t.binId === parentId)
    return (
      <>
        {childBins.map(bin => (
          <Fragment key={bin.id}>
            <BinRow
              bin={bin}
              depth={depth}
              expanded={expanded.has(bin.id)}
              editing={editing?.kind === 'bin' && editing.id === bin.id}
              dropInto={dropState?.kind === 'bin' && dropState.id === bin.id}
              dragging={draggingItem?.kind === 'bin' && draggingItem.id === bin.id}
              onToggle={handleToggle}
              onStartEdit={id => setEditing({ kind: 'bin', id })}
              onCommitEdit={handleCommitBinEdit}
              onCancelEdit={cancelEdit}
              onDelete={handleDeleteBin}
              onDragStart={(id, e) => handleDragStart('bin', id, e)}
              onDragOver={handleBinDragOver}
              onDrop={(_id, e) => handleItemDrop(e)}
              onDragEnd={handleDragEnd}
            />
            {expanded.has(bin.id) && renderLevel(bin.id, depth + 1)}
          </Fragment>
        ))}
        {childTabs.map(tab => {
          const dropBefore = dropState?.kind === 'tab' && dropState.id === tab.id && !dropState.after
          const dropAfter = dropState?.kind === 'tab' && dropState.id === tab.id && dropState.after
          const lineStyle = { marginLeft: depth * 16 + 6 }
          return (
            <Fragment key={tab.id}>
              {dropBefore && <div className="drop-line" style={lineStyle} />}
              <TabRow
                tab={tab}
                depth={depth}
                selected={selectedIds.has(tab.id)}
                editing={editing?.kind === 'tab' && editing.id === tab.id}
                dragging={draggingItem?.kind === 'tab' && draggingItem.id === tab.id}
                onSelect={handleSelect}
                onOpen={handleOpen}
                onDelete={handleDeleteTab}
                onStartEdit={id => setEditing({ kind: 'tab', id })}
                onCommitEdit={handleCommitTabEdit}
                onCancelEdit={cancelEdit}
                onDragStart={(id, e) => handleDragStart('tab', id, e)}
                onDragOver={handleTabDragOver}
                onDrop={(_id, e) => handleItemDrop(e)}
                onDragEnd={handleDragEnd}
              />
              {dropAfter && <div className="drop-line" style={lineStyle} />}
            </Fragment>
          )
        })}
      </>
    )
  }

  const isEmpty = tabs.length === 0 && bins.length === 0

  return (
    <div className="nav-view" onDragOver={handleViewDragOver} onDrop={handleItemDrop}>

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
        onDrop={(e) => handleItemDrop(e)}
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
