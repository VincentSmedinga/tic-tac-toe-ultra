import { describe, expect, it } from 'vitest'
import { strokeLengths } from '../shapes/length.ts'
import { SHAPES } from '../shapes/shapes.ts'
import {
  ARRIVAL_VARIANTS,
  MAX_ARRIVAL_MS,
  MIN_ARRIVAL_MS,
  arrivalPlan,
  arrivalVariant,
} from './arrival.ts'

const moves = Array.from({ length: 60 }, (_, move) => move)
const cross = strokeLengths('cross')
const end = (plan: ReturnType<typeof arrivalPlan>) =>
  Math.max(...plan.strokes.map(({ delay, duration }) => delay + duration))

describe('arrivalVariant', () => {
  it('is never the variant of the move before it', () => {
    for (const seed of [0, 1, 2, 99, 123456]) {
      for (const move of moves.slice(1)) {
        expect(arrivalVariant(seed, move)).not.toBe(arrivalVariant(seed, move - 1))
      }
    }
  })

  it('gives every variant now and then', () => {
    const seen = new Set(moves.map((move) => arrivalVariant(5, move)))
    expect(seen).toEqual(new Set(ARRIVAL_VARIANTS))
  })

  it('is the same for the same seed and move, whatever was asked before', () => {
    arrivalVariant(4, 30)
    expect(arrivalVariant(4, 12)).toBe(arrivalVariant(4, 12))
  })
})

describe('arrivalPlan', () => {
  it('gives the same plan for the same seed, and others for other seeds', () => {
    expect(arrivalPlan(11, 3, strokeLengths('waves'))).toEqual(
      arrivalPlan(11, 3, strokeLengths('waves')),
    )
    const plans = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        JSON.stringify(arrivalPlan(seed, 3, strokeLengths('waves'))),
      ),
    )
    expect(plans.size).toBeGreaterThan(15)
  })

  it('does not draw the same way twice: not even with the same seed on the next move', () => {
    const [first, second] = [arrivalPlan(11, 0, cross), arrivalPlan(11, 1, cross)]
    expect(first.variant).not.toBe(second.variant)
    expect(first.strokes).not.toEqual(second.strokes)
  })

  it('draws every stroke of the shape exactly once', () => {
    for (const { id } of SHAPES) {
      const lengths = strokeLengths(id)
      const paths = arrivalPlan(8, 2, lengths).strokes.map(({ path }) => path)
      expect([...paths].sort()).toEqual(lengths.map((_, path) => path))
    }
  })

  it('varies the order and the direction of the strokes', () => {
    const plans = Array.from({ length: 60 }, (_, seed) => arrivalPlan(seed, 0, cross))
    expect(new Set(plans.map(({ strokes }) => strokes[0]?.path))).toEqual(new Set([0, 1]))
    const reversed = plans.flatMap(({ strokes }) => strokes.map(({ reverse }) => reverse))
    expect(reversed).toContain(true)
    expect(reversed).toContain(false)
  })

  it('takes the same time for every shape, however its strokes are: 0.8 to 1 second', () => {
    for (const { id } of SHAPES) {
      for (let seed = 0; seed < 100; seed++) {
        const plan = arrivalPlan(seed, seed % 9, strokeLengths(id))
        expect(plan.strokes[0]?.delay).toBe(0)
        expect(end(plan)).toBeGreaterThanOrEqual(MIN_ARRIVAL_MS - 3)
        expect(end(plan)).toBeLessThanOrEqual(MAX_ARRIVAL_MS + 3)
        for (const { delay, duration } of plan.strokes) {
          expect(delay).toBeGreaterThanOrEqual(0)
          expect(duration).toBeGreaterThan(0)
        }
      }
    }
  })

  it('does not draw a long stroke faster than a short one', () => {
    const lengths = [200, 50, 100]
    for (let seed = 0; seed < 100; seed++) {
      // Milliseconds per unit of length, stroke by stroke: they differ by the jitter alone.
      const speeds = arrivalPlan(seed, 0, lengths).strokes.map(
        ({ path, duration }) => duration / (lengths[path] ?? 1),
      )
      expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(1.35)
    }
  })

  it('takes as long for the star, a single long line, as for the fort and the gold bar', () => {
    const ends = (['star', 'fort', 'goldbar', 'cross', 'waves'] as const).map((id) => {
      const total = Array.from({ length: 200 }, (_, seed) =>
        end(arrivalPlan(seed, 0, strokeLengths(id))),
      )
      return total.reduce((sum, value) => sum + value, 0) / total.length
    })
    expect(Math.max(...ends) - Math.min(...ends)).toBeLessThan(60)
  })
})
