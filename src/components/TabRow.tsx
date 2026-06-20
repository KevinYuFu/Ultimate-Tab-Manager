import { Globe, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Tab } from '../types'

type Props = {
  tab: Tab
  selected: boolean
  editing: boolean
  dragging: boolean
  dropBefore: boolean
  dropAfter: boolean
  onSelect: (tab: Tab, e: React.MouseEvent) => void
  onOpen: (tab: Tab) => void
  onDelete: (id: string) => void
  onStartEdit: (id: string) => void
  onCommitEdit: (id: string, name: string) => void
  onCancelEdit: () => void
  onDragStart: (id: string, e: React.DragEvent) => void
  onDragOver: (id: string, e: React.DragEvent) => void
  onDrop: (id: string, e: React.DragEvent) => void
  onDragEnd: () => void
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function TabRow({
  tab,
  selected,
  editing,
  dragging,
  dropBefore,
  dropAfter,
  onSelect,
  onOpen,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [faviconError, setFaviconError] = useState(false)
  const cancelledRef = useRef(false)
  const showFavicon = tab.favicon && !faviconError

  const className = [
    'tab-row',
    selected && 'selected',
    dragging && 'dragging',
    dropBefore && 'drop-before',
    dropAfter && 'drop-after',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      draggable={!editing}
      onClick={(e) => onSelect(tab, e)}
      onDoubleClick={() => onOpen(tab)}
      onDragStart={(e) => onDragStart(tab.id, e)}
      onDragOver={(e) => onDragOver(tab.id, e)}
      onDrop={(e) => onDrop(tab.id, e)}
      onDragEnd={onDragEnd}
      title={tab.url}
    >
      {showFavicon ? (
        <img
          className="tab-favicon"
          src={tab.favicon}
          alt=""
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Globe className="tab-favicon-fallback" size={16} strokeWidth={1.5} />
      )}

      {editing ? (
        <input
          className="tab-name-input"
          defaultValue={tab.name}
          autoFocus
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
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
              onCommitEdit(tab.id, e.target.value)
            }
          }}
        />
      ) : (
        <>
          <span className="tab-name">{tab.name}</span>
          <span className="tab-host">{hostname(tab.url)}</span>
          <div className="tab-actions">
            <button
              className="tab-icon-btn"
              title="Edit name"
              onClick={(e) => {
                e.stopPropagation()
                onStartEdit(tab.id)
              }}
            >
              <Pencil size={13} strokeWidth={1.75} />
            </button>
            <button
              className="tab-icon-btn"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(tab.id)
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
