import { describe, expect, it } from 'vitest'
import { FIELD_LIMITS, FIELD_PRESETS, isValidField, oddNumbers } from '../../shared/room.ts'
import { fieldLabel, isClassic, longestRow, presetOf, suggestedRow } from './field.ts'

describe('fieldLabel', () => {
  it('says how big the field is and how many in a row win, in words', () => {
    expect(fieldLabel({ width: 3, height: 3, winLength: 3 })).toBe('3 × 3, drie op een rij')
    expect(fieldLabel({ width: 7, height: 5, winLength: 5 })).toBe('7 × 5, vijf op een rij')
    expect(fieldLabel({ width: 19, height: 19, winLength: 9 })).toBe('19 × 19, negen op een rij')
  })
})

describe('the classic field and the presets', () => {
  it('knows the classic field', () => {
    expect(isClassic({ width: 3, height: 3, winLength: 3 })).toBe(true)
    expect(isClassic({ width: 5, height: 3, winLength: 3 })).toBe(false)
  })

  it('has presets that a room accepts, all odd, and finds them back', () => {
    for (const preset of FIELD_PRESETS) {
      expect(isValidField(preset), preset.id).toBe(true)
      expect(presetOf(preset)).toBe(preset.id)
    }
    expect(presetOf({ width: 9, height: 9, winLength: 5 })).toBeNull()
  })
})

describe('the odd numbers', () => {
  it('are the sides and rows a room allows, and nothing else', () => {
    expect(oddNumbers(FIELD_LIMITS.minSide, FIELD_LIMITS.maxSide)).toEqual([
      3, 5, 7, 9, 11, 13, 15, 17, 19,
    ])
    expect(oddNumbers(FIELD_LIMITS.minWin, FIELD_LIMITS.maxWin)).toEqual([3, 5, 7, 9])
  })

  it('make the longest row the biggest odd number that fits', () => {
    expect(longestRow({ width: 3, height: 3 })).toBe(3)
    expect(longestRow({ width: 5, height: 3 })).toBe(5)
    expect(longestRow({ width: 7, height: 7 })).toBe(7)
    expect(longestRow({ width: 19, height: 3 })).toBe(9)
  })
})

describe('the suggested row', () => {
  it.each([
    [3, 3, 3],
    [5, 5, 5],
    [7, 7, 5],
    [11, 11, 5],
    [15, 15, 5],
    [17, 17, 7],
    [19, 19, 7],
  ])('for %i × %i is %i in a row', (width, height, row) => {
    expect(suggestedRow({ width, height })).toBe(row)
  })

  it('follows the smaller side, and never asks for a row that does not fit', () => {
    expect(suggestedRow({ width: 3, height: 19 })).toBe(3)
    expect(suggestedRow({ width: 19, height: 5 })).toBe(5)
    for (const width of oddNumbers(3, 19)) {
      for (const height of oddNumbers(3, 19)) {
        const winLength = suggestedRow({ width, height })
        expect(
          isValidField({ width, height, winLength }),
          `${width.toString()}×${height.toString()}`,
        ).toBe(true)
      }
    }
  })
})
