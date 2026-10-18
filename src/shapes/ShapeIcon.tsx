import { PATHS, shapeById } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

interface ShapeIconProps {
  shape: ShapeId
  /** Width and height: a number of pixels, or a CSS length such as `100%`. */
  size?: number | string
  /** The text next to it already says what it is, so screen readers skip it. */
  decorative?: boolean
}

/** A shape in its own colour (the `--shape-*` tokens), named for screen readers. */
export function ShapeIcon({ shape, size = 64, decorative = false }: ShapeIconProps) {
  const { name } = shapeById(shape)
  return (
    <svg
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ stroke: `var(--shape-${shape})` }}
    >
      {PATHS[shape].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
