import { pathLength } from './length.ts'
import { PATHS } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

/**
 * Where a hand may put the marker down on a shape that closes on itself, so that it doesn't start
 * at the same point every time. This is only about how the shape is written: the drawing in
 * `PATHS` is never touched, and the finished shape is the same whatever the start.
 *
 * - `loop`: one line that goes round (the circle, the oval). The pen may land anywhere from the
 *   start of the line up to `until`, a fraction of its length; the last bit is the hook where the
 *   line closes, and landing in it would start the shape inside itself.
 * - `corners`: one line with corners (the diamond). The pen lands on one of them, at these
 *   fractions of the line's length.
 * - `ring`: strokes that follow each other round the shape (the square): in the order of its paths.
 */
export type Closure =
  | { readonly kind: 'loop'; readonly until: number }
  | { readonly kind: 'corners'; readonly at: readonly number[] }
  | { readonly kind: 'ring' }

/** The fractions of a line's length at which each of its corners lies, the start included. */
export function cornerFractions(d: string): readonly number[] {
  const commands = d.split(/(?=[A-Za-z])/).filter((command) => command.trim() !== '')
  const total = pathLength(d)
  const fractions: number[] = []
  let prefix = ''
  for (const command of commands) {
    prefix += command
    fractions.push(pathLength(prefix) / total)
  }
  return fractions
}

/** The corners the diamond is started from: the four of its outline, not the tail that overshoots. */
function diamondCorners(): readonly number[] {
  // M56 28 L34 56 L8 36 L33 8 L60 32: the last point is only the overshoot past the first corner.
  return cornerFractions(PATHS.diamond[0] ?? '').slice(0, 4)
}

const CLOSURES: Partial<Record<ShapeId, Closure>> = {
  // The last curve of each is the hook; the lines are about 190 and 150 units long, the hooks 17 and 8.
  circle: { kind: 'loop', until: 0.87 },
  oval: { kind: 'loop', until: 0.92 },
  square: { kind: 'ring' },
  diamond: { kind: 'corners', at: diamondCorners() },
}

/** How a shape that closes on itself may be started, or undefined for a shape that doesn't. */
export function closureOf(shape: ShapeId): Closure | undefined {
  return CLOSURES[shape]
}
