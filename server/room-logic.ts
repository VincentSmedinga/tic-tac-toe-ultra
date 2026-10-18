import { applyMove, replayGame } from '../shared/game/index.ts'
import type { Cell, GameState, Move } from '../shared/game/index.ts'
import type { ErrorCode, StateMessage, StoredGame } from '../shared/protocol.ts'
import { ROOM_SEATS, roomConfig } from '../shared/room.ts'
import type { ShapeId } from '../shared/shapes.ts'

/**
 * The rules of a room, as functions on its state: who may sit, which shape each one has, whose move
 * is allowed, when there is a rematch. No sockets, no storage, so it is tested without Cloudflare. What a room keeps is
 * only this state: the game is rebuilt from the moves with the engine in shared/game/.
 */

export interface Seat {
  /** Who this player's browser is; never sent to the other player. */
  token: string
  /** The seat (`X` or `O`), in the order of joining; the player of the game is the shape. */
  id: string
  name?: string
  /** The shape this player chose; the game starts when every seat has one. */
  shape?: ShapeId
}

export interface RoomState {
  round: number
  seats: Seat[]
  moves: Move[]
  /** The id the game of this round is kept under, set when the round is over; a rematch clears it. */
  gameId?: string
  /** The archive has confirmed it has the game: only then are the players told the id. */
  archived?: boolean
}

export type Change = { ok: true; room: RoomState } | { ok: false; error: ErrorCode }

export type RoomGame =
  /** Not everybody is here yet. */
  | { kind: 'waiting' }
  /** Everybody is here, and somebody has not chosen a shape yet. */
  | { kind: 'choosing' }
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

/** The shapes of the seats in seat order, when there is a seat for everybody and each has chosen. */
function shapesOf(room: RoomState): ShapeId[] | null {
  if (room.seats.length < ROOM_SEATS.length) return null
  const shapes = room.seats.flatMap((seat) => (seat.shape === undefined ? [] : [seat.shape]))
  return shapes.length === room.seats.length ? shapes : null
}

/** The game of the room: it starts when every seat is taken and every player has a shape. */
export function gameOf(room: RoomState): RoomGame {
  if (room.seats.length < ROOM_SEATS.length) return { kind: 'waiting' }
  const shapes = shapesOf(room)
  if (!shapes) return { kind: 'choosing' }
  const replayed = replayGame(roomConfig(room.round, shapes), room.moves)
  return replayed.ok ? { kind: 'game', game: replayed.state } : { kind: 'damaged' }
}

/** Whether somebody else than this seat has the shape. */
function takenByOther(room: RoomState, token: string, shape: ShapeId): boolean {
  return room.seats.some((seat) => seat.token !== token && seat.shape === shape)
}

/**
 * Takes a seat, or gets the same one back when the token already has one; refuses a third. The
 * shape that was asked for (the one this browser had last time) is taken when it is free and the
 * player has none yet; otherwise it is left to them to choose.
 */
export function join(
  room: RoomState,
  token: string,
  name: string | undefined,
  shape?: ShapeId,
): Change {
  const known = room.seats.find((seat) => seat.token === token)
  if (known) {
    const seats = room.seats.map((seat) =>
      seat === known ? withShape(withName(seat, name), room, shape) : seat,
    )
    return ok({ ...room, seats })
  }
  const id = ROOM_SEATS[room.seats.length]
  if (id === undefined) return fail('room-full')
  const seat = withShape(withName({ token, id }, name), room, shape)
  return ok({ ...room, seats: [...room.seats, seat] })
}

function withName(seat: Seat, name: string | undefined): Seat {
  return name === undefined ? seat : { ...seat, name }
}

function withShape(seat: Seat, room: RoomState, shape: ShapeId | undefined): Seat {
  if (shape === undefined || seat.shape !== undefined || takenByOther(room, seat.token, shape))
    return seat
  return { ...seat, shape }
}

/**
 * Chooses a shape, or another one, for as long as the game hasn't started: it starts when every
 * seat has one, and from then on the shapes are the players of the evening.
 */
export function choose(room: RoomState, token: string, shape: ShapeId): Change {
  const seat = room.seats.find((candidate) => candidate.token === token)
  if (!seat) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'game' || current.kind === 'damaged') return fail('shape-locked')
  if (takenByOther(room, token, shape)) return fail('shape-taken')
  return ok({
    ...room,
    seats: room.seats.map((candidate) =>
      candidate === seat ? { ...candidate, shape } : candidate,
    ),
  })
}

/** A move of the player with this token; only the engine decides whether it is allowed. */
export function play(room: RoomState, token: string, cell: Cell): Change {
  const seat = room.seats.find((candidate) => candidate.token === token)
  if (!seat) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'choosing' || seat.shape === undefined) return fail('shape-needed')
  if (current.kind === 'damaged') return fail('room-damaged')

  const result = applyMove(current.game, { player: seat.shape, x: cell.x, y: cell.y })
  return result.ok ? ok({ ...room, moves: [...result.state.moves] }) : fail(result.error)
}

/** A new round once the game is over (or damaged): the other player starts. */
export function rematch(room: RoomState, token: string): Change {
  if (!room.seats.some((seat) => seat.token === token)) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'choosing') return fail('shape-needed')
  if (current.kind === 'game' && current.game.status.kind === 'playing')
    return fail('game-not-over')
  return ok({ round: room.round + 1, seats: room.seats, moves: [] })
}

/** Whether the round has been won or drawn. A damaged or waiting room is not over. */
export function isOver(room: RoomState): boolean {
  const current = gameOf(room)
  return current.kind === 'game' && current.game.status.kind !== 'playing'
}

/** What a room hands over to be kept when a round ends: a game without the id and the time. */
export type Finished = Omit<StoredGame, 'id' | 'finishedAt'> & {
  /** The tokens of everyone who sat at the game: how the server finds "your games" again. */
  owners: string[]
}

/** The finished round of a room as it is kept, or null when the round isn't over. */
export function finishedGame(room: RoomState): Finished | null {
  const current = gameOf(room)
  if (current.kind !== 'game') return null
  const { status, config, moves } = current.game
  if (status.kind === 'playing') return null
  return {
    config: { ...config, players: [...config.players] },
    moves: [...moves],
    // The players of a game are its shapes, in seat order.
    players: room.seats.flatMap(({ shape, name }) =>
      shape === undefined ? [] : [{ id: shape, ...(name === undefined ? {} : { name }) }],
    ),
    result: status.kind === 'won' ? { kind: 'won', winner: status.winner } : { kind: 'draw' },
    owners: room.seats.map((seat) => seat.token),
  }
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
  // The game is there once everybody has a shape; a damaged room shows an empty board until
  // someone starts a rematch.
  const shapes = shapesOf(room)
  const config = shapes ? roomConfig(room.round, shapes) : undefined
  return {
    type: 'state',
    code,
    you: seat.id,
    round: room.round,
    players: room.seats.map(({ token: seatToken, id, name, shape }) => ({
      id,
      ...(name === undefined ? {} : { name }),
      ...(shape === undefined ? {} : { shape }),
      connected: connected.has(seatToken),
    })),
    ...(config ? { config: { ...config, players: [...config.players] } } : {}),
    moves: current.kind === 'game' ? [...current.game.moves] : [],
    // Telling the id before the archive has the game would send people to a link that isn't there yet.
    ...(room.gameId === undefined || room.archived !== true ? {} : { gameId: room.gameId }),
  }
}

/**
 * A room as it was stored by an earlier version, when the players were `X` and `O` and nobody chose
 * a shape: a game in progress goes on with the cross and the circle. Rooms made since never hold
 * those ids in a move, so a room that is already in the new form comes back unchanged.
 */
export function upgradeRoom(room: RoomState): RoomState {
  const legacy = room.moves.some((move) => move.player === 'X' || move.player === 'O')
  if (!legacy) return room
  const legacyShapes: Record<string, ShapeId> = { X: 'cross', O: 'circle' }
  return {
    ...room,
    seats: room.seats.map((seat) => ({ ...seat, shape: seat.shape ?? legacyShapes[seat.id] })),
    moves: room.moves.map((move) => ({
      ...move,
      player: legacyShapes[move.player] ?? move.player,
    })),
  }
}
