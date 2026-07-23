import { BrushCleaning, Sparkles } from 'lucide-react'

// The "tidy / AI-sort" glyph: a sweeping brush with sparkles twinkling off its
// top-right corner. Composed from two lucide icons (we never hand-author SVG) so
// the bottom Tidy Root button and the per-bin sort button share one exact mark.
// The brush's handle sits top-center and its bristles fill the bottom, leaving
// the top-right corner empty — that's where the sparkles go.
type Props = { size?: number; strokeWidth?: number }

export default function TidyIcon({ size = 15, strokeWidth = 1.75 }: Props) {
  const sparkleSize = Math.round(size * 0.62)
  const nudge = Math.round(size * 0.13) // pull the sparkles out toward the corner
  return (
    <span
      className="tidy-icon"
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <BrushCleaning size={size} strokeWidth={strokeWidth} />
      <Sparkles
        size={sparkleSize}
        strokeWidth={strokeWidth}
        style={{ position: 'absolute', top: -nudge, right: -nudge }}
        aria-hidden="true"
      />
    </span>
  )
}
