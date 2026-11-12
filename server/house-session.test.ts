import { describe, expect, it } from 'vitest'
import type { HouseServerMessage, HouseState } from '../shared/house-protocol.ts'
import type { Member } from './house-logic.ts'
import { HouseSession } from './house-session.ts'
import type { HouseHost } from './house-session.ts'
import { CLOSE_REPLACED } from './room-session.ts'

interface FakeSocket {
  id: string
  member: Member | null
  open: boolean
  sent: HouseServerMessage[]
}

/** A house without Cloudflare: sockets in a list, and a clock that moves on with every message. */
function fakeHouse() {
  const sockets: FakeSocket[] = []
  const closed: { id: string; code: number }[] = []
  let time = 0
  let touched = 0
  const host: HouseHost = {
    code: '123456',
    sockets: () => sockets.map(({ id, member, open }) => ({ id, member, open })),
    attach: (id, member) => {
      const socket = sockets.find((s) => s.id === id)
      if (socket) socket.member = member
    },
    send: (id, message) => {
      sockets.find((s) => s.id === id)?.sent.push(message)
    },
    close: (id, code) => {
      closed.push({ id, code })
      const socket = sockets.find((s) => s.id === id)
      if (socket) socket.open = false
    },
    touch: () => {
      touched += 1
    },
    now: () => (time += 1),
  }
  const session = new HouseSession(host)
  const connect = (id: string) => {
    const socket: FakeSocket = { id, member: null, open: true, sent: [] }
    sockets.push(socket)
    return socket
  }
  const say = (socket: FakeSocket, message: unknown) => {
    session.message(socket.id, JSON.stringify(message))
  }
  const lastState = (socket: FakeSocket) =>
    socket.sent.filter((m): m is HouseState => m.type === 'state').at(-1)
  return { session, connect, say, lastState, closed, touches: () => touched }
}

const tokenA = 'aaaaaaaaaaaaaaaa'
const tokenB = 'bbbbbbbbbbbbbbbb'

describe('a house', () => {
  it('tells everybody who is there when somebody comes in', () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    house.say(anna, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    house.say(bas, { type: 'join', token: tokenB, name: 'Bas', shape: 'heart' })
    expect(house.lastState(anna)?.members).toEqual([
      { id: '1', name: 'Anna', shape: 'heart', status: 'free' },
      { id: '2', name: 'Bas', status: 'free' },
    ])
    expect(house.lastState(bas)?.you).toBe('2')
    expect(house.touches()).toBe(2)
  })

  it('lets somebody choose a free shape, and refuses one that is taken', () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    house.say(anna, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    house.say(bas, { type: 'join', token: tokenB, name: 'Bas' })
    house.say(bas, { type: 'choose', shape: 'heart' })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'shape-taken' })
    house.say(bas, { type: 'choose', shape: 'star' })
    expect(house.lastState(anna)?.members[1]?.shape).toBe('star')
  })

  it('refuses a message from somebody who has not come in, and a message it cannot read', () => {
    const house = fakeHouse()
    const socket = house.connect('1')
    house.say(socket, { type: 'choose', shape: 'star' })
    expect(socket.sent.at(-1)).toEqual({ type: 'error', error: 'not-joined' })
    house.session.message('1', 'nonsense')
    expect(socket.sent.at(-1)).toEqual({ type: 'error', error: 'invalid-message' })
  })

  it('closes the old socket of a browser that comes in on a new one, and keeps its shape', () => {
    const house = fakeHouse()
    const first = house.connect('1')
    house.say(first, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    const second = house.connect('2')
    house.say(second, { type: 'join', token: tokenA, name: 'Anna' })
    expect(house.closed).toEqual([{ id: '1', code: CLOSE_REPLACED }])
    expect(house.lastState(second)?.members).toEqual([
      { id: '2', name: 'Anna', shape: 'heart', status: 'free' },
    ])
  })

  it('leaves out somebody whose socket went away, and starts its day again', () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    house.say(anna, { type: 'join', token: tokenA, name: 'Anna' })
    house.say(bas, { type: 'join', token: tokenB, name: 'Bas' })
    bas.open = false
    house.session.closed()
    expect(house.lastState(anna)?.members.map(({ name }) => name)).toEqual(['Anna'])
    expect(house.touches()).toBe(3)
  })
})
