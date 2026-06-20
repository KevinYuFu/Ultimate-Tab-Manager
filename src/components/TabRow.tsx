import { Globe, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Tab } from '../types'

type Props = {
  tab: Tab
  selected: boolean
  editing: boolean
  onSelect: (tab: Tab, e: React.MouseEvent) => void
  onOpen: (tab: Tab) => void
  onDelete: (id: string) => void
  onStartEdit: (id: string) => void
  onCommitEdit: (id: string, name: string) => void
  onCancelEdit: () => void
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
  onSelect,
  onOpen,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: Props) {
  const [faviconError, setFaviconError] = useState(false)
  const cancelledRef = useRef(false)
  const showFavicon = tab.favicon && !faviconError

  return (
    <div
      className={`tab-row${selected ? ' selected' : ''}`}
      onClick={(e) => onSelect(tab, e)}
      onDoubleClick={() => onOpen(tab)}
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
