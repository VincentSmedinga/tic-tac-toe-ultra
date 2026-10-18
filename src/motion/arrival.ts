import { between, createRandom, oneOf, seedFrom, shuffled } from './random.ts'
import type { Random } from './random.ts'

/**
 * How a shape gets onto the field: it is written, stroke by stroke, as with a marker. Every move
 * gets a variant and details of its own, so it is never exactly the same twice, like a hand that
 * never draws the same line twice. Nothing here knows about React or the browser: it picks, and
 * `play.ts` plays what was picked.
 *
 * Everything is a function of (seed, number of the move, the strokes and whether they go round): the
 * same seed gives the same plan, which is what lets a test fix it and, later, lets a replay write a game the way it
 * was written live.
 */

/** The ways to write a shape: they differ in rhythm and speed. */
export const ARRIVAL_VARIANTS = ['steady', 'hasty', 'deliberate'] as const
export type ArrivalVariant = (typeof ARRIVAL_VARIANTS)[number]

/** One stroke of a shape, in the order the plan draws it. */
export interface StrokePlan {
  /** Which path of the shape (an index into its paths). */
  readonly path: number
  /** Drawn from its end to its start. */
  readonly reverse: boolean
  /** Milliseconds from the start of the arrival until this stroke begins. */
  readonly delay: number
  /** Milliseconds the stroke takes. */
  readonly duration: number
}

export interface ArrivalPlan {
  readonly variant: ArrivalVariant
  readonly easing: string
  readonly strokes: readonly StrokePlan[]
}

interface Rhythm {
  /** How long the whole shape takes, from the first stroke starting to the last one ending. */
  readonly total: readonly [number, number]
  /** Milliseconds between the end of one stroke and the start of the next. */
  readonly gap: readonly [number, number]
  /** How much of a stroke is still going on when the next one starts, as a fraction of it. */
  readonly overlap: readonly [number, number]
  readonly easing: string
}

const RHYTHMS: Record<ArrivalVariant, Rhythm> = {
  // One stroke after the other, back to back.
  steady: { total: [850, 950], gap: [0, 40], overlap: [0, 0], easing: 'ease-in-out' },
  // A little quicker, the next stroke already begun before the last one is done.
  hasty: { total: [800, 900], gap: [0, 0], overlap: [0.25, 0.5], easing: 'ease-out' },
  // Slower, with a small pause to look at the page before the next stroke.
  deliberate: { total: [900, 1000], gap: [60, 140], overlap: [0, 0], easing: 'ease-in-out' },
}

/**
 * Every shape takes about the same time to write, between these two, whatever it is: a cross of two
 * strokes, a star of one long line, the many strokes of the gold bar. So the time is chosen first
 * and divided over the strokes by their length, which gives them all one speed: a long stroke is
 * not drawn faster than a short one. Short enough for the next player not to wait.
 */
export const MIN_ARRIVAL_MS = 800
export const MAX_ARRIVAL_MS = 1000

/** How much the speed of one stroke may differ from the others': a hand is never even. */
const JITTER = 0.1

function pickVariant(random: Random, previous: ArrivalVariant | undefined): ArrivalVariant {
  return oneOf(
    random,
    ARRIVAL_VARIANTS.filter((variant) => variant !== previous),
  )
}

/**
 * The variant of the move with this number (0 is the first move of a game). It is never the one
 * of the move before it, which is why it is worked out from the first move on.
 */
export function arrivalVariant(seed: number, move: number): ArrivalVariant {
  let variant: ArrivalVariant | undefined
  for (let i = 0; i <= move; i++) variant = pickVariant(createRandom(seedFrom(seed, i, 1)), variant)
  if (variant === undefined) throw new RangeError('a move has a number of 0 or more')
  return variant
}

/**
 * Strokes that follow each other round a shape (the square) are written going round: from a stroke
 * at random, one way or the other, every stroke in that direction. That is four sides and two
 * directions, eight ways to start. It has a generator of its own, so it never changes the rhythm or
 * the jitter of the plan.
 */
function ringOrder(random: Random, strokes: number) {
  const first = Math.floor(random() * strokes)
  const reverse = random() < 0.5
  const step = reverse ? strokes - 1 : 1
  return {
    order: Array.from({ length: strokes }, (_, i) => (first + i * step) % strokes),
    reverse,
  }
}

/**
 * The plan for writing the shape of the move with this number, whose strokes are this long (only
 * their lengths relative to each other matter; see `strokeLengths`). With `ring`, the strokes follow
 * each other round the shape (`isRing`) and are written in that order.
 */
export function arrivalPlan(
  seed: number,
  move: number,
  lengths: readonly number[],
  ring = false,
): ArrivalPlan {
  const variant = arrivalVariant(seed, move)
  const rhythm = RHYTHMS[variant]
  const random = createRandom(seedFrom(seed, move, 2))
  const round =
    ring && lengths.length > 1
      ? ringOrder(createRandom(seedFrom(seed, move, 3)), lengths.length)
      : undefined
  const order =
    round?.order ??
    shuffled(
      random,
      lengths.map((_, path) => path),
    )
  const total = between(random, ...rhythm.total)

  // What each stroke weighs in the time: its length, a little off, since a hand is never even.
  const weights = order.map(
    (path) => (lengths[path] ?? 1) * between(random, 1 - JITTER, 1 + JITTER),
  )
  // The joins between one stroke and the next.
  const joins = weights.slice(1).map(() => ({
    gap: between(random, ...rhythm.gap),
    overlap: between(random, ...rhythm.overlap),
  }))

  // total = k × (the weights, less what overlaps) + the gaps: k is the milliseconds per unit of weight.
  const gaps = joins.reduce((sum, { gap }) => sum + gap, 0)
  const weight = weights.reduce((sum, w, i) => sum - (joins[i]?.overlap ?? 0) * w + w, 0)
  const speed = (total - gaps) / weight

  let delay = 0
  const strokes = order.map((path, i): StrokePlan => {
    const duration = (weights[i] ?? 0) * speed
    const reverse = random() < 0.5
    const stroke: StrokePlan = {
      path,
      reverse: round?.reverse ?? reverse,
      delay: Math.round(delay),
      duration: Math.round(duration),
    }
    const join = joins[i]
    if (join) delay += duration * (1 - join.overlap) + join.gap
    return stroke
  })
  return { variant, easing: rhythm.easing, strokes }
}

/** The moment the last stroke of a plan is done, in milliseconds from its start. */
export function arrivalEnd(plan: ArrivalPlan): number {
  return Math.max(0, ...plan.strokes.map(({ delay, duration }) => delay + duration))
}
