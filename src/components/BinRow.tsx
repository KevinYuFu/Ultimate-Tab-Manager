import { ChevronDown, ChevronRight, Folder, Pencil, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { Bin } from '../types'

type Props = {
  bin: Bin
  depth: number
  expanded: boolean
  editing: boolean
  dropInto: boolean
  dragging: boolean
  onToggle: (id: string) => void
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
  editing,
  dropInto,
  dragging,
  onToggle,
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

  const className = ['bin-row', dropInto && 'drop-into', dragging && 'dragging']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      style={{ paddingLeft: depth * 16 + 10 }}
      draggable={!editing}
      onClick={() => !editing && onToggle(bin.id)}
      onDragStart={(e) => onDragStart(bin.id, e)}
      onDragOver={(e) => onDragOver(bin.id, e)}
      onDrop={(e) => onDrop(bin.id, e)}
      onDragEnd={onDragEnd}
    >
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
