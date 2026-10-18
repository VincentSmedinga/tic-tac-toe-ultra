import { describe, expect, it } from 'vitest'
import { replayGame } from '../shared/game/index.ts'
import type { ServerMessage, StateMessage } from '../shared/protocol.ts'
import { newRoom } from './room-logic.ts'
import type { Finished, RoomState } from './room-logic.ts'
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
  readonly archived: { id: string; game: Finished }[] = []
  private ids = 0
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
  newGameId() {
    return `game-${(++this.ids).toString()}`
  }
  archive(id: string, game: Finished) {
    this.archived.push({ id, game })
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

describe('keeping a finished game', () => {
  const WIN_FOR_X = [
    ['a', 0, 0],
    ['b', 0, 1],
    ['a', 1, 0],
    ['b', 1, 1],
    ['a', 2, 0],
  ] as const
  /** All nine cells filled and no line for either player. */
  const DRAW = [
    ['a', 0, 0],
    ['b', 1, 1],
    ['a', 2, 2],
    ['b', 1, 0],
    ['a', 1, 2],
    ['b', 0, 2],
    ['a', 2, 0],
    ['b', 2, 1],
    ['a', 0, 1],
  ] as const

  function play(
    setup: ReturnType<typeof started>,
    turns: readonly (readonly [string, number, number])[],
  ) {
    for (const [id, x, y] of turns) say(setup.session, id, { type: 'move', x, y })
  }

  it('does not keep a game that is still going', () => {
    const setup = started()
    play(setup, WIN_FOR_X.slice(0, 4))
    expect(setup.host.archived).toEqual([])
    expect(setup.host.lastState('a').gameId).toBeUndefined()
  })

  it('keeps a won game once, with who played and how it ended', () => {
    const setup = started()
    play(setup, WIN_FOR_X)

    expect(setup.host.archived).toHaveLength(1)
    const [{ id, game }] = setup.host.archived as [{ id: string; game: Finished }]
    expect(game).toMatchObject({
      players: [{ id: 'X', name: 'Anna' }, { id: 'O' }],
      result: { kind: 'won', winner: 'X' },
      owners: [TOKEN_X, TOKEN_O],
    })
    const replayed = replayGame(game.config, game.moves)
    expect(replayed.ok && replayed.state.status.kind).toBe('won')
    // The players are told where the game is kept only when the archive says it has it.
    expect(setup.host.lastState('a').gameId).toBeUndefined()
    setup.session.archived(id)
    expect(setup.host.lastState('a').gameId).toBe(id)
    expect(setup.host.lastState('b').gameId).toBe(id)
    expect(setup.host.archived).toHaveLength(1)
  })

  it('does not tell a game that is archived after a rematch, or one it does not know', () => {
    const setup = started()
    play(setup, WIN_FOR_X)
    const [{ id }] = setup.host.archived as [{ id: string; game: Finished }]
    say(setup.session, 'b', { type: 'rematch' })
    setup.host.sent.length = 0

    setup.session.archived(id)
    setup.session.archived('some-other-game')
    expect(setup.host.sent).toEqual([])
    expect(setup.host.room?.archived).toBeUndefined()
  })

  it('tells nobody twice that the archive has the game', () => {
    const setup = started()
    play(setup, WIN_FOR_X)
    const [{ id }] = setup.host.archived as [{ id: string; game: Finished }]
    setup.session.archived(id)
    setup.host.sent.length = 0
    setup.session.archived(id)
    expect(setup.host.sent).toEqual([])
  })

  it('keeps a drawn game', () => {
    const setup = started()
    play(setup, DRAW)
    expect(setup.host.archived).toHaveLength(1)
    expect(setup.host.archived[0]?.game.result).toEqual({ kind: 'draw' })
    expect(setup.host.archived[0]?.game.moves).toHaveLength(9)
  })

  it('keeps it also when the opponent has lost the connection by then', () => {
    const setup = started()
    play(setup, WIN_FOR_X.slice(0, 4))
    setup.host.drop('b')
    play(setup, WIN_FOR_X.slice(4))
    expect(setup.host.archived).toHaveLength(1)
  })

  it('does not keep it again for a move after the end, a rematch or a player who comes back', () => {
    const setup = started()
    play(setup, WIN_FOR_X)
    say(setup.session, 'b', { type: 'move', x: 2, y: 2 })
    setup.host.connect('b2')
    say(setup.session, 'b2', { type: 'join', token: TOKEN_O })
    expect(setup.host.archived).toHaveLength(1)

    say(setup.session, 'b', { type: 'rematch' })
    expect(setup.host.archived).toHaveLength(1)
    expect(setup.host.lastState('a').gameId).toBeUndefined()
  })

  it('keeps every round of the evening as a game of its own', () => {
    const setup = started()
    play(setup, WIN_FOR_X)
    say(setup.session, 'a', { type: 'rematch' })
    // The other one starts the second round.
    play(setup, [
      ['b', 0, 0],
      ['a', 0, 1],
      ['b', 1, 0],
      ['a', 1, 1],
      ['b', 2, 0],
    ])
    expect(setup.host.archived.map(({ id }) => id)).toEqual(['game-1', 'game-2'])
    expect(setup.host.archived[1]?.game.result).toEqual({ kind: 'won', winner: 'O' })
  })

  it('drops a game that nobody finishes', () => {
    const setup = started()
    play(setup, WIN_FOR_X.slice(0, 3))
    setup.host.drop('a')
    setup.host.drop('b')
    setup.session.closed()
    expect(setup.host.archived).toEqual([])
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
