import { Globe, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Tab } from '../types'

type Props = {
  tab: Tab
  depth: number
  firstInGroup: boolean
  lastInGroup: boolean
  selected: boolean
  editing: boolean
  dragging: boolean
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
  depth,
  firstInGroup,
  lastInGroup,
  selected,
  editing,
  dragging,
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

  const className = ['tab-row', selected && 'selected', dragging && 'dragging']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      style={{ marginLeft: depth * 16 }}
      draggable={!editing}
      onClick={(e) => onSelect(tab, e)}
      onDoubleClick={() => onOpen(tab)}
      onDragStart={(e) => onDragStart(tab.id, e)}
      onDragOver={(e) => onDragOver(tab.id, e)}
      onDrop={(e) => onDrop(tab.id, e)}
      onDragEnd={onDragEnd}
      title={tab.url}
    >
      {depth > 0 && (
        <span
          className="row-guides"
          style={{
            width: depth * 16,
            left: -(depth * 16),
            top: firstInGroup ? 5 : undefined,
            bottom: lastInGroup ? 5 : undefined,
          }}
          aria-hidden="true"
        />
      )}
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
          {/* Stop dblclick here: after a delete the next row shifts under the
              cursor, so a rapid second click on this button would otherwise
              register as a double-click on the row and open the tab. */}
          <div className="tab-actions" onDoubleClick={(e) => e.stopPropagation()}>
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
