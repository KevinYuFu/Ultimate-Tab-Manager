// Derive a clean display name from a raw tab title by stripping the trailing
// site-name segment. e.g. "My Video - YouTube" -> "My Video",
// "Article | The Atlantic" -> "Article". Falls back to the raw title.

const SEPARATORS = [' - ', ' | ', ' — ', ' – ', ' · ', ' :: ', ' • ']

export function smartName(title: string | undefined, fallbackUrl: string): string {
  const trimmed = (title ?? '').trim()
  if (!trimmed) {
    // No title — fall back to the URL's hostname, then the raw URL.
    try {
      return new URL(fallbackUrl).hostname || fallbackUrl
    } catch {
      return fallbackUrl || 'Untitled'
    }
  }

  for (const sep of SEPARATORS) {
    const idx = trimmed.lastIndexOf(sep)
    if (idx > 0) {
      const head = trimmed.slice(0, idx).trim()
      // Only strip if the part before the separator is substantial; otherwise
      // the separator was likely part of the real title.
      if (head.length >= 3) return head
    }
  }

  return trimmed
}
