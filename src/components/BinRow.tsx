import { ChevronDown, ChevronRight, Folder, Pencil, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { Bin } from '../types'

type Props = {
  bin: Bin
  depth: number
  expanded: boolean
  selected: boolean
  number?: number
  editing: boolean
  dropInto: boolean
  dragging: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onStartEdit: (id: string) => void
  onCommitEdit: (id: string, name: string) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onDragStart: (id: string, e: React.DragEvent) => void
  onDragOver: (id: string, e: React.DragEvent) => void
  onDrop: (id: string, e: React.DragEvent) => void
  onDragEnd: () => void
}

export default function BinRow({
  bin,
  depth,
  expanded,
  selected,
  number,
  editing,
  dropInto,
  dragging,
  onSelect,
  onOpen,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const cancelledRef = useRef(false)
  const lastClickRef = useRef(0)

  // We detect double-clicks ourselves rather than using the native dblclick
  // event, which needs its counter to reset between detections and feels laggy.
  const DOUBLE_CLICK_MS = 300
  const handleClick = (e: React.MouseEvent) => {
    if (editing) return
    e.stopPropagation() // don't let the background handler clear selection
    const now = Date.now()
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      lastClickRef.current = 0
      onStartEdit(bin.id) // double click → rename
    } else {
      lastClickRef.current = now
      onSelect(bin.id) // single click → select…
      onOpen(bin.id) //                …and toggle open/closed
    }
  }

  return (
    <div
      className={`bin-row${selected ? ' selected' : ''}${dropInto ? ' drop-into' : ''}${dragging ? ' dragging' : ''}`}
      style={{ marginLeft: depth * 16 }}
      draggable={!editing}
      onClick={handleClick}
      onDragStart={(e) => onDragStart(bin.id, e)}
      onDragOver={(e) => onDragOver(bin.id, e)}
      onDrop={(e) => onDrop(bin.id, e)}
      onDragEnd={onDragEnd}
    >
      {depth > 0 && (
        <span
          className="row-guides"
          style={{ width: depth * 16, left: -(depth * 16) }}
          aria-hidden="true"
        />
      )}
      {number && <span className="row-number">{number}</span>}
      <span className="bin-chevron">
        {expanded ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
      </span>
      <Folder className="bin-icon" size={15} strokeWidth={1.75} />

      {editing ? (
        <input
          className="tab-name-input"
          defaultValue={bin.name}
          autoFocus
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              cancelledRef.current = true
              e.currentTarget.blur()
            }
          }}
          onBlur={(e) => {
            if (cancelledRef.current) {
              cancelledRef.current = false
              onCancelEdit()
            } else {
              onCommitEdit(bin.id, e.target.value)
            }
          }}
        />
      ) : (
        <>
          <span className="bin-name">{bin.name}</span>
          <div className="tab-actions">
            <button
              className="tab-icon-btn"
              title="Rename bin"
              onClick={(e) => {
                e.stopPropagation()
                onStartEdit(bin.id)
              }}
            >
              <Pencil size={13} strokeWidth={1.75} />
            </button>
            <button
              className="tab-icon-btn"
              title="Delete bin"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(bin.id)
              }}
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
