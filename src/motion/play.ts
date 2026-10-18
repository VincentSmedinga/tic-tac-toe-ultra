import type { ArrivalPlan } from './arrival.ts'

/** How a shape moves: written as with a marker, or (for people who want less motion) just faded in. */
export type MotionMode = 'full' | 'gentle'

/** How long the gentle fade takes. */
export const GENTLE_MS = 200

/**
 * The keyframes of a stroke that is written from a point `from` along it, round the end and on from
 * the other end, up to `from` again (a circle that is not started where its line starts). A dash
 * as long as the part that is written, in a pattern as long as the stroke itself, so that the
 * dash comes round at the other end by itself: the pattern is `written, rest`, which grows from
 * `0 1` to `1 0`, and its offset puts the dash at `from` (forward) or ends it there (backward).
 */
function wrapped(from: number, reverse: boolean): Keyframe[] {
  const shown = (written: number) => ({
    strokeDasharray: `${written} ${1 - written}`,
    // The pattern starts `offset` before the line does: the dash begins at -offset.
    strokeDashoffset: reverse ? written - from : -from,
  })
  return [
    { ...shown(0), opacity: 0 },
    { ...shown(0.03), opacity: 1, offset: 0.03 },
    { ...shown(1), opacity: 1 },
  ]
}

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
  const animations = plan.strokes.flatMap(({ path, reverse, from, delay, duration }) => {
    const element = paths[path]
    if (!element) return []
    // Gone at the start, the first moments faded in: a round cap would show a dot for a stroke
    // that has no length yet.
    const hidden = { strokeDasharray: '1 1', strokeDashoffset: reverse ? -1 : 1 }
    const keyframes: Keyframe[] =
      from === undefined
        ? [
            { ...hidden, opacity: 0 },
            { ...hidden, opacity: 1, offset: 0.03 },
            { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 1 },
          ]
        : wrapped(from, reverse)
    return [element.animate(keyframes, { delay, duration, easing: plan.easing, fill: 'backwards' })]
  })
  return () => {
    for (const animation of animations) animation.cancel()
  }
}
