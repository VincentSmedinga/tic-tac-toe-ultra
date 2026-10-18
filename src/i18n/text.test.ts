import { describe, expect, it } from 'vitest'
import { fill, forms, formatNumber, makeText, pick, placeholders } from './text.ts'
import type { Dictionary } from './types.ts'

describe('placeholders', () => {
  it('finds the names in a text, in order', () => {
    expect(placeholders('{name} ({shape}) wint {name}')).toEqual(['name', 'shape', 'name'])
    expect(placeholders('Geen')).toEqual([])
  })

  it('gives the sentences of a message', () => {
    expect(forms('één')).toEqual(['één'])
    expect(forms({ one: 'a', other: 'b' })).toEqual(['a', 'b'])
  })
})

describe('fill', () => {
  it('puts the values where the placeholders are, and keeps a placeholder without a value', () => {
    expect(fill('{a} en {b}', { a: 'x' })).toEqual(['x', ' en ', '{b}'])
  })

  it('does not read a value as a pattern', () => {
    expect(fill('Hallo {name}', { name: '$& {x}' }).join('')).toBe('Hallo $& {x}')
  })
})

describe('pick', () => {
  const games = { one: '{count} spel', other: '{count} spellen' }

  it('takes the plural category of the language', () => {
    expect(pick(games, 'nl-NL', 1)).toBe('{count} spel')
    expect(pick(games, 'nl-NL', 0)).toBe('{count} spellen')
    expect(pick(games, 'nl-NL', 2)).toBe('{count} spellen')
  })

  it('uses other for a category it has no text for, and a plain text for every number', () => {
    expect(pick({ other: 'x' }, 'nl-NL', 1)).toBe('x')
    expect(pick('plain', 'nl-NL', 5)).toBe('plain')
  })

  it('refuses a message without an other', () => {
    expect(() => pick({ one: 'x' }, 'nl-NL', 5)).toThrow(RangeError)
  })
})

describe('makeText', () => {
  const dictionary = {
    greeting: 'Hallo {name}',
    games: { one: '{count} spel', other: '{count} spellen' },
    average: 'Gemiddeld {value}',
  } as unknown as Dictionary

  it('fills in a text and picks the plural', () => {
    const t = makeText(dictionary, 'nl-NL')
    // @ts-expect-error The keys of this test are not the game's.
    expect(t('greeting', { name: 'Anna' })).toBe('Hallo Anna')
    // @ts-expect-error The keys of this test are not the game's.
    expect(t('games', { count: 1 })).toBe('1 spel')
    // @ts-expect-error The keys of this test are not the game's.
    expect(t('games', { count: 3 })).toBe('3 spellen')
  })

  it('writes a number the way the language does, with at most one decimal', () => {
    const t = makeText(dictionary, 'nl-NL')
    // @ts-expect-error The keys of this test are not the game's.
    expect(t('average', { value: 6.25 })).toBe('Gemiddeld 6,3')
    expect(formatNumber('en-GB', 6.25)).toBe('6.3')
    expect(formatNumber('nl-NL', 5)).toBe('5')
  })
})
