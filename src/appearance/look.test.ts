import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK, LOOKS, applyLook, isLook, readLook, saveLook } from './look.ts'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
  delete document.documentElement.dataset.look
})

describe('the looks', () => {
  it('are three, each with a Dutch name for the menu', () => {
    expect(LOOKS.map(({ id }) => id)).toEqual(['drawn', 'playful', 'calm'])
    expect(LOOKS.map(({ name }) => name)).toEqual(['Getekend', 'Speels', 'Rustig'])
  })

  it('know which text is one', () => {
    expect(isLook('calm')).toBe(true)
    expect(isLook('a')).toBe(false)
    expect(isLook(null)).toBe(false)
  })
})

describe('the look of this device', () => {
  it('is the first until another is chosen', () => {
    expect(readLook()).toBe(DEFAULT_LOOK)
    expect(DEFAULT_LOOK).toBe('drawn')
  })

  it('is kept', () => {
    saveLook('playful')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.look')).toBe('playful')
    expect(readLook()).toBe('playful')
  })

  it('is the first when what is stored is no look, or storage is blocked', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.look', 'neon')
    expect(readLook()).toBe('drawn')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readLook()).toBe('drawn')
    expect(() => {
      saveLook('calm')
    }).not.toThrow()
  })

  it('goes on the page', () => {
    applyLook('calm')
    expect(document.documentElement.dataset.look).toBe('calm')
  })
})
