# Manual test checklist

Interactions to verify by hand. Load the built extension: `npm run build`, then
`chrome://extensions` → Developer Mode → Load unpacked → `dist/`. Reopen the
popup after the persistence checks.

## Stash & list
- [ ] Stash button saves the active tab and closes it; it appears in the list
- [ ] Stashed tab gets a clean smart name (site suffix stripped)
- [ ] Empty state shows when there are no tabs or bins
- [ ] Favicon shows; falls back to a globe icon when missing

## Tab interactions
- [ ] Single click selects a tab (accent highlight)
- [ ] Double click opens the tab in the browser
- [ ] Cmd/Ctrl-click toggles a tab in/out of the selection
- [ ] Shift-click range-selects
- [ ] Click empty area clears the selection
- [ ] `Enter` opens all selected tabs
- [ ] Hover → trash deletes a tab
- [ ] Edit name: hover pencil **or** `E` (one tab selected); `Enter` saves, `Escape` cancels, empty name is ignored

## Tab drag (reorder)
- [ ] Dragging shows an insertion line where the tab will land
- [ ] Releasing anywhere drops it where the line shows (overshoot to top/bottom works)
- [ ] Dragging back to the start cancels (no move)
- [ ] No snap-back lag on drop

## Bins
- [ ] New Bin button **or** `B` creates a bin → opens inline rename
- [ ] Single click selects **and** toggles open/closed (experimental)
- [ ] Double click renames; rapid clicks toggle cleanly
- [ ] `E` renames the selected bin; `Enter` toggles it open/closed
- [ ] Hover → pencil/trash rename/delete; deleting a bin moves its contents up to the parent (no data loss)
- [ ] Nested items are indented with a vertical guide line
- [ ] Hover/selection highlight starts after the guide line, with whitespace between rows

## Bin drag (move / nest / reorder)
- [ ] Drag a tab onto a bin → moves in; bin highlights and auto-expands
- [ ] Drag a tab to the empty area → moves out to root
- [ ] Drag a bin onto another bin: top/bottom edge reorders, middle nests inside
- [ ] Drag a bin to the empty area → un-nests to root
- [ ] Cycle guard: dropping a bin onto its own child does nothing
- [ ] Nested bins render recursively, indented per level

## Preferences
- [ ] Gear opens Preferences; back arrow returns
- [ ] Theme grid: selecting a theme applies it instantly, shows a checkmark, and persists
- [ ] Set Extension Shortcut opens `chrome://extensions/shortcuts`
- [ ] Rebind a hotkey (click key → press new combo); the new key works in the navigator
- [ ] Reset to defaults restores the original hotkeys

## Persistence (reopen the popup)
- [ ] Stashed tabs and bins persist
- [ ] Bin nesting / tab placement persists
- [ ] Selected theme persists
- [ ] Custom hotkeys persist
