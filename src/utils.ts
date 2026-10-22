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

// Short "how long ago" label for a timestamp: now, 5m, 3h, 2d, 4w, 6mo, 1y.
export function timeAgo(then: number, now = Date.now()): string {
  const min = Math.floor((now - then) / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  if (day < 30) return `${Math.floor(day / 7)}w`
  if (day < 365) return `${Math.floor(day / 30)}mo`
  return `${Math.floor(day / 365)}y`
}
