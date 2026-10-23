import { LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Tab } from '../types'
import { timeAgo } from '../utils'

type Props = {
  tab: Tab
  // Shown after the site while searching, when the tree context is hidden.
  binName?: string
  depth: number
  firstInGroup: boolean
  lastInGroup: boolean
  selected: boolean
  number?: number
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

// Tabs without a favicon get a letter tile. The color comes from the site name,
// so the same site always gets the same color.
const LETTER_COLORS = ['#5b8def', '#e05d5d', '#9b6cf0', '#3fa97c', '#e08a3c', '#d2559a', '#4bb0c4', '#7c8794']
function letterColor(host: string): string {
  let hash = 0
  for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return LETTER_COLORS[Math.abs(hash) % LETTER_COLORS.length]
}

export default function TabRow({
  tab,
  binName,
  depth,
  firstInGroup,
  lastInGroup,
  selected,
  number,
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
  const host = hostname(tab.url)

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
      {number && <span className="row-number">{number}</span>}
      {showFavicon ? (
        <span className="row-tile">
          <img
            className="tab-favicon"
            src={tab.favicon}
            alt=""
            onError={() => setFaviconError(true)}
          />
        </span>
      ) : (
        <span className="row-tile letter" style={{ background: letterColor(host) }}>
          {(host || tab.name).charAt(0).toUpperCase()}
        </span>
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
          <div className="row-text">
            <span className="row-title">
              <span className="tab-name">{tab.name}</span>
              {tab.needsSort && (
                <LoaderCircle className="tab-spinner" size={12} strokeWidth={2} aria-label="Sorting…" />
              )}
            </span>
            <span className="row-meta">
              {host}
              {binName && <> · {binName}</>}
            </span>
          </div>
          <span className="row-trailing">{timeAgo(tab.dateAdded)}</span>
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
