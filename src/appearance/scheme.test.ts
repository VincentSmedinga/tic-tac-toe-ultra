import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyScheme,
  chooseScheme,
  readPreference,
  resolveScheme,
  savePreference,
  syncChrome,
} from './scheme.ts'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
  document.head.innerHTML = ''
  delete document.documentElement.dataset.scheme
})

describe('the preference', () => {
  it('follows the system until a choice is kept', () => {
    expect(readPreference()).toBe('system')
  })

  it('keeps light or dark, and nothing at all for the system', () => {
    savePreference('dark')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBe('dark')
    expect(readPreference()).toBe('dark')
    savePreference('system')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBeNull()
    expect(readPreference()).toBe('system')
  })

  it('follows the system when what is stored is something else', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.scheme', 'purple')
    expect(readPreference()).toBe('system')
  })

  it('follows the system when storage is blocked, and does not fail to save', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readPreference()).toBe('system')
    expect(() => {
      savePreference('dark')
    }).not.toThrow()
  })
})

describe('resolveScheme', () => {
  it('is the system for the system, and the choice otherwise', () => {
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
  })
})

describe('chooseScheme', () => {
  it('keeps a choice that differs from the system', () => {
    expect(chooseScheme('dark', false)).toBe('dark')
    expect(chooseScheme('light', true)).toBe('light')
  })

  it('goes back to the system when the choice is what the system gives anyway', () => {
    expect(chooseScheme('dark', true)).toBe('system')
    expect(chooseScheme('light', false)).toBe('system')
  })
})

describe('applyScheme', () => {
  it('puts the scheme on the page and gives the browser bar the colour of the page', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    document.documentElement.style.setProperty('--chrome', '#123456')
    applyScheme('dark')
    expect(document.documentElement.dataset.scheme).toBe('dark')
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      '#123456',
    )
    document.documentElement.style.removeProperty('--chrome')
  })

  it('leaves the bar alone when there is nothing to give it', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#abcdef">'
    syncChrome()
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(
      '#abcdef',
    )
  })
})
