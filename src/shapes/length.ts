import { PATHS } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

type Point = readonly [number, number]

const STEPS = 24

const distance = ([ax, ay]: Point, [bx, by]: Point) => Math.hypot(bx - ax, by - ay)

/** The length of a Bézier curve, as a polyline of many small steps. */
function curveLength(points: readonly Point[]): number {
  const at = (t: number): Point => {
    let level = points
    while (level.length > 1) {
      level = level.slice(1).map(([x, y], i) => {
        const [px, py] = level[i] ?? [0, 0]
        return [px + (x - px) * t, py + (y - py) * t] as const
      })
    }
    return level[0] ?? [0, 0]
  }
  let length = 0
  let previous = at(0)
  for (let step = 1; step <= STEPS; step++) {
    const next = at(step / STEPS)
    length += distance(previous, next)
    previous = next
  }
  return length
}

/**
 * How long a path is, in the units of its drawing. It reads the commands the shapes use (M, L, C, Q,
 * T and Z, all absolute) and throws at any other, so a new kind of path can't be forgotten. It is
 * what lets a shape be written at one speed whatever its strokes are: a browser has the same
 * `getTotalLength`, but the picker is plain TypeScript that works without one.
 */
export function pathLength(d: string): number {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? []
  let command = ''
  let at: Point = [0, 0]
  let start: Point = [0, 0]
  // The last control point of a quadratic curve, which T mirrors.
  let control: Point | undefined
  let length = 0
  let i = 0

  const number = () => {
    const value = Number(tokens[i++])
    if (Number.isNaN(value)) throw new RangeError(`bad path: ${d}`)
    return value
  }
  const point = (): Point => [number(), number()]

  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (/[A-Za-z]/.test(token)) {
      command = token
      i++
    }
    if (command === 'Z') {
      length += distance(at, start)
      at = start
      control = undefined
      continue
    }
    if (command === 'M') {
      at = start = point()
      control = undefined
      command = 'L'
    } else if (command === 'L') {
      const to = point()
      length += distance(at, to)
      at = to
      control = undefined
    } else if (command === 'C') {
      const [a, b, to] = [point(), point(), point()]
      length += curveLength([at, a, b, to])
      at = to
      control = undefined
    } else if (command === 'Q') {
      const [a, to] = [point(), point()]
      length += curveLength([at, a, to])
      at = to
      control = a
    } else if (command === 'T') {
      const to = point()
      const a: Point = control ? [2 * at[0] - control[0], 2 * at[1] - control[1]] : at
      length += curveLength([at, a, to])
      at = to
      control = a
    } else {
      throw new RangeError(`path command ${command} is not supported: ${d}`)
    }
  }
  return length
}

const cache = new Map<ShapeId, readonly number[]>()

/** The length of each stroke of a shape (see `PATHS`), in the order of its paths. */
export function strokeLengths(shape: ShapeId): readonly number[] {
  let lengths = cache.get(shape)
  if (!lengths) {
    lengths = PATHS[shape].map(pathLength)
    cache.set(shape, lengths)
  }
  return lengths
}
