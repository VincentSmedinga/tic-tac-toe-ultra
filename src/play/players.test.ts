import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { shapeOf, usePlayerNames } from './players.ts'

describe('shapeOf', () => {
  it('is the shape itself for a player that is a shape', () => {
    expect(shapeOf('heart')).toBe('heart')
    expect(shapeOf('goldbar')).toBe('goldbar')
  })

  it('knows X and O from the games that were kept before shapes could be chosen', () => {
    expect(shapeOf('X')).toBe('cross')
    expect(shapeOf('O')).toBe('circle')
  })

  it('refuses a player it does not know, also one that is a property of every object', () => {
    expect(() => shapeOf('banana')).toThrow(RangeError)
    expect(() => shapeOf('toString')).toThrow(RangeError)
  })
})

describe('naming a player', () => {
  it('uses the shape, with a capital', () => {
    const { nameOf } = renderHook(() => usePlayerNames()).result.current
    expect(nameOf('heart')).toBe('Hart')
    expect(nameOf('X')).toBe('Kruis')
  })

  it('puts the name that was typed in front of it', () => {
    const { labelOf } = renderHook(() => usePlayerNames()).result.current
    expect(labelOf('star', 'Anna')).toBe('Anna (ster)')
    expect(labelOf('star')).toBe('Ster')
  })

  it('names the shape in the language of the page, and never translates what was typed', () => {
    setLanguage('en')
    const { labelOf } = renderHook(() => usePlayerNames()).result.current
    expect(labelOf('goldbar', 'Kruis')).toBe('Kruis (gold bar)')
    expect(labelOf('goldbar')).toBe('Gold bar')
  })
})
