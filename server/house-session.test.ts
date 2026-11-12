import { describe, expect, it } from 'vitest'
import type { HouseServerMessage, HouseState } from '../shared/house-protocol.ts'
import { INVITATION_MS } from '../shared/house.ts'
import { EMPTY_HOUSE } from './house-logic.ts'
import type { HouseData, Member } from './house-logic.ts'
import type { HouseSeat } from './room-logic.ts'
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
  let data: HouseData = EMPTY_HOUSE
  const rooms: { field: unknown; seats: HouseSeat[] }[] = []
  let roomsFail = false
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
    load: () => data,
    save: (next) => {
      data = next
    },
    makeRoom: (field, seats) => {
      if (roomsFail) return Promise.resolve(null)
      rooms.push({ field, seats })
      return Promise.resolve(`BCD${'FGHJ'[rooms.length - 1] ?? 'K'}`)
    },
  }
  const session = new HouseSession(host)
  const connect = (id: string) => {
    const socket: FakeSocket = { id, member: null, open: true, sent: [] }
    sockets.push(socket)
    return socket
  }
  const say = (socket: FakeSocket, message: unknown) =>
    session.message(socket.id, JSON.stringify(message))
  const lastState = (socket: FakeSocket) =>
    socket.sent.filter((m): m is HouseState => m.type === 'state').at(-1)
  return {
    session,
    connect,
    say,
    lastState,
    closed,
    rooms,
    touches: () => touched,
    data: () => data,
    later: (ms: number) => {
      time += ms
    },
    failRooms: () => {
      roomsFail = true
    },
  }
}

const tokenA = 'aaaaaaaaaaaaaaaa'
const tokenB = 'bbbbbbbbbbbbbbbb'

describe('a house', () => {
  it('tells everybody who is there when somebody comes in', async () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    await house.say(anna, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    await house.say(bas, { type: 'join', token: tokenB, name: 'Bas', shape: 'heart' })
    expect(house.lastState(anna)?.members).toEqual([
      { id: '1', name: 'Anna', shape: 'heart', status: 'free' },
      { id: '2', name: 'Bas', status: 'free' },
    ])
    expect(house.lastState(bas)?.you).toBe('2')
    expect(house.touches()).toBe(2)
  })

  it('lets somebody choose a free shape, and refuses one that is taken', async () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    await house.say(anna, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    await house.say(bas, { type: 'join', token: tokenB, name: 'Bas' })
    await house.say(bas, { type: 'choose', shape: 'heart' })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'shape-taken' })
    await house.say(bas, { type: 'choose', shape: 'star' })
    expect(house.lastState(anna)?.members[1]?.shape).toBe('star')
  })

  it('refuses a message from somebody who has not come in, and a message it cannot read', async () => {
    const house = fakeHouse()
    const socket = house.connect('1')
    await house.say(socket, { type: 'choose', shape: 'star' })
    expect(socket.sent.at(-1)).toEqual({ type: 'error', error: 'not-joined' })
    await house.session.message('1', 'nonsense')
    expect(socket.sent.at(-1)).toEqual({ type: 'error', error: 'invalid-message' })
  })

  it('closes the old socket of a browser that comes in on a new one, and keeps its shape', async () => {
    const house = fakeHouse()
    const first = house.connect('1')
    await house.say(first, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
    const second = house.connect('2')
    await house.say(second, { type: 'join', token: tokenA, name: 'Anna' })
    expect(house.closed).toEqual([{ id: '1', code: CLOSE_REPLACED }])
    expect(house.lastState(second)?.members).toEqual([
      { id: '2', name: 'Anna', shape: 'heart', status: 'free' },
    ])
  })

  it('leaves out somebody whose socket went away, and starts its day again', async () => {
    const house = fakeHouse()
    const anna = house.connect('1')
    const bas = house.connect('2')
    await house.say(anna, { type: 'join', token: tokenA, name: 'Anna' })
    await house.say(bas, { type: 'join', token: tokenB, name: 'Bas' })
    bas.open = false
    house.session.closed()
    expect(house.lastState(anna)?.members.map(({ name }) => name)).toEqual(['Anna'])
    expect(house.touches()).toBe(3)
  })
})

const tokenC = 'cccccccccccccccc'
const CLASSIC = { width: 3, height: 3, winLength: 3 }

/** Anna, Bas and Cor in a house, each with a shape. */
async function family() {
  const house = fakeHouse()
  const anna = house.connect('1')
  const bas = house.connect('2')
  const cor = house.connect('3')
  await house.say(anna, { type: 'join', token: tokenA, name: 'Anna', shape: 'heart' })
  await house.say(bas, { type: 'join', token: tokenB, name: 'Bas', shape: 'star' })
  await house.say(cor, { type: 'join', token: tokenC, name: 'Cor', shape: 'moon' })
  return { house, anna, bas, cor }
}

const statuses = (state: HouseState | undefined) =>
  state?.members.map(({ name, status }) => `${name} ${status}`)

describe('an invitation', () => {
  it('makes the one who invites inviting and the others invited, and shows each how it goes', async () => {
    const { house, anna, bas, cor } = await family()
    await house.say(anna, { type: 'invite', people: ['2', '3'], field: CLASSIC })
    expect(statuses(house.lastState(cor))).toEqual(['Anna inviting', 'Bas invited', 'Cor invited'])
    expect(house.lastState(bas)?.invitation).toEqual({
      from: '1',
      field: CLASSIC,
      people: [
        { id: '2', answer: 'open' },
        { id: '3', answer: 'open' },
      ],
    })
    await house.say(bas, { type: 'answer', yes: false })
    expect(house.lastState(cor)?.invitation?.people[0]).toEqual({ id: '2', answer: 'no' })
    // Who said no is free again, and no longer sees the invitation.
    expect(house.lastState(bas)?.invitation).toBeUndefined()
    expect(statuses(house.lastState(bas))).toEqual(['Anna inviting', 'Bas free', 'Cor invited'])
  })

  it('is refused for somebody who is not free or has no shape, and for an id nobody has', async () => {
    const { house, anna, bas, cor } = await family()
    const dirk = house.connect('4')
    await house.say(dirk, { type: 'join', token: 'dddddddddddddddd', name: 'Dirk' })
    await house.say(anna, { type: 'invite', people: ['4'], field: CLASSIC })
    expect(anna.sent.at(-1)).toEqual({ type: 'error', error: 'shape-needed' })
    await house.say(anna, { type: 'invite', people: ['9'], field: CLASSIC })
    expect(anna.sent.at(-1)).toEqual({ type: 'error', error: 'not-free' })
    await house.say(anna, { type: 'invite', people: ['2'], field: CLASSIC })
    await house.say(cor, { type: 'invite', people: ['2'], field: CLASSIC })
    expect(cor.sent.at(-1)).toEqual({ type: 'error', error: 'not-free' })
    await house.say(bas, { type: 'invite', people: ['3'], field: CLASSIC })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'not-free' })
    // Nobody can change shape while invited: the room is played with the shape of the invitation.
    await house.say(bas, { type: 'choose', shape: 'anchor' })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'not-free' })
  })

  it('refuses an answer from somebody who has no invitation, or answered already', async () => {
    const { house, anna, bas } = await family()
    await house.say(bas, { type: 'answer', yes: true })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'no-invitation' })
    await house.say(anna, { type: 'invite', people: ['2', '3'], field: CLASSIC })
    await house.say(bas, { type: 'answer', yes: true })
    await house.say(bas, { type: 'answer', yes: false })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'no-invitation' })
  })

  it('makes the room once everybody has answered, with those who said yes, and sends them there', async () => {
    const { house, anna, bas, cor } = await family()
    await house.say(anna, { type: 'invite', people: ['2', '3'], field: CLASSIC })
    await house.say(bas, { type: 'answer', yes: true })
    expect(house.rooms).toEqual([])
    await house.say(cor, { type: 'answer', yes: false })
    expect(house.rooms).toEqual([
      {
        field: CLASSIC,
        seats: [
          { token: tokenA, name: 'Anna', shape: 'heart' },
          { token: tokenB, name: 'Bas', shape: 'star' },
        ],
      },
    ])
    expect(house.lastState(anna)?.room).toBe('BCDF')
    expect(house.lastState(bas)?.room).toBe('BCDF')
    expect(house.lastState(cor)?.room).toBeUndefined()
    expect(statuses(house.lastState(cor))).toEqual(['Anna playing', 'Bas playing', 'Cor free'])
  })

  it('starts after a minute with those who said yes, when the alarm comes', async () => {
    const { house, anna, bas } = await family()
    await house.say(anna, { type: 'invite', people: ['2', '3'], field: CLASSIC })
    await house.say(bas, { type: 'answer', yes: true })
    await house.session.settle()
    expect(house.rooms).toEqual([])
    house.later(INVITATION_MS)
    await house.session.settle()
    expect(house.rooms[0]?.seats.map(({ name }) => name)).toEqual(['Anna', 'Bas'])
    expect(house.data().invitations).toEqual([])
  })

  it('is off when nobody said yes, and the one who invited hears so', async () => {
    const { house, anna, bas, cor } = await family()
    await house.say(anna, { type: 'invite', people: ['2'], field: CLASSIC })
    await house.say(bas, { type: 'answer', yes: false })
    expect(house.rooms).toEqual([])
    expect(anna.sent).toContainEqual({ type: 'error', error: 'invitation-off' })
    expect(cor.sent).not.toContainEqual({ type: 'error', error: 'invitation-off' })
    expect(statuses(house.lastState(anna))).toEqual(['Anna free', 'Bas free', 'Cor free'])
  })

  it('tells the players when the room could not be made', async () => {
    const { house, anna, bas } = await family()
    house.failRooms()
    await house.say(anna, { type: 'invite', people: ['2'], field: CLASSIC })
    await house.say(bas, { type: 'answer', yes: true })
    expect(anna.sent.at(-1)).toEqual({ type: 'error', error: 'no-room' })
    expect(bas.sent.at(-1)).toEqual({ type: 'error', error: 'no-room' })
    expect(statuses(house.lastState(anna))).toEqual(['Anna free', 'Bas free', 'Cor free'])
  })
})

describe('the rooms of a house', () => {
  async function playing() {
    const setup = await family()
    await setup.house.say(setup.anna, { type: 'invite', people: ['2'], field: CLASSIC })
    await setup.house.say(setup.bas, { type: 'answer', yes: true })
    return setup
  }

  it('keeps the players in the list while they play, also when they have the house closed', async () => {
    const { house, anna, bas, cor } = await playing()
    anna.open = false
    bas.open = false
    house.session.closed()
    expect(statuses(house.lastState(cor))).toEqual(['Cor free', 'Anna playing', 'Bas playing'])
    // Their shapes stay theirs while they play.
    await house.say(cor, { type: 'choose', shape: 'heart' })
    expect(cor.sent.at(-1)).toEqual({ type: 'error', error: 'shape-taken' })
  })

  it('makes them free when the round is over, and playing again with a rematch', async () => {
    const { house, anna, cor } = await playing()
    house.session.report('BCDF', { kind: 'over', round: 0, winner: 'heart' })
    expect(statuses(house.lastState(cor))).toEqual(['Anna free', 'Bas free', 'Cor free'])
    expect(house.lastState(anna)?.room).toBeUndefined()
    house.session.report('BCDF', { kind: 'started', round: 1, playing: [tokenA] })
    expect(statuses(house.lastState(cor))).toEqual(['Anna playing', 'Bas free', 'Cor free'])
    expect(house.lastState(anna)?.room).toBe('BCDF')
  })

  it('pays no attention to a room it did not make', async () => {
    const { house, cor } = await playing()
    house.session.report('ZZZZ', { kind: 'over', round: 0, winner: null })
    expect(statuses(house.lastState(cor))).toEqual(['Anna playing', 'Bas playing', 'Cor free'])
  })
})
