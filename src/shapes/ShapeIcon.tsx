import { PATHS, shapeById } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

interface ShapeIconProps {
  shape: ShapeId
  /** Width and height in pixels. */
  size?: number
}

/** A shape in its own colour (the `--shape-*` tokens), named for screen readers. */
export function ShapeIcon({ shape, size = 64 }: ShapeIconProps) {
  const { name } = shapeById(shape)
  return (
    <svg
      role="img"
      aria-label={name}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={5}
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
