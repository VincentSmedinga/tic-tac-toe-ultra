import { afterEach, describe, expect, it } from 'vitest'
import { readAnimations, resolveMotion, saveAnimations } from './preference.ts'

afterEach(() => {
  window.localStorage.clear()
})

describe('the animations switch', () => {
  it('is on until someone turns it off, and keeps that for this device', () => {
    expect(readAnimations()).toBe(true)
    saveAnimations(false)
    expect(readAnimations()).toBe(false)
    saveAnimations(true)
    expect(readAnimations()).toBe(true)
    expect(window.localStorage.length).toBe(0)
  })

  it('is on when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(readAnimations(blocked)).toBe(true)
  })
})

describe('resolveMotion', () => {
  it('moves fully, gently when less motion is wanted, and not at all when switched off', () => {
    expect(resolveMotion(true, false)).toBe('full')
    expect(resolveMotion(true, true)).toBe('gentle')
    expect(resolveMotion(false, false)).toBe('off')
    expect(resolveMotion(false, true)).toBe('off')
  })
})
