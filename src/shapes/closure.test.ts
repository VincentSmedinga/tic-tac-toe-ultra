import { describe, expect, it } from 'vitest'
import { cornerFractions, closureOf } from './closure.ts'
import { pathLength } from './length.ts'
import { PATHS, SHAPES } from './shapes.ts'

describe('closureOf', () => {
  it('knows the four shapes that close on themselves, and no other', () => {
    const closed = SHAPES.filter(({ id }) => closureOf(id)).map(({ id }) => id)
    expect(closed).toEqual(['circle', 'square', 'diamond', 'oval'])
  })

  it('lets a loop start anywhere but in the hook where its line closes', () => {
    for (const id of ['circle', 'oval'] as const) {
      const closure = closureOf(id)
      if (closure?.kind !== 'loop') throw new Error(`${id} is a loop`)
      const d = PATHS[id][0] ?? ''
      const hook = d.slice(d.lastIndexOf('C'))
      const hookStart = d.slice(0, d.lastIndexOf('C'))
      // The hook is the last curve: everything from there on is not a place to start.
      const fraction = pathLength(hookStart) / pathLength(d)
      expect(closure.until).toBeLessThanOrEqual(fraction)
      expect(closure.until).toBeGreaterThan(0.8)
      expect(hook.startsWith('C')).toBe(true)
    }
  })

  it('puts the diamond down on one of its four corners', () => {
    const closure = closureOf('diamond')
    if (closure?.kind !== 'corners') throw new Error('the diamond has corners')
    expect(closure.at).toHaveLength(4)
    expect(closure.at[0]).toBe(0)
    expect([...closure.at].sort((a, b) => a - b)).toEqual(closure.at)
    // The tail that overshoots the first corner is not a corner of its own.
    expect(closure.at.at(-1)).toBeLessThan(0.85)
  })

  it('follows the strokes of the square round, in the order of its paths', () => {
    expect(closureOf('square')).toEqual({ kind: 'ring' })
    const square = PATHS.square
    const ends = square.map((d) => d.match(/-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?/g) ?? [])
    // Each stroke ends close to where the next one begins.
    for (const [i, stroke] of ends.entries()) {
      const next = ends[(i + 1) % ends.length]
      const [x1 = 0, y1 = 0] = (stroke.at(-1) ?? '').split(' ').map(Number)
      const [x2 = 0, y2 = 0] = (next?.[0] ?? '').split(' ').map(Number)
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeLessThan(8)
    }
  })
})

describe('cornerFractions', () => {
  it('measures how far along the line each point is', () => {
    expect(cornerFractions('M0 0 L10 0 L10 30')).toEqual([0, 0.25, 1])
  })
})
