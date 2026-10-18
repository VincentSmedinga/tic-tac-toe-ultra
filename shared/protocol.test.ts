import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  parseClientMessage,
  parseServerMessage,
  roomCodeSchema,
} from './protocol.ts'

const token = 'abcdefghijklmnop'
const parse = (message: unknown) => parseClientMessage(JSON.stringify(message))

describe('a message from a player', () => {
  it('can be a join, with or without a name', () => {
    expect(parse({ type: 'join', token })).toEqual({ type: 'join', token })
    expect(parse({ type: 'join', token, name: 'Anna' })).toEqual({
      type: 'join',
      token,
      name: 'Anna',
    })
  })

  it('gets the spaces around its name taken off, and an empty name counts as none', () => {
    expect(parse({ type: 'join', token, name: '  Anna  ' })).toMatchObject({ name: 'Anna' })
    expect(parse({ type: 'join', token, name: '   ' })).toEqual({ type: 'join', token })
  })

  it('refuses a name that is too long, or has a control character in it', () => {
    expect(parse({ type: 'join', token, name: 'a'.repeat(MAX_NAME_LENGTH + 1) })).toBeNull()
    expect(parse({ type: 'join', token, name: 'a'.repeat(MAX_NAME_LENGTH) })).not.toBeNull()
    expect(parse({ type: 'join', token, name: 'An\nna' })).toBeNull()
    expect(parse({ type: 'join', token, name: 'Anna \u{1F600}' })).not.toBeNull()
  })

  it('refuses a token that is too short, too long or has odd characters', () => {
    expect(parse({ type: 'join', token: 'short' })).toBeNull()
    expect(parse({ type: 'join', token: 'a'.repeat(65) })).toBeNull()
    expect(parse({ type: 'join', token: 'abcdefghijklmno!' })).toBeNull()
  })

  it('can be a move on a whole-number cell', () => {
    expect(parse({ type: 'move', x: 2, y: 0 })).toEqual({ type: 'move', x: 2, y: 0 })
  })

  it.each([
    { type: 'move', x: -1, y: 0 },
    { type: 'move', x: 1.5, y: 0 },
    { type: 'move', x: 100, y: 0 },
    { type: 'move', x: '1', y: 0 },
    { type: 'move', y: 0 },
  ])('refuses the move %j', (message) => {
    expect(parse(message)).toBeNull()
  })

  it('can be a rematch', () => {
    expect(parse({ type: 'rematch' })).toEqual({ type: 'rematch' })
  })

  it('refuses everything else: unknown types, not JSON, not text, too long', () => {
    expect(parse({ type: 'hello' })).toBeNull()
    expect(parse(['move'])).toBeNull()
    expect(parse(null)).toBeNull()
    expect(parseClientMessage('{nope')).toBeNull()
    expect(parseClientMessage(new ArrayBuffer(8))).toBeNull()
    expect(parseClientMessage(undefined)).toBeNull()
    const long = JSON.stringify({
      type: 'join',
      token,
      name: 'x',
      pad: 'y'.repeat(MAX_MESSAGE_LENGTH),
    })
    expect(parseClientMessage(long)).toBeNull()
  })
})

describe('a message from the server', () => {
  const state = {
    type: 'state',
    code: 'BCDF',
    you: 'X',
    round: 0,
    players: [{ id: 'X', connected: true }],
    config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
    moves: [{ player: 'X', x: 1, y: 1 }],
  }

  it('can be a state or an error', () => {
    expect(parseServerMessage(JSON.stringify(state))).toEqual(state)
    expect(parseServerMessage(JSON.stringify({ type: 'error', error: 'room-full' }))).toEqual({
      type: 'error',
      error: 'room-full',
    })
  })

  it('is refused when it is not one of those', () => {
    expect(parseServerMessage(JSON.stringify({ type: 'error', error: 'whatever' }))).toBeNull()
    expect(parseServerMessage(JSON.stringify({ ...state, code: 'abcd' }))).toBeNull()
    expect(parseServerMessage('nope')).toBeNull()
    expect(parseServerMessage(5)).toBeNull()
  })
})

describe('room codes', () => {
  it.each(['BCDF', 'ZXWV', 'KLMN'])('%s is a code', (code) => {
    expect(roomCodeSchema.safeParse(code).success).toBe(true)
  })

  it.each(['bcdf', 'BCD', 'BCDFG', 'ABCD', 'BCD1', 'BCDE', ' BCD', ''])('%j is not', (code) => {
    expect(roomCodeSchema.safeParse(code).success).toBe(false)
  })
})
