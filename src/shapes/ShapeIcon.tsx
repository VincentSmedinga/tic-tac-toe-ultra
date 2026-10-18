import { useLayoutEffect, useRef } from 'react'
import type { ArrivalPlan } from '../motion/arrival.ts'
import { playArrival } from '../motion/play.ts'
import type { MotionMode } from '../motion/play.ts'
import { useShapeNames } from './names.ts'
import { PATHS } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

interface ShapeIconProps {
  shape: ShapeId
  /** Width and height: a number of pixels, or a CSS length such as `100%`. */
  size?: number | string
  /** The text next to it already says what it is, so screen readers skip it. */
  decorative?: boolean
  /**
   * The shape has just been placed: it is written on the field the way the plan says (or faded in).
   * Taking the prop away, or replacing it, stops the animation at once and leaves the whole shape.
   */
  arrival?: { plan: ArrivalPlan; mode: MotionMode }
}

/** A shape in its own colour (the `--shape-*` tokens), named for screen readers. */
export function ShapeIcon({ shape, size = 64, decorative = false, arrival }: ShapeIconProps) {
  const name = useShapeNames().name(shape)
  const svg = useRef<SVGSVGElement>(null)
  const plan = arrival?.plan
  const mode = arrival?.mode

  // Before the first paint, so that the whole shape is never seen for a moment before it is written.
  useLayoutEffect(() => {
    if (!svg.current || !plan || !mode) return
    return playArrival(svg.current, plan, mode)
  }, [plan, mode])

  return (
    <svg
      ref={svg}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name })}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ stroke: `var(--shape-${shape})` }}
      data-arrival={plan?.variant}
    >
      {PATHS[shape].map((d) => (
        <path key={d} d={d} pathLength={1} />
      ))}
    </svg>
  )
}
