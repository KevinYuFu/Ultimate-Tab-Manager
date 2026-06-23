import { useState, type DragEvent } from 'react'
import type { Bin } from '../types'
import {
  moveBin,
  moveTabToBin,
  reorderBins,
  reorderTabs,
} from '../services/operations'

// The item being dragged — a tab or a bin.
export type DragItem = { kind: 'tab' | 'bin'; id: string } | null

// Where the dragged item would land: reordered next to a tab or bin, nested
// into a bin, or out at root.
export type DropState =
  | { kind: 'tab'; id: string; after: boolean }
  | { kind: 'binReorder'; id: string; after: boolean }
  | { kind: 'bin'; id: string }
  | { kind: 'root' }
  | null

type Params = {
  bins: Bin[]
  onChange: () => void | Promise<void> // re-read after a move lands
  onDragStart?: () => void // e.g. clear the selection
  onNestInto?: (binId: string) => void // e.g. expand the bin we dropped into
}

// Owns all the navigator drag-and-drop: which item is being dragged, where it
// would land (for the highlight/insertion line), and committing the move on
// release. The move is committed in dragEnd — which fires on every release,
// even when the cursor overshoots a non-row element — so releasing anywhere
// lands the item where the indicator shows.
export function useDragAndDrop({ bins, onChange, onDragStart, onNestInto }: Params) {
  const [draggingItem, setDraggingItem] = useState<DragItem>(null)
  const [dropState, setDropState] = useState<DropState>(null)

  // Is bin `maybeChildId` a descendant of `ancestorId`? Blocks nesting a bin
  // into its own subtree (which would create a cycle).
  const isDescendantBin = (maybeChildId: string, ancestorId: string) => {
    const byId = new Map(bins.map(b => [b.id, b]))
    let cursor = byId.get(maybeChildId)?.parentId ?? null
    while (cursor) {
      if (cursor === ancestorId) return true
      cursor = byId.get(cursor)?.parentId ?? null
    }
    return false
  }

  const startDrag = (kind: 'tab' | 'bin', id: string, e: DragEvent) => {
    setDraggingItem({ kind, id })
    onDragStart?.()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  // Over a tab → reorder before/after it (only when dragging a tab).
  const tabDragOver = (id: string, e: DragEvent) => {
    if (draggingItem?.kind !== 'tab') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggingItem.id) {
      setDropState(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropState({ kind: 'tab', id, after })
  }

  // Over a bin:
  //  - dragging a tab → always "into" the bin
  //  - dragging a bin → top/bottom edge reorders before/after it, middle nests
  //    inside it (blocked when it would cycle)
  const binDragOver = (id: string, e: DragEvent) => {
    if (!draggingItem) return

    if (draggingItem.kind === 'tab') {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropState({ kind: 'bin', id })
      return
    }

    // dragging a bin
    if (id === draggingItem.id || isDescendantBin(id, draggingItem.id)) {
      setDropState(null)
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    if (y < rect.height * 0.25) {
      setDropState({ kind: 'binReorder', id, after: false })
    } else if (y > rect.height * 0.75) {
      setDropState({ kind: 'binReorder', id, after: true })
    } else {
      setDropState({ kind: 'bin', id })
    }
  }

  // Over the empty area → move the item out to root.
  const rootDragOver = (e: DragEvent) => {
    if (!draggingItem || e.target !== e.currentTarget) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropState({ kind: 'root' })
  }

  // Accept a drop on a row; the actual move happens in dragEnd.
  const itemDrop = (_id: string, e: DragEvent) => {
    if (draggingItem) e.preventDefault()
  }

  // Accept drops anywhere in the popup during a drag, so a release over a
  // non-row spot doesn't trigger the slow snap-back animation.
  const viewDragOver = (e: DragEvent) => {
    if (draggingItem) e.preventDefault()
  }
  const viewDrop = (e: DragEvent) => {
    if (draggingItem) e.preventDefault()
  }

  const dragEnd = async () => {
    const item = draggingItem
    const drop = dropState
    setDraggingItem(null)
    setDropState(null)
    if (!item || !drop) return

    if (item.kind === 'tab') {
      if (drop.kind === 'tab') await reorderTabs(item.id, drop.id, drop.after)
      else if (drop.kind === 'bin') {
        await moveTabToBin(item.id, drop.id)
        onNestInto?.(drop.id)
      } else if (drop.kind === 'root') await moveTabToBin(item.id, null)
    } else {
      if (drop.kind === 'binReorder') await reorderBins(item.id, drop.id, drop.after)
      else if (drop.kind === 'bin') {
        await moveBin(item.id, drop.id)
        onNestInto?.(drop.id)
      } else if (drop.kind === 'root') await moveBin(item.id, null)
      // dropping a bin onto a tab does nothing
    }
    await onChange()
  }

  return {
    draggingItem,
    dropState,
    startDrag,
    tabDragOver,
    binDragOver,
    rootDragOver,
    itemDrop,
    viewDragOver,
    viewDrop,
    dragEnd,
  }
}
