import { z } from 'zod'
import { HOUSE_CODE_PATTERN, MEMBER_STATUSES } from './house.ts'
import { MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, shapeSchema, tokenSchema } from './protocol.ts'

/** What goes over the WebSocket between a person and a house: JSON, validated on both sides. */

export const houseCodeSchema = z.string().regex(HOUSE_CODE_PATTERN)

/** A name is required in a house: no control characters, and spaces around it don't count. */
export const houseNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .regex(/^[^\p{C}]*$/u)

export const houseClientMessageSchema = z.discriminatedUnion('type', [
  /**
   * Comes in with a name, and the shape this browser had last time, which the house gives when
   * nobody else in it has it. Sent again on the same socket, it changes the name.
   */
  z.object({
    type: z.literal('join'),
    token: tokenSchema,
    name: houseNameSchema,
    shape: shapeSchema.optional(),
  }),
  /** Chooses a shape, or another one; refused when somebody else in the house has it. */
  z.object({ type: z.literal('choose'), shape: shapeSchema }),
])
export type HouseClientMessage = z.infer<typeof houseClientMessageSchema>

export const houseErrorCodeSchema = z.enum([
  'invalid-message',
  'not-joined',
  'house-full',
  'shape-taken',
])
export type HouseErrorCode = z.infer<typeof houseErrorCodeSchema>

/** The whole house as one person sees it, sent again after every change. */
export const houseStateSchema = z.object({
  type: z.literal('state'),
  code: houseCodeSchema,
  /** The id of the one who receives this, among `members`. */
  you: z.string(),
  /** Who has the house open now, in the order they came in. */
  members: z.array(
    z.object({
      id: z.string(),
      name: houseNameSchema,
      /** 2, 3, … for the second and third with this name: shown after it, "Anna (2)". */
      number: z.number().int().min(2).optional(),
      shape: shapeSchema.optional(),
      status: z.enum(MEMBER_STATUSES),
    }),
  ),
})
export type HouseState = z.infer<typeof houseStateSchema>
export type HouseMember = HouseState['members'][number]

export const houseServerMessageSchema = z.discriminatedUnion('type', [
  houseStateSchema,
  z.object({ type: z.literal('error'), error: houseErrorCodeSchema }),
])
export type HouseServerMessage = z.infer<typeof houseServerMessageSchema>

function parse<T>(raw: unknown, schema: z.ZodType<T>, limit: number): T | null {
  if (typeof raw !== 'string' || raw.length > limit) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(json)
  return result.success ? result.data : null
}

/** Reads a message a person sent: anything too long, not text, not JSON or not valid is refused. */
export function parseHouseClientMessage(raw: unknown): HouseClientMessage | null {
  return parse(raw, houseClientMessageSchema, MAX_MESSAGE_LENGTH)
}

/** Reads a message from the house, for the app; null when it isn't one. */
export function parseHouseServerMessage(raw: unknown): HouseServerMessage | null {
  return parse(raw, houseServerMessageSchema, Number.POSITIVE_INFINITY)
}
