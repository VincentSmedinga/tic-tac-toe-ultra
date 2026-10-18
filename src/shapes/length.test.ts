import { describe, expect, it } from 'vitest'
import { pathLength, strokeLengths } from './length.ts'
import { PATHS, SHAPES } from './shapes.ts'

describe('pathLength', () => {
  it('adds up straight lines and a closing line', () => {
    expect(pathLength('M0 0 L3 4')).toBeCloseTo(5)
    expect(pathLength('M0 0 L10 0 L10 10 Z')).toBeCloseTo(10 + 10 + Math.hypot(10, 10))
  })

  it('measures curves: a flat one is as long as the line it lies on, an arc is longer', () => {
    expect(pathLength('M0 0 C3 0 6 0 10 0')).toBeCloseTo(10)
    expect(pathLength('M0 0 Q5 0 10 0')).toBeCloseTo(10)
    expect(pathLength('M0 0 Q5 0 10 0 T20 0')).toBeCloseTo(20)
    expect(pathLength('M0 0 Q5 8 10 0')).toBeGreaterThan(10)
  })

  it('refuses a command it does not know, so a new kind of path is noticed', () => {
    expect(() => pathLength('M0 0 a1 1 0 0 1 2 2')).toThrow(RangeError)
  })
})

describe('strokeLengths', () => {
  it('has a length for every stroke of every shape, and none that is zero', () => {
    for (const { id } of SHAPES) {
      const lengths = strokeLengths(id)
      expect(lengths).toHaveLength(PATHS[id].length)
      for (const length of lengths) expect(length).toBeGreaterThan(5)
    }
  })

  it('tells a long stroke from a short one: the fort is much longer than the plus', () => {
    const total = (id: Parameters<typeof strokeLengths>[0]) =>
      strokeLengths(id).reduce((sum, length) => sum + length, 0)
    expect(total('fort')).toBeGreaterThan(total('plus'))
  })
})
