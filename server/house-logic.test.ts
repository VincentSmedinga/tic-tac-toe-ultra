import { describe, expect, it } from 'vitest'
import { HOUSE_LIMIT } from '../shared/house.ts'
import { SHAPE_IDS } from '../shared/shapes.ts'
import type { ShapeId } from '../shared/shapes.ts'
import { EMPTY_HOUSE, choose, invite, join, settle, stateFor } from './house-logic.ts'
import type { HouseData, Member, Present } from './house-logic.ts'
import { INVITATION_MS } from '../shared/house.ts'

function person(id: string, name: string, shape?: ShapeId, since = 0): Present {
  return { id, member: { token: `token-${id}`, name, ...(shape ? { shape } : {}), since } }
}

function joined(result: ReturnType<typeof join>): Member {
  if (!result.ok) throw new Error(result.error)
  return result.member
}

describe('coming into a house', () => {
  it('gives the shape of last time when nobody has it', () => {
    const member = joined(join([], 'token-a', 'Anna', 'heart', 5))
    expect(member).toEqual({ token: 'token-a', name: 'Anna', shape: 'heart', since: 5 })
  })

  it('gives no shape when somebody else in the house has it', () => {
    const member = joined(join([person('b', 'Bas', 'heart')], 'token-a', 'Anna', 'heart', 5))
    expect(member.shape).toBeUndefined()
  })

  it('keeps the place and the shape of a browser that is there already, with its new name', () => {
    const before = person('a', 'Anna', 'star', 1)
    const member = joined(join([before], 'token-a', 'Annie', undefined, 9))
    expect(member).toEqual({ token: 'token-a', name: 'Annie', shape: 'star', since: 1 })
  })

  it('is refused when every shape is somebody else’s', () => {
    const full = SHAPE_IDS.map((shape, index) => person(index.toString(), 'Iemand', shape))
    expect(full).toHaveLength(HOUSE_LIMIT)
    expect(join(full, 'token-new', 'Anna', undefined, 1)).toEqual({
      ok: false,
      error: 'house-full',
    })
  })

  it('lets somebody who is there already come in again, also in a full house', () => {
    const full = SHAPE_IDS.map((shape, index) => person(index.toString(), 'Iemand', shape))
    expect(join(full, 'token-0', 'Anna', undefined, 1).ok).toBe(true)
  })
})

describe('choosing a shape', () => {
  it('gives the shape when it is free', () => {
    const anna = person('a', 'Anna')
    expect(choose([anna], anna.member, 'star')).toEqual({
      ok: true,
      member: { ...anna.member, shape: 'star' },
    })
  })

  it('refuses a shape that somebody else in the house has', () => {
    const anna = person('a', 'Anna', 'circle')
    expect(choose([anna, person('b', 'Bas', 'star')], anna.member, 'star')).toEqual({
      ok: false,
      error: 'shape-taken',
    })
  })
})

describe('the house as somebody sees it', () => {
  it('lists everybody in the order they came, with a number for a name that came before', () => {
    const present = [
      person('c', 'anna', undefined, 3),
      person('a', 'Anna', 'heart', 1),
      person('b', 'Bas', 'star', 2),
    ]
    expect(stateFor(present, 'b', '123456')).toEqual({
      type: 'state',
      code: '123456',
      you: 'b',
      members: [
        { id: 'a', name: 'Anna', shape: 'heart', status: 'free' },
        { id: 'b', name: 'Bas', shape: 'star', status: 'free' },
        { id: 'c', name: 'anna', number: 2, status: 'free' },
      ],
    })
  })

  it('lists a browser with two sockets once', () => {
    const first = person('a', 'Anna', 'heart', 1)
    const second = { id: 'z', member: { ...first.member } }
    const state = stateFor([first, second], 'z', '123456')
    expect(state.members.map(({ id }) => id)).toEqual(['a'])
    expect(state.you).toBe('a')
  })
})

describe('an invitation in a house', () => {
  const anna = person('a', 'Anna', 'heart', 1)
  const bas = person('b', 'Bas', 'star', 2)
  const classic = { width: 3, height: 3, winLength: 3 }

  function invited(): HouseData {
    const result = invite([anna, bas], EMPTY_HOUSE, anna, ['b'], classic, 100)
    if (!result.ok) throw new Error(result.error)
    return result.data
  }

  it('lapses after a minute, and starts the game with those who said yes', () => {
    const data = invited()
    expect(settle(data, 100 + INVITATION_MS - 1).off).toEqual([])
    const { start, off } = settle(data, 100 + INVITATION_MS)
    // Bas didn't answer: Anna alone can't play.
    expect(start).toEqual([])
    expect(off).toHaveLength(1)
  })

  it('keeps the shapes of the people in it, also when they have the house closed', () => {
    const data = invited()
    expect(joined(join([], 'token-c', 'Cor', 'heart', 5, data)).shape).toBeUndefined()
    // Bas comes back and gets his shape again.
    expect(joined(join([anna], 'token-b', 'Bas', undefined, 5, data)).shape).toBe('star')
    expect(stateFor([anna], 'a', '123456', data, 200).members).toEqual([
      { id: 'a', name: 'Anna', shape: 'heart', status: 'inviting' },
      { id: 'b', name: 'Bas', shape: 'star', status: 'invited' },
    ])
  })
})
