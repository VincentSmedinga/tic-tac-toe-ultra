import { describe, expect, it } from 'vitest'
import { nameNumbers } from './house.ts'
import {
  houseCodeSchema,
  parseHouseClientMessage,
  parseHouseServerMessage,
} from './house-protocol.ts'
import { MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH } from './protocol.ts'

const token = 'abcdefghijklmnop'
const parse = (message: unknown) => parseHouseClientMessage(JSON.stringify(message))

describe('the code of a house', () => {
  it('is six digits, a leading zero included', () => {
    expect(houseCodeSchema.safeParse('012345').success).toBe(true)
    expect(houseCodeSchema.safeParse('12345').success).toBe(false)
    expect(houseCodeSchema.safeParse('1234567').success).toBe(false)
    expect(houseCodeSchema.safeParse('BCDF').success).toBe(false)
    expect(houseCodeSchema.safeParse('12a456').success).toBe(false)
  })
})

describe('a message from a person in a house', () => {
  it('joins with a name, and maybe the shape of last time', () => {
    expect(parse({ type: 'join', token, name: ' Anna ' })).toEqual({
      type: 'join',
      token,
      name: 'Anna',
    })
    expect(parse({ type: 'join', token, name: 'Anna', shape: 'star' })).toEqual({
      type: 'join',
      token,
      name: 'Anna',
      shape: 'star',
    })
  })

  it('needs a name to join', () => {
    expect(parse({ type: 'join', token })).toBeNull()
    expect(parse({ type: 'join', token, name: '   ' })).toBeNull()
    expect(parse({ type: 'join', token, name: 'A'.repeat(MAX_NAME_LENGTH + 1) })).toBeNull()
    expect(parse({ type: 'join', token, name: 'An\u0000na' })).toBeNull()
  })

  it('chooses a shape that exists', () => {
    expect(parse({ type: 'choose', shape: 'heart' })).toEqual({ type: 'choose', shape: 'heart' })
    expect(parse({ type: 'choose', shape: 'banana' })).toBeNull()
  })

  it('invites people by their ids to a game on a field that a room accepts', () => {
    const field = { width: 7, height: 7, winLength: 5 }
    expect(parse({ type: 'invite', people: ['b', 'c'], field })).toEqual({
      type: 'invite',
      people: ['b', 'c'],
      field,
    })
    expect(parse({ type: 'invite', people: [], field })).toBeNull()
    expect(parse({ type: 'invite', people: ['b', 'b'], field })).toBeNull()
    expect(parse({ type: 'invite', people: ['b'], field: { ...field, width: 4 } })).toBeNull()
    const twelve = Array.from({ length: 12 }, (_, index) => `p${index.toString()}`)
    expect(parse({ type: 'invite', people: twelve, field })).toBeNull()
    expect(parse({ type: 'invite', people: twelve.slice(1), field })).not.toBeNull()
  })

  it('answers yes or no', () => {
    expect(parse({ type: 'answer', yes: true })).toEqual({ type: 'answer', yes: true })
    expect(parse({ type: 'answer', yes: 'maybe' })).toBeNull()
  })

  it('is refused when it is no JSON, too long or something else', () => {
    expect(parseHouseClientMessage('{')).toBeNull()
    expect(parseHouseClientMessage(42)).toBeNull()
    expect(parseHouseClientMessage('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull()
    expect(parse({ type: 'move', x: 0, y: 0 })).toBeNull()
  })
})

describe('a message from the house', () => {
  it('is the state or an error', () => {
    const state = {
      type: 'state',
      code: '123456',
      you: 'a',
      members: [
        { id: 'a', name: 'Anna', shape: 'heart', status: 'free' },
        { id: 'b', name: 'Anna', number: 2, status: 'free' },
      ],
    }
    expect(parseHouseServerMessage(JSON.stringify(state))).toEqual(state)
    const playing = {
      ...state,
      members: [{ id: 'a', name: 'Anna', shape: 'heart', status: 'inviting' }],
      invitation: {
        from: 'a',
        field: { width: 3, height: 3, winLength: 3 },
        people: [{ id: 'b', answer: 'yes' }],
      },
      room: 'BCDF',
    }
    expect(parseHouseServerMessage(JSON.stringify(playing))).toEqual(playing)
    expect(
      parseHouseServerMessage(JSON.stringify({ type: 'error', error: 'shape-taken' })),
    ).toEqual({ type: 'error', error: 'shape-taken' })
    expect(parseHouseServerMessage(JSON.stringify({ type: 'error', error: 'nope' }))).toBeNull()
  })
})

describe('the numbers after names that people share', () => {
  it('leaves the first without one, and counts the others in the order they came', () => {
    expect(nameNumbers(['Anna', 'Bas', 'anna', 'Anna'])).toEqual([undefined, undefined, 2, 3])
  })
})
