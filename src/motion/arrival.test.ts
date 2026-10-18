import { describe, expect, it } from 'vitest'
import { ARRIVAL_VARIANTS, MAX_ARRIVAL_MS, arrivalPlan, arrivalVariant } from './arrival.ts'

const moves = Array.from({ length: 60 }, (_, move) => move)

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
    expect(arrivalPlan(11, 3, 3)).toEqual(arrivalPlan(11, 3, 3))
    const plans = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(arrivalPlan(seed, 3, 3))),
    )
    expect(plans.size).toBeGreaterThan(15)
  })

  it('does not draw the same way twice: not even with the same seed on the next move', () => {
    const [first, second] = [arrivalPlan(11, 0, 2), arrivalPlan(11, 1, 2)]
    expect(first.variant).not.toBe(second.variant)
    expect(first.strokes).not.toEqual(second.strokes)
  })

  it('draws every stroke of the shape exactly once', () => {
    for (const count of [1, 2, 3, 4, 5]) {
      const paths = arrivalPlan(8, 2, count).strokes.map(({ path }) => path)
      expect([...paths].sort()).toEqual(Array.from({ length: count }, (_, path) => path))
    }
  })

  it('varies the order and the direction of the strokes', () => {
    const plans = Array.from({ length: 60 }, (_, seed) => arrivalPlan(seed, 0, 2))
    expect(new Set(plans.map(({ strokes }) => strokes[0]?.path))).toEqual(new Set([0, 1]))
    const reversed = plans.flatMap(({ strokes }) => strokes.map(({ reverse }) => reverse))
    expect(reversed).toContain(true)
    expect(reversed).toContain(false)
  })

  it('stays within ranges, so that nothing looks broken or holds the game up', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const count of [1, 2, 3, 4, 6]) {
        const plan = arrivalPlan(seed, seed % 7, count)
        expect(plan.strokes[0]?.delay).toBe(0)
        for (const { delay, duration } of plan.strokes) {
          expect(delay).toBeGreaterThanOrEqual(0)
          expect(duration).toBeGreaterThanOrEqual(100)
          expect(duration).toBeLessThanOrEqual(620)
          expect(delay + duration).toBeLessThanOrEqual(MAX_ARRIVAL_MS)
        }
      }
    }
  })

  it('writes a shape with many strokes faster, not longer', () => {
    const plan = arrivalPlan(3, 1, 12)
    const end = Math.max(...plan.strokes.map(({ delay, duration }) => delay + duration))
    expect(end).toBeLessThanOrEqual(MAX_ARRIVAL_MS)
  })
})
