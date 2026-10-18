import { describe, expect, it } from 'vitest'
import {
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  parseClientMessage,
  parseServerMessage,
  fieldSchema,
  roomSettingsSchema,
  roomCodeSchema,
  storedGameSchema,
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

  it('can choose a shape, and join with one', () => {
    expect(parse({ type: 'choose', shape: 'heart' })).toEqual({ type: 'choose', shape: 'heart' })
    expect(parse({ type: 'join', token, shape: 'star' })).toEqual({
      type: 'join',
      token,
      shape: 'star',
    })
  })

  it('refuses a shape that does not exist, or none at all', () => {
    expect(parse({ type: 'choose', shape: 'banana' })).toBeNull()
    expect(parse({ type: 'choose' })).toBeNull()
    expect(parse({ type: 'join', token, shape: 'X' })).toBeNull()
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
    field: { width: 3, height: 3, winLength: 3 },
    seats: 2,
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

describe('a stored game', () => {
  const stored = {
    id: 'abcdefghijklmnop',
    finishedAt: 1_700_000_000_000,
    config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
    moves: [{ player: 'X', x: 0, y: 0 }],
    players: [{ id: 'X', name: 'Anna' }, { id: 'O' }],
    result: { kind: 'won', winner: 'X' },
  }

  it('is accepted, as a win or as a draw', () => {
    expect(storedGameSchema.safeParse(stored).success).toBe(true)
    expect(storedGameSchema.safeParse({ ...stored, result: { kind: 'draw' } }).success).toBe(true)
  })

  it('may say when it started, and has not to', () => {
    expect(storedGameSchema.safeParse({ ...stored, startedAt: 1_699_999_990_000 }).success).toBe(
      true,
    )
    expect(storedGameSchema.safeParse(stored).success).toBe(true)
    expect(storedGameSchema.safeParse({ ...stored, startedAt: -1 }).success).toBe(false)
    expect(storedGameSchema.safeParse({ ...stored, startedAt: 1.5 }).success).toBe(false)
  })

  it('is refused with an id that is no id, or a result nobody knows', () => {
    expect(storedGameSchema.safeParse({ ...stored, id: 'short' }).success).toBe(false)
    expect(storedGameSchema.safeParse({ ...stored, id: 'abcdefghijklmno!' }).success).toBe(false)
    expect(storedGameSchema.safeParse({ ...stored, result: { kind: 'lost' } }).success).toBe(false)
    expect(storedGameSchema.safeParse({ ...stored, finishedAt: -1 }).success).toBe(false)
  })
})

describe('the field of a room', () => {
  it('is accepted when its sides and its row are odd and within the limits', () => {
    for (const field of [
      { width: 3, height: 3, winLength: 3 },
      { width: 7, height: 5, winLength: 5 },
      { width: 19, height: 19, winLength: 9 },
      { width: 3, height: 19, winLength: 9 },
    ]) {
      expect(fieldSchema.safeParse(field).success, JSON.stringify(field)).toBe(true)
    }
  })

  it('is refused with an even side or an even row', () => {
    expect(fieldSchema.safeParse({ width: 4, height: 3, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 3, height: 6, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 5, height: 5, winLength: 4 }).success).toBe(false)
  })

  it('is refused outside the limits, and when the row is longer than the field', () => {
    expect(fieldSchema.safeParse({ width: 1, height: 3, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 21, height: 3, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 5, height: 5, winLength: 11 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 3, height: 3, winLength: 5 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 3, height: 3, winLength: 1 }).success).toBe(false)
  })

  it('is refused when it is not whole numbers', () => {
    expect(fieldSchema.safeParse({ width: 3.5, height: 3, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: '5', height: 5, winLength: 3 }).success).toBe(false)
    expect(fieldSchema.safeParse({ width: 5, height: 5 }).success).toBe(false)
  })
})

describe('what a room is made with', () => {
  const field = { width: 7, height: 7, winLength: 5 }

  it('is the field, and how many people may play', () => {
    expect(roomSettingsSchema.safeParse(field).success).toBe(true)
    for (const players of [2, 3, 7, 12]) {
      expect(roomSettingsSchema.safeParse({ ...field, players }).success, `${players}`).toBe(true)
    }
  })

  it('is refused with fewer than two or more than twelve people, or half a person', () => {
    for (const players of [0, 1, 13, 100, 2.5, '3']) {
      expect(roomSettingsSchema.safeParse({ ...field, players }).success, `${players}`).toBe(false)
    }
  })

  it('is refused with a field that is no field, whoever plays', () => {
    expect(roomSettingsSchema.safeParse({ ...field, width: 4, players: 3 }).success).toBe(false)
  })

  it('may be asked to start the game, and to nothing else with it', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'start' }))).toEqual({ type: 'start' })
  })
})
