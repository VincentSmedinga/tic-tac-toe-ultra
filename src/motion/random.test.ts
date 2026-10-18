import { describe, expect, it } from 'vitest'
import { between, createRandom, oneOf, seedFrom, shuffled } from './random.ts'

const take = (seed: number, count = 8) => {
  const random = createRandom(seed)
  return Array.from({ length: count }, () => random())
}

describe('createRandom', () => {
  it('gives the same numbers for the same seed, and other numbers for another', () => {
    expect(take(7)).toEqual(take(7))
    expect(take(7)).not.toEqual(take(8))
  })

  it('stays in [0, 1)', () => {
    for (const value of take(123, 2000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('seedFrom', () => {
  it('is the same for the same numbers and not for the same numbers in another order', () => {
    expect(seedFrom(3, 0)).toBe(seedFrom(3, 0))
    expect(seedFrom(3, 0)).not.toBe(seedFrom(0, 3))
  })
})

describe('the helpers', () => {
  it('between stays within its range', () => {
    const random = createRandom(1)
    for (let i = 0; i < 500; i++) {
      const value = between(random, 5, 9)
      expect(value).toBeGreaterThanOrEqual(5)
      expect(value).toBeLessThan(9)
    }
  })

  it('oneOf picks every item in the end, and refuses an empty list', () => {
    const random = createRandom(2)
    const seen = new Set(Array.from({ length: 200 }, () => oneOf(random, ['a', 'b', 'c'])))
    expect(seen).toEqual(new Set(['a', 'b', 'c']))
    expect(() => oneOf(random, [])).toThrow(RangeError)
  })

  it('shuffled keeps every item once and leaves the original alone', () => {
    const items = [1, 2, 3, 4, 5]
    const result = shuffled(createRandom(3), items)
    expect([...result].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })
})
