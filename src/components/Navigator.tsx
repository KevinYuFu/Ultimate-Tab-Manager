import { Layers, LoaderCircle, Search, Settings, Sparkles, X } from 'lucide-react'
import { Fragment, useEffect } from 'react'
import type { Keybindings, Operation, Tab } from '../types'
import { displayKey } from '../utils'
import { useNavigator } from '../hooks/useNavigator'
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
]

type Props = {
  keybindings: Keybindings
  stashAllOpensFullView: boolean
  onOpenPreferences: () => void
}

export default function Navigator({
  keybindings,
  stashAllOpensFullView,
  onOpenPreferences,
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

  return (
    <div className="nav-view" onDragOver={dnd.viewDragOver} onDrop={dnd.viewDrop}>

      <header className="nav-header">
        <span className="nav-logo">
          <img src="icons/icon-32.png" alt="" className="nav-logo-icon" />
          Tangerine Tab
        </span>
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

      <div className="nav-search">
        <Search className="nav-search-icon" size={14} strokeWidth={2} />
        <input
          ref={searchRef}
          className="nav-search-input"
          placeholder="Search tabs and bins…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {searching && (
          <button className="nav-search-clear" onClick={clearSearch} title="Clear (Esc)">
            <X size={14} strokeWidth={2} />
          </button>
        )}
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
        {SECONDARY.map(({ op, label }) => (
          <button
            key={op}
            className="action-btn"
            onClick={handlers[op]}
            disabled={!handlers[op]}
          >
            <kbd className="btn-kbd">{displayKey(keybindings[op])}</kbd>
            <span>{label}</span>
          </button>
        ))}
        {/* Tidy Root: broom icon + short "Tidy" label; fuller name in aria-label
            / title for screen readers and the tooltip. */}
        {premium && (
          <button
            className="action-btn"
            onClick={nav.handleTidyRoot}
            disabled={tidyingRoot}
            aria-label="Tidy Root"
            title="Tidy Root"
          >
            {tidyingRoot ? (
              <LoaderCircle className="tab-spinner" size={15} strokeWidth={2} />
            ) : (
              <Sparkles size={15} strokeWidth={1.75} />
            )}
            <span>Tidy</span>
          </button>
        )}
      </div>

      <div className="status-bar">
        <span className="status-item"><kbd className="status-kbd">1–9</kbd>select</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.open)}</kbd>open</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.goBack)}</kbd>back</span>
        <span className="status-item"><kbd className="status-kbd">{displayKey(keybindings.delete)}</kbd>delete</span>
      </div>

    </div>
  )
}
