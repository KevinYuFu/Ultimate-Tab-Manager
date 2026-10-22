import { FolderPlus, Layers, LoaderCircle, Maximize2, Moon, Search, Settings, Sparkles, Sun, X } from 'lucide-react'
import { Fragment, useEffect } from 'react'
import type { Keybindings, Operation, Tab } from '../types'
import { displayKey } from '../utils'
import { useNavigator } from '../hooks/useNavigator'
import BinRow from './BinRow'
import TabRow from './TabRow'

// Small icon buttons in the header (label + hotkey show in the tooltip).
const HEADER_OPS: { op: Operation; label: string; Icon: typeof FolderPlus }[] = [
  { op: 'newBin',       label: 'New Bin',   Icon: FolderPlus },
  { op: 'openFullView', label: 'Full View', Icon: Maximize2 },
]

type Props = {
  keybindings: Keybindings
  stashAllOpensFullView: boolean
  onOpenPreferences: () => void
  scheme: 'light' | 'dark'
  onToggleScheme: () => void
}

export default function Navigator({
  keybindings,
  stashAllOpensFullView,
  onOpenPreferences,
  scheme,
  onToggleScheme,
}: Props) {
  const nav = useNavigator({ keybindings, stashAllOpensFullView })
  const {
    tabs, bins, editing, expanded, premium, sortingBinId, tidyingRoot, sel, dnd,
    query, setQuery, searching, searchRef, clearSearch, handleSearchKeyDown,
    showBin, showTab, visibleItems, numberOf, followSelectionRef, handlers,
  } = nav

  // Follow the selection into view ONLY when arrow-key nav moved it (moveCursor
  // sets this flag). Mouse clicks, deletes, and the auto-selected search result
  // change the selection too, but scrolling to those yanks the viewport around —
  // so they leave the scroll position alone.
  useEffect(() => {
    if (!followSelectionRef.current) return
    followSelectionRef.current = false
    document
      .querySelector('.tab-row.selected, .bin-row.selected')
      ?.scrollIntoView({ block: 'nearest' })
  }, [sel.selectedIds, sel.selectedBinId])

  // Per-bin tab counts, and bin names for tabs while searching (no tree context).
  const tabCount = new Map<string, number>()
  for (const t of tabs) if (t.binId) tabCount.set(t.binId, (tabCount.get(t.binId) ?? 0) + 1)
  const binName = new Map(bins.map(b => [b.id, b.name]))

  // A tab renders with an insertion line before or after it when it's the
  // reorder target. Renders the row plus its lines so it works in any group.
  const renderTab = (tab: Tab, depth: number, firstInGroup = false, lastInGroup = false) => {
    const dropBefore = dnd.dropState?.kind === 'tab' && dnd.dropState.id === tab.id && !dnd.dropState.after
    const dropAfter = dnd.dropState?.kind === 'tab' && dnd.dropState.id === tab.id && dnd.dropState.after
    const lineStyle = { marginLeft: depth * 16 + 6 }
    return (
      <Fragment key={tab.id}>
        {dropBefore && <div className="drop-line" style={lineStyle} />}
        <TabRow
          tab={tab}
          binName={searching && tab.binId ? binName.get(tab.binId) : undefined}
          depth={depth}
          firstInGroup={firstInGroup}
          lastInGroup={lastInGroup}
          selected={sel.selectedIds.has(tab.id)}
          number={numberOf.get(tab.id)}
          editing={editing?.kind === 'tab' && editing.id === tab.id}
          dragging={dnd.dragTabIds.includes(tab.id)}
          onSelect={nav.handleSelectTab}
          onOpen={nav.handleOpen}
          onDelete={nav.handleDeleteTab}
          onStartEdit={nav.startEditTab}
          onCommitEdit={nav.handleCommitTabEdit}
          onCancelEdit={nav.cancelEdit}
          onDragStart={(id, e) => dnd.startDrag('tab', id, e)}
          onDragOver={dnd.tabDragOver}
          onDrop={dnd.itemDrop}
          onDragEnd={dnd.dragEnd}
        />
        {dropAfter && <div className="drop-line" style={lineStyle} />}
      </Fragment>
    )
  }

  // Recursively render one level of the tree: child bins (each with their
  // subtree when expanded), then child tabs.
  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const childBins = bins.filter(b => b.parentId === parentId && showBin(b))
    const childTabs = tabs.filter(t => t.binId === parentId && showTab(t))
    const lineStyle = { marginLeft: depth * 16 + 6 }
    return (
      <>
        {childBins.map(bin => {
          const before = dnd.dropState?.kind === 'binReorder' && dnd.dropState.id === bin.id && !dnd.dropState.after
          const after = dnd.dropState?.kind === 'binReorder' && dnd.dropState.id === bin.id && dnd.dropState.after
          return (
            <Fragment key={bin.id}>
              {before && <div className="drop-line" style={lineStyle} />}
              <BinRow
                bin={bin}
                tabCount={tabCount.get(bin.id) ?? 0}
                depth={depth}
                expanded={searching || expanded.has(bin.id)}
                selected={sel.selectedBinId === bin.id}
                number={numberOf.get(bin.id)}
                editing={editing?.kind === 'bin' && editing.id === bin.id}
                dropInto={dnd.dropState?.kind === 'bin' && dnd.dropState.id === bin.id}
                dragging={dnd.draggingItem?.kind === 'bin' && dnd.draggingItem.id === bin.id}
                canSort={premium}
                sorting={sortingBinId === bin.id}
                onSelect={sel.selectBin}
                onOpen={nav.handleOpenBin}
                onOpenTabs={nav.handleOpenBinTabs}
                onSort={nav.handleSortBin}
                onStartEdit={nav.startEditBin}
                onCommitEdit={nav.handleCommitBinEdit}
                onCancelEdit={nav.cancelEdit}
                onDelete={nav.handleDeleteBin}
                onDragStart={(id, e) => dnd.startDrag('bin', id, e)}
                onDragOver={dnd.binDragOver}
                onDrop={dnd.itemDrop}
                onDragEnd={dnd.dragEnd}
              />
              {(searching || expanded.has(bin.id)) && renderLevel(bin.id, depth + 1)}
              {after && <div className="drop-line" style={lineStyle} />}
            </Fragment>
          )
        })}
        {childTabs.map((t, i) =>
          renderTab(t, depth, i === 0, i === childTabs.length - 1),
        )}
      </>
    )
  }

  const isEmpty = tabs.length === 0 && bins.length === 0
  const noMatches = searching && visibleItems.length === 0
  const resultCount = visibleItems.filter(it => it.kind === 'tab').length
  const tabWord = (n: number) => `${n} ${n === 1 ? 'tab' : 'tabs'}`

  return (
    <div className="nav-view" onDragOver={dnd.viewDragOver} onDrop={dnd.viewDrop}>

      <header className="nav-header">
        <span className="nav-logo">
          <img src="icons/icon-32.png" alt="" className="nav-logo-icon" />
          <span>Tangerine <b>Tab</b></span>
        </span>
        <div className="nav-header-right">
          {HEADER_OPS.map(({ op, label, Icon }) => (
            <button
              key={op}
              className="icon-btn"
              onClick={handlers[op]}
              title={`${label} (${displayKey(keybindings[op])})`}
            >
              <Icon size={17} strokeWidth={1.75} />
            </button>
          ))}
          <button
            className="icon-btn"
            onClick={onToggleScheme}
            title={scheme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {scheme === 'light' ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
          </button>
          <button className="icon-btn" onClick={onOpenPreferences} title="Preferences">
            <Settings size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="nav-search">
        <Search className="nav-search-icon" size={16} strokeWidth={2} />
        <input
          ref={searchRef}
          className="nav-search-input"
          placeholder={`Search ${tabs.length} saved ${tabs.length === 1 ? 'tab' : 'tabs'}`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {searching ? (
          <button className="nav-search-clear" onClick={clearSearch} title="Clear (Esc)">
            <X size={14} strokeWidth={2} />
          </button>
        ) : (
          <kbd className="search-kbd">{displayKey(keybindings.search)}</kbd>
        )}
      </div>

      <div className="list-label">
        <span className="list-label-title">{searching ? 'Results' : 'Stashed'}</span>
        <span className="list-label-count">
          {searching ? tabWord(resultCount) : tabWord(tabs.length)}
        </span>
      </div>

      <div
        className={`navigator-area${dnd.dropState?.kind === 'root' ? ' drop-root' : ''}`}
        onClick={sel.clear}
        onDragOver={dnd.rootDragOver}
      >
        {isEmpty ? (
          <div className="empty-state">
            <Layers size={36} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No stashed tabs</p>
            <p className="empty-hint">Stash a tab to get started</p>
          </div>
        ) : noMatches ? (
          <div className="empty-state">
            <Search size={32} className="empty-icon" strokeWidth={1.25} />
            <p className="empty-title">No matches</p>
            <p className="empty-hint">Nothing matches “{query.trim()}”</p>
          </div>
        ) : (
          <div className="tab-list">{renderLevel(null, 0)}</div>
        )}
      </div>

      <div className="action-bar">
        {/* Tidy Root: fuller name in aria-label / title for screen readers. */}
        {premium && (
          <button
            className="action-btn"
            onClick={nav.handleTidyRoot}
            disabled={tidyingRoot}
            aria-label="Tidy Root"
            title={`Tidy Root (${displayKey(keybindings.tidyRoot)})`}
          >
            {tidyingRoot ? (
              <LoaderCircle className="tab-spinner" size={16} strokeWidth={2} />
            ) : (
              <Sparkles className="action-btn-icon" size={16} strokeWidth={1.75} />
            )}
            <span>Tidy</span>
          </button>
        )}
        <button className="action-btn" onClick={handlers.stash} title="Stash this tab">
          <span>Stash</span>
          <kbd className="btn-kbd">{displayKey(keybindings.stash)}</kbd>
        </button>
        <button className="action-btn primary" onClick={handlers.stashAll} title="Stash and close all tabs">
          <span>Stash All</span>
          <kbd className="btn-kbd">{displayKey(keybindings.stashAll)}</kbd>
        </button>
      </div>

      <div className="status-bar">
        <span className="status-item"><kbd className="status-kbd">1–9</kbd>select</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.open)}</kbd>open</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.editName)}</kbd>rename</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.delete)}</kbd>delete</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.goBack)}</kbd>back</span>
      </div>

    </div>
  )
}
