import { describe, expect, it } from 'vitest'
import { isRing } from './closure.ts'
import { PATHS, SHAPES } from './shapes.ts'

describe('isRing', () => {
  it('is the square only', () => {
    expect(SHAPES.filter(({ id }) => isRing(id)).map(({ id }) => id)).toEqual(['square'])
  })

  it('has strokes that follow each other round, in the order of its paths', () => {
    const ends = PATHS.square.map((d) => d.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?/g) ?? [])
    // Each stroke ends close to where the next one begins.
    for (const [i, stroke] of ends.entries()) {
      const next = ends[(i + 1) % ends.length]
      const [x1 = 0, y1 = 0] = (stroke.at(-1) ?? '').split(' ').map(Number)
      const [x2 = 0, y2 = 0] = (next?.[0] ?? '').split(' ').map(Number)
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeLessThan(8)
    }
  })
})
