import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenSchema } from '../../shared/protocol.ts'
import { getName, getToken, setName } from './identity.ts'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('the token of a browser', () => {
  it('is one a room accepts, and stays the same', () => {
    const token = getToken()
    expect(tokenSchema.safeParse(token).success).toBe(true)
    expect(getToken()).toBe(token)
  })

  it('is kept in localStorage, so a page that is opened again gets it back', () => {
    const token = getToken()
    expect(window.localStorage.getItem('tic-tac-toe-ultra.token')).toBe(token)
  })

  it('is taken from localStorage when it is there', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.token', 'a-token-from-before-1234')
    expect(getToken()).toBe('a-token-from-before-1234')
  })

  it('still works when localStorage is off', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const token = getToken()
    expect(tokenSchema.safeParse(token).success).toBe(true)
    expect(getToken()).toBe(token)
  })
})

describe('the name of a player', () => {
  it('is empty until one is set, and then remembered', () => {
    expect(getName()).toBe('')
    setName('Anna')
    expect(getName()).toBe('Anna')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.name')).toBe('Anna')
  })

  it('still counts for this visit when localStorage is off', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    setName('Bo')
    expect(getName()).toBe('Bo')
  })
})
