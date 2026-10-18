import type { GameConfig, PlayerId } from './game/index.ts'

/**
 * How many people a room can have: from two to one for every shape. Whoever makes the room says
 * how many seats it has, two being what it is when nobody says anything.
 */
export const PLAYER_LIMITS = { min: 2, max: 12 } as const
export const DEFAULT_PLAYERS = 2

/**
 * A seat of a room, in the order people join: the first to join has the first seat, and is the one
 * who may start the game. A seat is not a player of the game: the player is the shape that whoever
 * sits there has chosen. The seats are named `X`, `O`, `3`, `4`, … (the first two as they always were).
 */
export function seatId(index: number): string {
  return index === 0 ? 'X' : index === 1 ? 'O' : (index + 1).toString()
}

export function isValidPlayerCount(count: number): boolean {
  return Number.isInteger(count) && count >= PLAYER_LIMITS.min && count <= PLAYER_LIMITS.max
}

/** The field of a room: how big it is and how many marks in a row win. */
export interface FieldSettings {
  readonly width: number
  readonly height: number
  readonly winLength: number
}

/**
 * How big a field may be, and how long a winning row: what the room and the start screen allow.
 * Everything is odd (sides 3, 5, … 19 and rows 3, 5, 7, 9): a field with a middle, and a row that
 * has one too.
 */
export const FIELD_LIMITS = { minSide: 3, maxSide: 19, minWin: 3, maxWin: 9 } as const

/** Classic tic-tac-toe, which a room is when nobody asks for anything else. */
export const CLASSIC_FIELD: FieldSettings = { width: 3, height: 3, winLength: 3 }

/** The field the start screen offers as ready-made choices, besides choosing your own. */
export const FIELD_PRESETS: readonly (FieldSettings & { id: string })[] = [
  { id: 'classic', ...CLASSIC_FIELD },
  { id: 'bigger', width: 7, height: 7, winLength: 5 },
  { id: 'big', width: 15, height: 15, winLength: 5 },
]

/** The odd numbers from `from` to `to`, which is what a side or a row can be. */
export function oddNumbers(from: number, to: number): number[] {
  return Array.from({ length: Math.floor((to - from) / 2) + 1 }, (_, index) => from + index * 2)
}

/** Whether a field is one a room accepts: odd whole numbers within the limits, and a row that fits. */
export function isValidField({ width, height, winLength }: FieldSettings): boolean {
  const { minSide, maxSide, minWin, maxWin } = FIELD_LIMITS
  const within = (n: number, min: number, max: number) =>
    Number.isInteger(n) && n >= min && n <= max && n % 2 === 1
  return (
    within(width, minSide, maxSide) &&
    within(height, minSide, maxSide) &&
    within(winLength, minWin, maxWin) &&
    // A row longer than both sides could never be made: nobody could win.
    winLength <= Math.max(width, height)
  )
}

/**
 * The game of a round, played with the shapes the seats have chosen (`shapes`, in seat order) on
 * the field of the room. The player who starts alternates every round, so after a rematch the
 * other one starts.
 */
export function roomConfig(
  round: number,
  shapes: readonly PlayerId[],
  field: FieldSettings = CLASSIC_FIELD,
): GameConfig {
  const shift = round % Math.max(shapes.length, 1)
  return {
    width: field.width,
    height: field.height,
    winLength: field.winLength,
    players: [...shapes.slice(shift), ...shapes.slice(0, shift)],
  }
}

/** Room codes are four consonants: no vowels, so they never spell a word, and easy to read out. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'
export const ROOM_CODE_LENGTH = 4
