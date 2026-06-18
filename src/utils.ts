export const displayKey = (key: string): string =>
  key
    .replace('Backspace', '⌫')
    .replace('Enter', '↵')
    .replace('Escape', 'Esc')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('Ctrl+', '⌃')
    .replace('Shift+', '⇧')
    .replace('Alt+', '⌥')

export const captureKey = (e: KeyboardEvent): string | null => {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const mods: string[] = []
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  return [...mods, key].join('+')
}
