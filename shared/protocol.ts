import { z } from 'zod'
import {
  FIELD_LIMITS,
  PLAYER_LIMITS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidField,
} from './room.ts'
import { SHAPE_IDS } from './shapes.ts'

/** What goes over the WebSocket between a player and a room: JSON, validated on both sides. */

export const MAX_MESSAGE_LENGTH = 1024
export const MAX_NAME_LENGTH = 20

export const roomCodeSchema = z
  .string()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH.toString()}}$`))

/** Who a browser is, kept in its localStorage: how a room knows a player who comes back. */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/)

/** Optional; no control characters; spaces around it and an empty name count as no name. */
const nameSchema = z
  .string()
  .trim()
  .max(MAX_NAME_LENGTH)
  .regex(/^[^\p{C}]*$/u)
  .transform((name) => (name === '' ? undefined : name))
  .optional()

export const shapeSchema = z.enum(SHAPE_IDS)

const fieldShape = z.object({
  width: z.number().int().min(FIELD_LIMITS.minSide).max(FIELD_LIMITS.maxSide),
  height: z.number().int().min(FIELD_LIMITS.minSide).max(FIELD_LIMITS.maxSide),
  winLength: z.number().int().min(FIELD_LIMITS.minWin).max(FIELD_LIMITS.maxWin),
})

/** The field of a room, as asked for when it is made and as told to the players. */
export const fieldSchema = fieldShape.refine(isValidField, {
  message: 'odd numbers, and the row must fit on the field',
})

/** What whoever makes a room asks for: the field, and how many people may play (two by default). */
export const roomSettingsSchema = fieldShape
  .extend({ players: z.number().int().min(PLAYER_LIMITS.min).max(PLAYER_LIMITS.max).optional() })
  .refine(isValidField, { message: 'odd numbers, and the row must fit on the field' })

export const clientMessageSchema = z.discriminatedUnion('type', [
  /** `shape` is the one this browser used last: taken when it is free and none is chosen yet. */
  z.object({
    type: z.literal('join'),
    token: tokenSchema,
    name: nameSchema,
    shape: shapeSchema.optional(),
  }),
  /** Chooses a shape, or another one, until the game has started. */
  z.object({ type: z.literal('choose'), shape: shapeSchema }),
  /** Starts the game with the people who are there: only for the one who made the room. */
  z.object({ type: z.literal('start') }),
  z.object({
    type: z.literal('move'),
    x: z.number().int().min(0).max(99),
    y: z.number().int().min(0).max(99),
  }),
  z.object({ type: z.literal('rematch') }),
])
export type ClientMessage = z.infer<typeof clientMessageSchema>

/** What went wrong with a message; the first ones are about the room and the shapes, the rest about the move. */
export const errorCodeSchema = z.enum([
  'invalid-message',
  'not-joined',
  'room-full',
  'waiting-for-opponent',
  'room-damaged',
  'shape-needed',
  'shape-taken',
  'shape-locked',
  'game-started',
  'not-host',
  'not-enough-players',
  'game-over',
  'game-not-over',
  'not-your-turn',
  'out-of-bounds',
  'cell-taken',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const configSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  winLength: z.number().int().min(2),
  players: z.array(z.string()).min(2),
})
export const moveSchema = z.object({ player: z.string(), x: z.number().int(), y: z.number().int() })

/** The address of a stored game: random and unguessable, so knowing it is the right to see it. */
export const GAME_ID_LENGTH = 16
export const gameIdSchema = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${GAME_ID_LENGTH.toString()}}$`))

/**
 * A finished game as it is kept: its config plus its moves (the engine replays them), who sat
 * where, when it ended and how. Never holds a token: who played is only known to the server.
 */
export const storedGameSchema = z.object({
  id: gameIdSchema,
  /** When the last move was played, in milliseconds since 1970. */
  finishedAt: z.number().int().nonnegative(),
  /**
   * When the first move was played, in milliseconds since 1970: with `finishedAt` it says how long
   * the game took. Games kept before this have none, and are left out of what is about duration.
   */
  startedAt: z.number().int().nonnegative().optional(),
  config: configSchema,
  moves: z.array(moveSchema),
  /** Everyone who sat at the game, by player id, with the name they typed if any. */
  players: z.array(z.object({ id: z.string(), name: z.string().optional() })),
  result: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('won'), winner: z.string() }),
    z.object({ kind: z.literal('draw') }),
  ]),
})
export type StoredGame = z.infer<typeof storedGameSchema>

/** What a list of games shows of one game: who, how it ended and when, without the moves. */
export const gameSummarySchema = storedGameSchema
  .pick({ id: true, finishedAt: true, players: true, result: true })
  .extend({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    moves: z.number().int().min(0),
  })
export type GameSummary = z.infer<typeof gameSummarySchema>

/** Where the next page of a list starts: the time and the id of the last game of the page before. */
export const gamesCursorSchema = z
  .string()
  .regex(new RegExp(`^\\d{1,15}\\.[A-Za-z0-9_-]{${GAME_ID_LENGTH.toString()}}$`))

/** One page of the games a browser played, newest first; `next` is there when there are more. */
export const gamesPageSchema = z.object({
  games: z.array(gameSummarySchema),
  next: gamesCursorSchema.optional(),
})
export type GamesPage = z.infer<typeof gamesPageSchema>

export const GAMES_PAGE_SIZE = 20
export const MAX_GAMES_PAGE_SIZE = 50

/**
 * What `GET /api/stats` answers: the numbers of all finished games together, worked out from the
 * archive. It holds no names, no tokens and no moves of a single game: only counts, and the shapes.
 * Anything about how long a game took leaves out the games kept before they had a start time.
 */
const countSchema = z.number().int().min(0)
const spreadSchema = z.object({
  /** How many games the numbers are from. */
  games: countSchema,
  average: z.number().min(0),
  median: z.number().min(0),
  shortest: z.number().min(0),
  longest: z.number().min(0),
})
const outcomesSchema = z.object({ won: countSchema, drawn: countSchema })
const starterSchema = z.object({ won: countSchema, lost: countSchema, drawn: countSchema })

export const statsSchema = z.object({
  games: countSchema,
  won: countSchema,
  drawn: countSchema,
  /** The last twelve weeks, oldest first, empty weeks included; `start` is a Monday, as YYYY-MM-DD. */
  weeks: z.array(outcomesSchema.extend({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  /** Milliseconds from the first move to the last. */
  duration: spreadSchema.nullable(),
  /** Moves per game. */
  moves: spreadSchema.nullable(),
  /** Every shape that was played, the most played first. */
  shapes: z.array(outcomesSchema.extend({ shape: shapeSchema, games: countSchema })),
  /** The player who made the first move, over all games: did starting win? */
  starter: starterSchema,
  /** The kinds of game that were played (field, row and number of players), the most played first. */
  kinds: z.array(
    z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      winLength: z.number().int().min(2),
      players: z.number().int().min(2),
      games: countSchema,
      won: countSchema,
      drawn: countSchema,
      starter: starterSchema,
      averageMoves: z.number().min(0),
      /** How often each cell was played first, row by row (`width` × `height` numbers). */
      firstMoves: z.array(countSchema),
      /** In how many won games each cell was part of a winning line, row by row. */
      winningCells: z.array(countSchema),
    }),
  ),
  /**
   * The rooms, from the time rooms were counted: how many were made, in how many a round was
   * finished, in how many there was a rematch, and how many rounds the rooms had.
   */
  rooms: z.object({
    made: countSchema,
    played: countSchema,
    rematches: countSchema,
    averageRounds: z.number().min(0),
    mostRounds: countSchema,
    /** Rooms with 1, 2, 3 and 4 rounds, and with 5 or more. */
    rounds: z.array(countSchema).length(5),
  }),
  /** Games finished on each day of the week (Monday first) and each hour of the day, Dutch time. */
  weekdays: z.array(countSchema).length(7),
  hours: z.array(countSchema).length(24),
  fun: z.object({
    /** The quickest win, by the clock. */
    fastestWin: z
      .object({ shape: shapeSchema, milliseconds: countSchema, moves: countSchema })
      .nullable(),
    /** The game with the most moves. */
    longestGame: z
      .object({ moves: countSchema, width: countSchema, height: countSchema })
      .nullable(),
    /** The most games won in a row by one shape, counting only the games that shape played. */
    longestRun: z.object({ shape: shapeSchema, wins: countSchema }).nullable(),
    /** The two shapes that sat at the same game most often. */
    favouritePair: z
      .object({ shapes: z.tuple([shapeSchema, shapeSchema]), games: countSchema })
      .nullable(),
  }),
})
export type Stats = z.infer<typeof statsSchema>

/**
 * What `GET /api/stats/mine` answers: the games of one browser, counted. Only for that browser (its
 * token is in the header), so it is never kept by a cache that others use.
 */
export const ownStatsSchema = z.object({
  games: countSchema,
  won: countSchema,
  lost: countSchema,
  drawn: countSchema,
  /** Games of which it isn't known any more which player this browser was: not a win or a loss. */
  unknown: countSchema,
  /** The shape this browser played most, with how many games. */
  favourite: z.object({ shape: shapeSchema, games: countSchema }).nullable(),
})
export type OwnStats = z.infer<typeof ownStatsSchema>

/**
 * The whole room as one player sees it, sent again after every change. A game is its config plus
 * its moves (see shared/game/): the receiver rebuilds the game with `replayGame`, so there is no
 * second description of a game to keep in step.
 */
export const stateMessageSchema = z.object({
  type: z.literal('state'),
  code: roomCodeSchema,
  /** The seat of the one who receives this. */
  you: z.string(),
  /** The field of this room, from the moment it is made: how big, and how many in a row win. */
  field: fieldSchema,
  /** How many seats the room has, taken or not: the first one is the one who may start the game. */
  seats: z.number().int().min(PLAYER_LIMITS.min).max(PLAYER_LIMITS.max),
  /** Which round of the evening this is; the starting player alternates with it. */
  round: z.number().int().min(0),
  /** Who has a seat, in seat order, and whether they are connected right now. */
  players: z.array(
    z.object({
      /** The seat, `X` or `O`: not the shape. */
      id: z.string(),
      name: z.string().optional(),
      /** The shape this player has chosen, if they have. */
      shape: shapeSchema.optional(),
      connected: z.boolean(),
    }),
  ),
  /**
   * The game of this round: there from the moment every seat has a shape, and its players are the
   * shapes. Without it the room is still waiting for players or for their choice.
   */
  config: configSchema.optional(),
  moves: z.array(moveSchema),
  /** The id of the stored game once this round is over, so that it can be watched again. */
  gameId: gameIdSchema.optional(),
})
export type StateMessage = z.infer<typeof stateMessageSchema>

export const serverMessageSchema = z.discriminatedUnion('type', [
  stateMessageSchema,
  z.object({ type: z.literal('error'), error: errorCodeSchema }),
])
export type ServerMessage = z.infer<typeof serverMessageSchema>

/** Reads a message a player sent: anything too long, not text, not JSON or not valid is refused. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const result = clientMessageSchema.safeParse(json)
  return result.success ? result.data : null
}

/** Reads a message from the server, for the client; null when it isn't one. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const result = serverMessageSchema.safeParse(json)
  return result.success ? result.data : null
}
