import type { ArrivalPlan } from './arrival.ts'

/** How a shape moves: written as with a marker, or (for people who want less motion) just faded in. */
export type MotionMode = 'full' | 'gentle'

/** How long the gentle fade takes. */
export const GENTLE_MS = 200

/**
 * Plays a plan on the SVG of a shape and returns what stops it. The shape is always drawn whole in
 * its own styles: the animation only hides what is not written yet, so cancelling it, or the end
 * of it, leaves the finished shape, and a browser without the Web Animations API (or a test)
 * simply shows the shape at once. Only the stroke's dash and opacity change, never a size or a
 * position, so nothing around the shape can move.
 *
 * The paths have `pathLength="1"`, so a dash of 1 is the whole stroke whatever its drawing.
 */
export function playArrival(svg: SVGSVGElement, plan: ArrivalPlan, mode: MotionMode): () => void {
  if (typeof svg.animate !== 'function') return () => undefined

  if (mode === 'gentle') {
    const fade = svg.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: GENTLE_MS,
      easing: 'ease-out',
      fill: 'backwards',
    })
    return () => {
      fade.cancel()
    }
  }

  const paths = svg.querySelectorAll<SVGPathElement>('path')
  const animations = plan.strokes.flatMap(({ path, reverse, delay, duration }) => {
    const element = paths[path]
    if (!element) return []
    // Gone at the start, the first moments faded in: a round cap would show a dot for a stroke
    // that has no length yet.
    const hidden = { strokeDasharray: '1 1', strokeDashoffset: reverse ? -1 : 1 }
    return [
      element.animate(
        [
          { ...hidden, opacity: 0 },
          { ...hidden, opacity: 1, offset: 0.03 },
          { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 1 },
        ],
        { delay, duration, easing: plan.easing, fill: 'backwards' },
      ),
    ]
  })
  return () => {
    for (const animation of animations) animation.cancel()
  }
}
