import { describe, expect, it } from 'vitest'
import { cellName, decimal, duration, games, kindName, percent, shortDate } from './format.ts'

describe('formatting numbers for the statistics', () => {
  it('writes decimals the Dutch way', () => {
    expect(decimal(6.25)).toBe('6,3')
    expect(decimal(5)).toBe('5')
  })

  it('writes a share as a whole percentage, and nothing divided by nothing as zero', () => {
    expect(percent(5, 9)).toBe('56%')
    expect(percent(0, 0)).toBe('0%')
  })

  it('writes a time to the second', () => {
    expect(duration(45_000)).toBe('45 s')
    expect(duration(125_000)).toBe('2 min 5 s')
    expect(duration(120_000)).toBe('2 min')
    expect(duration(3_900_000)).toBe('1 u 5 min')
    expect(duration(3_600_000)).toBe('1 u')
  })

  it('writes a date and a number of games', () => {
    expect(shortDate('2026-10-12')).toBe('12 okt')
    expect(games(1)).toBe('1 spel')
    expect(games(3)).toBe('3 spellen')
  })

  it('names a cell from 1, and a kind of game', () => {
    expect(cellName(0, 1)).toBe('rij 2, kolom 1')
    expect(kindName(7, 7, 5)).toBe('7 bij 7, 5 op een rij')
  })
})
