import { Globe, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Tab } from '../types'

type Props = {
  tab: Tab
  selected: boolean
  onSelect: (tab: Tab, e: React.MouseEvent) => void
  onOpen: (tab: Tab) => void
  onDelete: (id: string) => void
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function TabRow({ tab, selected, onSelect, onOpen, onDelete }: Props) {
  const [faviconError, setFaviconError] = useState(false)
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
      <span className="tab-name">{tab.name}</span>
      <span className="tab-host">{hostname(tab.url)}</span>
      <button
        className="tab-delete-btn"
        title="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(tab.id)
        }}
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}
