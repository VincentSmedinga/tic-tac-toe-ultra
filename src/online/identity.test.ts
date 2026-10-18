import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenSchema } from '../../shared/protocol.ts'
import {
  clearLastRoom,
  getLastRoom,
  getName,
  getShape,
  getToken,
  sanitizeName,
  setLastRoom,
  setName,
  setShape,
} from './identity.ts'

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

  it('is made again when what is in localStorage is no token a room would accept', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.token', 'short')
    const token = getToken()
    expect(token).not.toBe('short')
    expect(tokenSchema.safeParse(token).success).toBe(true)
    expect(window.localStorage.getItem('tic-tac-toe-ultra.token')).toBe(token)
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

  it('is cleaned before it is kept', () => {
    setName('  An\u200Bna ')
    expect(getName()).toBe('Anna')
  })

  it('still counts for this visit when localStorage is off', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    setName('Bo')
    expect(getName()).toBe('Bo')
  })
})

describe('sanitizeName', () => {
  it('leaves a normal name alone, with the spaces around it taken off', () => {
    expect(sanitizeName('Anna')).toBe('Anna')
    expect(sanitizeName('  Anna Maria ')).toBe('Anna Maria')
  })

  it('takes out control and invisible characters, such as a pasted zero-width space', () => {
    expect(sanitizeName('An\u200Bna')).toBe('Anna')
    expect(sanitizeName('An\nna\t')).toBe('Anna')
    expect(sanitizeName('\u200B\u200B')).toBe('')
  })

  it('cuts a name that is too long, and never in the middle of a character', () => {
    expect(sanitizeName('a'.repeat(30))).toBe('a'.repeat(20))
    const emoji = '\u{1F600}'.repeat(15)
    const cut = sanitizeName(emoji)
    expect(cut).toBe('\u{1F600}'.repeat(10))
    expect(cut.length).toBeLessThanOrEqual(20)
  })

  it('gives a name the room accepts, whatever goes in', () => {
    for (const name of ['x\u0000y', 'a'.repeat(100), ' \u{1F600} ', '\uD83D']) {
      const clean = sanitizeName(name)
      expect(clean.length).toBeLessThanOrEqual(20)
      expect(/^[^\p{C}]*$/u.test(clean)).toBe(true)
    }
  })
})

describe('the room this browser last sat in', () => {
  afterEach(() => {
    clearLastRoom()
  })

  it('is none until a room is remembered, and then it is that room', () => {
    expect(getLastRoom()).toBeNull()
    setLastRoom('BCDF')
    expect(getLastRoom()).toBe('BCDF')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.room')).toBe('BCDF')
  })

  it('can be forgotten', () => {
    setLastRoom('BCDF')
    clearLastRoom()
    expect(getLastRoom()).toBeNull()
    expect(window.localStorage.getItem('tic-tac-toe-ultra.room')).toBeNull()
  })

  it('is none when what is in storage is no room code', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.room', 'nonsense')
    expect(getLastRoom()).toBeNull()
  })

  it('still works for this visit when localStorage is off', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    setLastRoom('GHJK')
    expect(getLastRoom()).toBe('GHJK')
    clearLastRoom()
    expect(getLastRoom()).toBeNull()
  })
})

describe('the shape of a browser', () => {
  it('is none until one is chosen', () => {
    expect(getShape()).toBeNull()
  })

  it('is kept in localStorage', () => {
    setShape('heart')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.shape')).toBe('heart')
    expect(getShape()).toBe('heart')
  })

  it('is none when what is in storage is no shape', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.shape', 'banana')
    expect(getShape()).toBeNull()
  })

  it('still counts for this visit when localStorage is off', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('off')
    })
    setShape('star')
    expect(getShape()).toBe('star')
  })
})
