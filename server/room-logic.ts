import { applyMove, replayGame } from '../shared/game/index.ts'
import type { Cell, GameState, Move } from '../shared/game/index.ts'
import type { ErrorCode, StateMessage, StoredGame } from '../shared/protocol.ts'
import {
  CLASSIC_FIELD,
  DEFAULT_PLAYERS,
  PLAYER_LIMITS,
  roomConfig,
  seatId,
} from '../shared/room.ts'
import type { FieldSettings } from '../shared/room.ts'
import type { ShapeId } from '../shared/shapes.ts'

/**
 * The rules of a room, as functions on its state: who may sit, which shape each one has, whose move
 * is allowed, when the game starts and when there is a rematch. No sockets, no storage, so it is
 * tested without Cloudflare. What a room keeps is only this state: the game is rebuilt from the moves with the engine in shared/game/.
 */

export interface Seat {
  /** Who this player's browser is; never sent to the other player. */
  token: string
  /** The seat (`X`, `O`, `3`, …), in the order of joining; the player of the game is the shape. */
  id: string
  name?: string
  /** The shape this player chose; the game starts when every seat has one. */
  shape?: ShapeId
  /**
   * The round this person left after, for good: they played it to its end and are not in the next
   * one. The seat stays (its id, its token and its shape), so the other seats keep their ids.
   */
  left?: number
}

export interface RoomState {
  /** How big the field is and how many in a row win; a room stored before this is classic. */
  field?: FieldSettings
  /** How many people may play; a room stored before this has two seats. */
  seatCount?: number
  /** The one who made the room (the first seat) has said "start", with fewer seats taken than there are. */
  started?: boolean
  round: number
  seats: Seat[]
  moves: Move[]
  /** When the first move of this round was played; a rematch clears it. */
  startedAt?: number
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

export function newRoom(
  field: FieldSettings = CLASSIC_FIELD,
  seatCount: number = DEFAULT_PLAYERS,
): RoomState {
  return { field, seatCount, round: 0, seats: [], moves: [] }
}

/** How many seats the room has. */
export function seatCountOf(room: RoomState): number {
  return room.seatCount ?? DEFAULT_PLAYERS
}

/**
 * Whether the game is on its way: every seat has a person, or the one who made the room has said
 * to start with the people who are there (at least two). From then on nobody else can sit down.
 */
function isOn(room: RoomState): boolean {
  if (room.seats.length < PLAYER_LIMITS.min) return false
  return room.started === true || room.seats.length >= seatCountOf(room)
}

/** Whether this seat is still part of the evening: it has not been left. */
function isPresent(seat: Seat): boolean {
  return seat.left === undefined
}

/** The seat of this token, unless it has been left: somebody who left is no longer in the room. */
function seatOf(room: RoomState, token: string): Seat | undefined {
  return room.seats.find((seat) => seat.token === token && isPresent(seat))
}

/** How many people are still in the evening. */
export function presentCount(room: RoomState): number {
  return room.seats.filter(isPresent).length
}

/** The seats that play the round the room is in: those still there, and those who left after it. */
function playingSeats(room: RoomState): Seat[] {
  return room.seats.filter((seat) => seat.left === undefined || seat.left >= room.round)
}

/** The field of a room: the one it was made with, or the classic one for a room from before. */
export function fieldOf(room: RoomState): FieldSettings {
  return room.field ?? CLASSIC_FIELD
}

function ok(room: RoomState): Change {
  return { ok: true, room }
}

function fail(error: ErrorCode): Change {
  return { ok: false, error }
}

/** The shapes of the seats in seat order, when the game is on and each person has chosen. */
function shapesOf(room: RoomState): ShapeId[] | null {
  if (!isOn(room)) return null
  const seats = playingSeats(room)
  const shapes = seats.flatMap((seat) => (seat.shape === undefined ? [] : [seat.shape]))
  return shapes.length === seats.length ? shapes : null
}

/** The game of the room: it starts when it is on and every player has a shape. */
export function gameOf(room: RoomState): RoomGame {
  if (!isOn(room)) return { kind: 'waiting' }
  const shapes = shapesOf(room)
  if (!shapes) return { kind: 'choosing' }
  const replayed = replayGame(roomConfig(room.round, shapes, fieldOf(room)), room.moves)
  return replayed.ok ? { kind: 'game', game: replayed.state } : { kind: 'damaged' }
}

/** Whether somebody else than this seat has the shape. */
function takenByOther(room: RoomState, token: string, shape: ShapeId): boolean {
  return room.seats.some((seat) => seat.token !== token && seat.shape === shape)
}

/**
 * Takes a seat, or gets the same one back when the token already has one; refuses somebody new when
 * every seat is taken or the game has been started with the people who were there. The
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
  if (known?.left !== undefined) return fail('left')
  if (known) {
    const seats = room.seats.map((seat) =>
      seat === known ? withShape(withName(seat, name), room, shape) : seat,
    )
    return ok({ ...room, seats })
  }
  if (room.started === true) return fail('game-started')
  if (room.seats.length >= seatCountOf(room)) return fail('room-full')
  const seat = withShape(withName({ token, id: seatId(room.seats.length) }, name), room, shape)
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
  const seat = seatOf(room, token)
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

/**
 * Starts the game with the people who are there, when the room has more seats than people: only for
 * the one who made it (the first seat), with at least two people who all have a shape. A room whose
 * seats are all taken starts by itself, as soon as everybody has chosen.
 */
export function startGame(room: RoomState, token: string): Change {
  if (!seatOf(room, token)) return fail('not-joined')
  if (room.seats[0]?.token !== token) return fail('not-host')
  if (isOn(room)) return fail('game-started')
  if (room.seats.length < PLAYER_LIMITS.min) return fail('not-enough-players')
  if (room.seats.some((seat) => seat.shape === undefined)) return fail('shape-needed')
  return ok({ ...room, started: true })
}

/** A move of the player with this token; only the engine decides whether it is allowed. */
export function play(room: RoomState, token: string, cell: Cell): Change {
  const seat = seatOf(room, token)
  if (!seat) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'choosing' || seat.shape === undefined) return fail('shape-needed')
  if (current.kind === 'damaged') return fail('room-damaged')

  const result = applyMove(current.game, { player: seat.shape, x: cell.x, y: cell.y })
  return result.ok ? ok({ ...room, moves: [...result.state.moves] }) : fail(result.error)
}

/**
 * A new round once the game is over (or damaged): the next player starts. It is played by the
 * people who are still there, so when fewer than two are left the room is over.
 */
export function rematch(room: RoomState, token: string): Change {
  if (!seatOf(room, token)) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting') return fail('waiting-for-opponent')
  if (current.kind === 'choosing') return fail('shape-needed')
  if (current.kind === 'game' && current.game.status.kind === 'playing')
    return fail('game-not-over')
  if (presentCount(room) < PLAYER_LIMITS.min) return fail('room-over')
  return ok({
    field: room.field,
    seatCount: room.seatCount,
    started: room.started,
    round: room.round + 1,
    seats: room.seats,
    moves: [],
  })
}

/**
 * Leaves the evening for good, once the round is over (or damaged): the seat is marked with the
 * round it was in, so that this round still has all its players and the next one has not.
 */
export function leave(room: RoomState, token: string): Change {
  const seat = seatOf(room, token)
  if (!seat) return fail('not-joined')
  const current = gameOf(room)
  if (current.kind === 'waiting' || current.kind === 'choosing') return fail('game-not-over')
  if (current.kind === 'game' && current.game.status.kind === 'playing')
    return fail('game-not-over')
  return ok({
    ...room,
    seats: room.seats.map((candidate) =>
      candidate === seat ? { ...candidate, left: room.round } : candidate,
    ),
  })
}

/** Whether the round has been won or drawn. A damaged or waiting room is not over. */
export function isOver(room: RoomState): boolean {
  const current = gameOf(room)
  return current.kind === 'game' && current.game.status.kind !== 'playing'
}

/** What a room hands over to be kept when a round ends: a game without the id and the time. */
export type Finished = Omit<StoredGame, 'id' | 'finishedAt'> & {
  /**
   * The tokens of everyone who sat at the game, in the order of `players`: how the server finds
   * "your games" again, and which player each of them was.
   */
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
    ...(room.startedAt === undefined ? {} : { startedAt: room.startedAt }),
    // The players of a game are its shapes, in seat order: those who play this round.
    players: playingSeats(room).flatMap(({ shape, name }) =>
      shape === undefined ? [] : [{ id: shape, ...(name === undefined ? {} : { name }) }],
    ),
    result: status.kind === 'won' ? { kind: 'won', winner: status.winner } : { kind: 'draw' },
    owners: playingSeats(room).map((seat) => seat.token),
  }
}

/** The room as the player with this token sees it, or null when they have no seat. */
export function stateFor(
  room: RoomState,
  token: string,
  code: string,
  connected: ReadonlySet<string>,
): StateMessage | null {
  const seat = seatOf(room, token)
  if (!seat) return null
  const current = gameOf(room)
  // The game is there once everybody has a shape; a damaged room shows an empty board until
  // someone starts a rematch.
  const shapes = shapesOf(room)
  const config = shapes ? roomConfig(room.round, shapes, fieldOf(room)) : undefined
  return {
    type: 'state',
    code,
    you: seat.id,
    field: { ...fieldOf(room) },
    seats: seatCountOf(room),
    round: room.round,
    players: room.seats.map(({ token: seatToken, id, name, shape, left }) => ({
      id,
      ...(name === undefined ? {} : { name }),
      ...(shape === undefined ? {} : { shape }),
      connected: connected.has(seatToken),
      ...(left === undefined ? {} : { left: true }),
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
