import { between, createRandom, oneOf, seedFrom, shuffled } from './random.ts'
import type { Random } from './random.ts'

/**
 * How a shape gets onto the field: it is written, stroke by stroke, as with a marker. Every move
 * gets a variant and details of its own, so it is never exactly the same twice, like a hand that
 * never draws the same line twice. Nothing here knows about React or the browser: it picks, and
 * `play.ts` plays what was picked.
 *
 * Everything is a function of (seed, number of the move, number of strokes): the same seed gives
 * the same plan, which is what lets a test fix it and, later, lets a replay write a game the way it
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
  readonly duration: readonly [number, number]
  /** Milliseconds between the end of one stroke and the start of the next; negative overlaps. */
  readonly gap: readonly [number, number]
  readonly easing: string
}

const RHYTHMS: Record<ArrivalVariant, Rhythm> = {
  // One stroke after the other, back to back.
  steady: { duration: [300, 420], gap: [0, 40], easing: 'ease-in-out' },
  // Quick, the next stroke already begun before the last one is done.
  hasty: { duration: [160, 260], gap: [-90, -30], easing: 'ease-out' },
  // Slower, with a small pause to look at the page before the next stroke.
  deliberate: { duration: [380, 520], gap: [60, 140], easing: 'ease-in-out' },
}

/** However many strokes a shape has, it is written within this time: the next player does not wait. */
export const MAX_ARRIVAL_MS = 1100

/** How much the speed of one stroke may differ from the variant's: a hand is never even. */
const JITTER = 0.15

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

/** The plan for writing the shape of the move with this number, which has this many strokes. */
export function arrivalPlan(seed: number, move: number, strokeCount: number): ArrivalPlan {
  const variant = arrivalVariant(seed, move)
  const rhythm = RHYTHMS[variant]
  const random = createRandom(seedFrom(seed, move, 2))
  const order = shuffled(
    random,
    Array.from({ length: strokeCount }, (_, path) => path),
  )

  let clock = 0
  const strokes = order.map((path): StrokePlan => {
    const duration = between(random, ...rhythm.duration) * between(random, 1 - JITTER, 1 + JITTER)
    const stroke = { path, reverse: random() < 0.5, delay: Math.max(0, clock), duration }
    clock += duration + between(random, ...rhythm.gap)
    return stroke
  })

  // A shape with many strokes (the gold bar) is written faster, not longer.
  const total = strokes.reduce((end, { delay, duration }) => Math.max(end, delay + duration), 0)
  const scale = total > MAX_ARRIVAL_MS ? MAX_ARRIVAL_MS / total : 1
  return {
    variant,
    easing: rhythm.easing,
    strokes: strokes.map(({ path, reverse, delay, duration }) => ({
      path,
      reverse,
      delay: Math.round(delay * scale),
      duration: Math.round(duration * scale),
    })),
  }
}
