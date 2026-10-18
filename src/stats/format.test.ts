import { describe, expect, it } from 'vitest'
import { textFor } from '../i18n/store.ts'
import { cellName, duration } from './format.ts'

describe('formatting numbers for the statistics', () => {
  const nl = textFor('nl')

  it('writes a time to the second', () => {
    expect(duration(nl, 45_000)).toBe('45 s')
    expect(duration(nl, 125_000)).toBe('2 min 5 s')
    expect(duration(nl, 120_000)).toBe('2 min')
    expect(duration(nl, 3_900_000)).toBe('1 u 5 min')
    expect(duration(nl, 3_600_000)).toBe('1 u')
  })

  it('writes the units of a time in the language', () => {
    expect(duration(textFor('en'), 3_900_000)).toBe('1 h 5 min')
    expect(duration(textFor('fy'), 3_900_000)).toBe('1 oere 5 min')
  })

  it('names a cell from 1', () => {
    expect(cellName(nl, 0, 1)).toBe('rij 2, kolom 1')
    expect(cellName(textFor('en'), 2, 0)).toBe('row 1, column 3')
  })
})
