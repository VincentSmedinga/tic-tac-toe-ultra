import { describe, expect, it } from 'vitest'
import { gamePath, parseRoute, roomPath } from './route.ts'

describe('parseRoute', () => {
  it('knows the start screen, and takes anything it does not know for it', () => {
    expect(parseRoute('/')).toEqual({ name: 'start' })
    expect(parseRoute('/nope')).toEqual({ name: 'start' })
    expect(parseRoute('/kamer')).toEqual({ name: 'start' })
    expect(parseRoute('/kamer/BCDF/extra')).toEqual({ name: 'start' })
  })

  it('knows the game on one screen', () => {
    expect(parseRoute('/samen')).toEqual({ name: 'local' })
    expect(parseRoute('/samen/')).toEqual({ name: 'local' })
  })

  it('knows the statistics', () => {
    expect(parseRoute('/statistieken')).toEqual({ name: 'stats' })
    expect(parseRoute('/statistieken/')).toEqual({ name: 'stats' })
    expect(parseRoute('/statistieken/meer')).toEqual({ name: 'start' })
  })

  it('knows the settings', () => {
    expect(parseRoute('/instellingen')).toEqual({ name: 'settings' })
    expect(parseRoute('/instellingen/')).toEqual({ name: 'settings' })
    expect(parseRoute('/instellingen/meer')).toEqual({ name: 'start' })
  })

  it('knows a room, also when the code was typed in lower case', () => {
    expect(parseRoute('/kamer/BCDF')).toEqual({ name: 'room', code: 'BCDF' })
    expect(parseRoute('/kamer/bcdf')).toEqual({ name: 'room', code: 'BCDF' })
  })

  it('says so when the address of a room is no code', () => {
    for (const path of ['/kamer/ABCD', '/kamer/BCD', '/kamer/BCDFG', '/kamer/12ab']) {
      expect(parseRoute(path)).toEqual({ name: 'start', notice: 'bad-code' })
    }
  })

  it('makes the address of a room', () => {
    expect(roomPath('BCDF')).toBe('/kamer/BCDF')
  })

  it('knows the list of played games and one game', () => {
    expect(parseRoute('/spellen')).toEqual({ name: 'games' })
    expect(parseRoute('/spel/abcdefghijklmnop')).toEqual({ name: 'game', id: 'abcdefghijklmnop' })
    expect(parseRoute('/spel')).toEqual({ name: 'start' })
    expect(parseRoute('/spel/a/b')).toEqual({ name: 'start' })
  })

  it('makes the address of a game', () => {
    expect(gamePath('abcdefghijklmnop')).toBe('/spel/abcdefghijklmnop')
    expect(gamePath('a/b')).toBe('/spel/a%2Fb')
  })
})
