import { describe, expect, it } from 'vitest'
import { replayGame } from '../shared/game/index.ts'
import type { ServerMessage, StateMessage } from '../shared/protocol.ts'
import { newRoom } from './room-logic.ts'
import type { RoomState } from './room-logic.ts'
import { CLOSE_REPLACED, CLOSE_ROOM_FULL, CLOSE_UNKNOWN_ROOM, RoomSession } from './room-session.ts'
import type { Host } from './room-session.ts'

const TOKEN_X = 'x'.repeat(20)
const TOKEN_O = 'o'.repeat(20)
const TOKEN_Z = 'z'.repeat(20)

/** A room's host in memory: the sockets are a list, what a player is sent is written down. */
class FakeHost implements Host {
  code = 'BCDF'
  room: RoomState | null = newRoom()
  touched = 0
  readonly sockets_ = new Map<string, { token: string | null; open: boolean }>()
  readonly sent: { id: string; message: ServerMessage }[] = []
  readonly closes: { id: string; code: number; reason: string }[] = []

  load() {
    return this.room
  }
  save(room: RoomState) {
    this.room = room
  }
  sockets() {
    return [...this.sockets_].map(([id, { token, open }]) => ({ id, token, open }))
  }
  attach(id: string, token: string) {
    const socket = this.sockets_.get(id)
    if (socket) socket.token = token
  }
  send(id: string, message: ServerMessage) {
    this.sent.push({ id, message })
  }
  close(id: string, code: number, reason: string) {
    this.closes.push({ id, code, reason })
    const socket = this.sockets_.get(id)
    if (socket) socket.open = false
  }
  touch() {
    this.touched++
  }

  /** The socket is gone, as when a phone loses its connection. */
  drop(id: string) {
    const socket = this.sockets_.get(id)
    if (socket) socket.open = false
  }
  /** A new socket, as when a browser connects, before it has said anything. */
  connect(id: string) {
    this.sockets_.set(id, { token: null, open: true })
  }
  /** The messages one socket got, without the ones from before. */
  received(id: string): ServerMessage[] {
    return this.sent.filter((entry) => entry.id === id).map((entry) => entry.message)
  }
  lastState(id: string): StateMessage {
    const last = this.received(id)
      .filter((message) => message.type === 'state')
      .at(-1)
    if (!last) throw new Error(`${id} got no state`)
    return last
  }
}

const say = (session: RoomSession, id: string, message: unknown) => {
  session.message(id, JSON.stringify(message))
}

/** A room with two players on sockets "a" (X) and "b" (O). */
function started() {
  const host = new FakeHost()
  const session = new RoomSession(host)
  host.connect('a')
  host.connect('b')
  say(session, 'a', { type: 'join', token: TOKEN_X, name: 'Anna' })
  say(session, 'b', { type: 'join', token: TOKEN_O })
  host.sent.length = 0
  return { host, session }
}

describe('a message that is no good', () => {
  it('gets an error, and nobody else hears about it', () => {
    const { host, session } = started()
    session.message('a', 'not json')
    session.message('a', JSON.stringify({ type: 'move', x: 9, y: 9 + 100 }))
    expect(host.received('a')).toEqual([
      { type: 'error', error: 'invalid-message' },
      { type: 'error', error: 'invalid-message' },
    ])
    expect(host.received('b')).toEqual([])
  })

  it('closes the socket when the room is gone', () => {
    const host = new FakeHost()
    host.room = null
    host.connect('a')
    say(new RoomSession(host), 'a', { type: 'join', token: TOKEN_X })
    expect(host.closes).toEqual([{ id: 'a', code: CLOSE_UNKNOWN_ROOM, reason: 'unknown-room' }])
  })
})

describe('joining', () => {
  it('seats the first player, who gets the state, alone in the room', () => {
    const host = new FakeHost()
    const session = new RoomSession(host)
    host.connect('a')
    say(session, 'a', { type: 'join', token: TOKEN_X, name: 'Anna' })

    expect(host.received('a')).toHaveLength(1)
    expect(host.lastState('a')).toMatchObject({
      code: 'BCDF',
      you: 'X',
      players: [{ id: 'X', name: 'Anna', connected: true }],
      moves: [],
    })
    expect(host.touched).toBeGreaterThan(0)
  })

  it('tells both players when the second one joins, each one who they are', () => {
    const host = new FakeHost()
    const session = new RoomSession(host)
    host.connect('a')
    host.connect('b')
    say(session, 'a', { type: 'join', token: TOKEN_X })
    say(session, 'b', { type: 'join', token: TOKEN_O })

    expect(host.lastState('a')).toMatchObject({ you: 'X' })
    expect(host.lastState('b')).toMatchObject({ you: 'O' })
    for (const id of ['a', 'b']) {
      expect(host.lastState(id).players).toEqual([
        { id: 'X', connected: true },
        { id: 'O', connected: true },
      ])
    }
  })

  it('refuses a third player with an error and closes their socket, and nobody else notices', () => {
    const { host, session } = started()
    host.connect('c')
    say(session, 'c', { type: 'join', token: TOKEN_Z })

    expect(host.received('c')).toEqual([{ type: 'error', error: 'room-full' }])
    expect(host.closes).toEqual([{ id: 'c', code: CLOSE_ROOM_FULL, reason: 'room-full' }])
    expect(host.received('a')).toEqual([])
    expect(host.received('b')).toEqual([])
  })

  it('does not let a socket that has not joined play', () => {
    const { host, session } = started()
    host.connect('c')
    say(session, 'c', { type: 'move', x: 0, y: 0 })
    expect(host.received('c')).toEqual([{ type: 'error', error: 'not-joined' }])
  })
})

describe('playing', () => {
  it('shows a valid move to both players', () => {
    const { host, session } = started()
    say(session, 'a', { type: 'move', x: 1, y: 1 })
    for (const id of ['a', 'b']) {
      expect(host.lastState(id).moves).toEqual([{ player: 'X', x: 1, y: 1 }])
    }
  })

  it('tells only the one who sent a refused move', () => {
    const { host, session } = started()
    say(session, 'b', { type: 'move', x: 0, y: 0 })
    expect(host.received('b')).toEqual([{ type: 'error', error: 'not-your-turn' }])
    expect(host.received('a')).toEqual([])
    expect(host.room?.moves).toEqual([])
  })

  it('plays a whole game to a win that both players see', () => {
    const { host, session } = started()
    const turns = [
      ['a', 0, 0],
      ['b', 0, 1],
      ['a', 1, 0],
      ['b', 1, 1],
      ['a', 2, 0],
    ] as const
    for (const [id, x, y] of turns) say(session, id, { type: 'move', x, y })

    for (const id of ['a', 'b']) {
      const state = host.lastState(id)
      const replayed = replayGame(state.config, state.moves)
      expect(replayed.ok && replayed.state.status).toMatchObject({ kind: 'won', winner: 'X' })
    }
    say(session, 'b', { type: 'move', x: 2, y: 2 })
    expect(host.received('b').at(-1)).toEqual({ type: 'error', error: 'game-over' })
  })

  it('saves every change, so a room that went to sleep knows the game', () => {
    const { host, session } = started()
    say(session, 'a', { type: 'move', x: 2, y: 2 })
    expect(host.room?.moves).toEqual([{ player: 'X', x: 2, y: 2 }])
  })
})

describe('a rematch', () => {
  function wonByX() {
    const setup = started()
    for (const [id, x, y] of [
      ['a', 0, 0],
      ['b', 0, 1],
      ['a', 1, 0],
      ['b', 1, 1],
      ['a', 2, 0],
    ] as const) {
      say(setup.session, id, { type: 'move', x, y })
    }
    return setup
  }

  it('is refused while the game is on', () => {
    const { host, session } = started()
    say(session, 'a', { type: 'rematch' })
    expect(host.received('a')).toEqual([{ type: 'error', error: 'game-not-over' }])
  })

  it('starts a new round for both players, in which the other one starts', () => {
    const { host, session } = wonByX()
    say(session, 'b', { type: 'rematch' })
    for (const id of ['a', 'b']) {
      const state = host.lastState(id)
      expect(state.round).toBe(1)
      expect(state.moves).toEqual([])
      expect(state.config.players).toEqual(['O', 'X'])
    }
  })
})

describe('a player who goes away and comes back', () => {
  it('is shown to the other player as not connected, and as connected again', () => {
    const { host, session } = started()
    host.drop('b')
    session.closed()
    expect(host.lastState('a').players).toEqual([
      { id: 'X', name: 'Anna', connected: true },
      { id: 'O', connected: false },
    ])

    host.connect('b2')
    say(session, 'b2', { type: 'join', token: TOKEN_O })
    expect(host.lastState('a').players[1]).toEqual({ id: 'O', connected: true })
    expect(host.lastState('b2')).toMatchObject({ you: 'O' })
  })

  it('gets the same seat and the same game, and the old socket is closed', () => {
    const { host, session } = started()
    say(session, 'a', { type: 'move', x: 1, y: 1 })
    host.connect('b2')
    say(session, 'b2', { type: 'join', token: TOKEN_O })

    expect(host.closes).toEqual([{ id: 'b', code: CLOSE_REPLACED, reason: 'replaced' }])
    expect(host.lastState('b2').moves).toEqual([{ player: 'X', x: 1, y: 1 }])
    say(session, 'b2', { type: 'move', x: 0, y: 0 })
    expect(host.room?.moves).toHaveLength(2)
  })

  it('does not get the room into trouble when the last player goes away', () => {
    const { host, session } = started()
    host.drop('a')
    host.drop('b')
    host.sent.length = 0
    session.closed()
    expect(host.sent).toEqual([])
  })
})
