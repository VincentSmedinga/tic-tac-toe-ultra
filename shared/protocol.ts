import { z } from 'zod'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './room.ts'

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

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), token: tokenSchema, name: nameSchema }),
  z.object({
    type: z.literal('move'),
    x: z.number().int().min(0).max(99),
    y: z.number().int().min(0).max(99),
  }),
  z.object({ type: z.literal('rematch') }),
])
export type ClientMessage = z.infer<typeof clientMessageSchema>

/** What went wrong with a message; the first five are about the room, the rest about the move. */
export const errorCodeSchema = z.enum([
  'invalid-message',
  'not-joined',
  'room-full',
  'waiting-for-opponent',
  'room-damaged',
  'game-over',
  'game-not-over',
  'not-your-turn',
  'out-of-bounds',
  'cell-taken',
])
export type ErrorCode = z.infer<typeof errorCodeSchema>

const configSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  winLength: z.number().int().min(2),
  players: z.array(z.string()).min(2),
})
const moveSchema = z.object({ player: z.string(), x: z.number().int(), y: z.number().int() })

/**
 * The whole room as one player sees it, sent again after every change. A game is its config plus
 * its moves (see shared/game/): the receiver rebuilds the game with `replayGame`, so there is no
 * second description of a game to keep in step.
 */
export const stateMessageSchema = z.object({
  type: z.literal('state'),
  code: roomCodeSchema,
  /** The player id of the one who receives this. */
  you: z.string(),
  /** Which round of the evening this is; the starting player alternates with it. */
  round: z.number().int().min(0),
  /** Who has a seat, in seat order, and whether they are connected right now. */
  players: z.array(
    z.object({ id: z.string(), name: z.string().optional(), connected: z.boolean() }),
  ),
  config: configSchema,
  moves: z.array(moveSchema),
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
