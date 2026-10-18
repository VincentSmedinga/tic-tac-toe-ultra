import { applyMove, replayGame } from '../shared/game/index.ts'
import type { Cell, GameState, Move, PlayerId } from '../shared/game/index.ts'
import type { ErrorCode, StateMessage } from '../shared/protocol.ts'
import { ROOM_PLAYERS, roomConfig } from '../shared/room.ts'

/**
 * The rules of a room, as functions on its state: who may sit, whose move is allowed, when there
 * is a rematch. No sockets, no storage, so it is tested without Cloudflare. What a room keeps is
 * only this state: the game is rebuilt from the moves with the engine in shared/game/.
 */

export interface Seat {
  /** Who this player's browser is; never sent to the other player. */
  token: string
  id: PlayerId
  name?: string
}

export interface RoomState {
  round: number
  seats: Seat[]
  moves: Move[]
}

export type Change = { ok: true; room: RoomState } | { ok: false; error: ErrorCode }

export type RoomGame =
  | { kind: 'waiting' }
  | { kind: 'game'; game: GameState }
  /** The stored moves don't replay: only a rematch gets the room going again. */
  | { kind: 'damaged' }

export function newRoom(): RoomState {
  return { round: 0, seats: [], moves: [] }
}

function ok(room: RoomState): Change {
  return { ok: true, room }
}

function fail(error: ErrorCode): Change {
  return { ok: false, error }
}

/** The game of the room: it starts when two players have a seat. */
export function gameOf(room: RoomState): RoomGame {
  if (room.seats.length < ROOM_PLAYERS.length) return { kind: 'waiting' }
  const replayed = replayGame(roomConfig(room.round), room.moves)
  return replayed.ok ? { kind: 'game', game: replayed.state } : { kind: 'damaged' }
}

/** Takes a seat, or gets the same one back when the token already has one; refuses a third. */
export function join(room: RoomState, token: string, name: string | undefined): Change {
  const known = room.seats.find((seat) => seat.token === token)
  if (known) {
    const seats = room.seats.map((seat) => (seat === known ? withName(seat, name) : seat))
    return ok({ ...room, seats })
  }
  const id = ROOM_PLAYERS[room.seats.length]
  if (id === undefined) return fail('room-full')
  return ok({ ...room, seats: [...room.seats, withName({ token, id }, name)] })
}

function withName(seat: Seat, name: string | undefined): Seat {
  return name === undefined ? seat : { ...seat, name }
}

/** A move of the player with this token; only the engine decides whether it is allowed. */
export function play(room: RoomState, token: string, cell: Cell): Change {
  const seat = room.seats.find((candidate) => candidate.token === token)
  if (!seat) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'damaged') return fail('room-damaged')

  const result = applyMove(current.game, { player: seat.id, x: cell.x, y: cell.y })
  return result.ok ? ok({ ...room, moves: [...result.state.moves] }) : fail(result.error)
}

/** A new round once the game is over (or damaged): the other player starts. */
export function rematch(room: RoomState, token: string): Change {
  if (!room.seats.some((seat) => seat.token === token)) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'game' && current.game.status.kind === 'playing')
    return fail('game-not-over')
  return ok({ ...room, round: room.round + 1, moves: [] })
}

/** The room as the player with this token sees it, or null when they have no seat. */
export function stateFor(
  room: RoomState,
  token: string,
  code: string,
  connected: ReadonlySet<string>,
): StateMessage | null {
  const seat = room.seats.find((candidate) => candidate.token === token)
  if (!seat) return null
  const current = gameOf(room)
  const config = roomConfig(room.round)
  return {
    type: 'state',
    code,
    you: seat.id,
    round: room.round,
    players: room.seats.map(({ token: seatToken, id, name }) => ({
      id,
      ...(name === undefined ? {} : { name }),
      connected: connected.has(seatToken),
    })),
    config: { ...config, players: [...config.players] },
    // A damaged room shows an empty board until someone starts a rematch.
    moves: current.kind === 'game' ? [...current.game.moves] : [],
  }
}
