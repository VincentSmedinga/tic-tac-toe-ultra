import type { GameConfig, PlayerId } from './game/index.ts'

/** The players of a room, in seat order: whoever joins first is the first one. */
export const ROOM_PLAYERS: readonly PlayerId[] = ['X', 'O']

/**
 * The game of a round: classic tic-tac-toe, where the player who starts alternates every round,
 * so after a rematch the other one starts.
 */
export function roomConfig(round: number): GameConfig {
  const shift = round % ROOM_PLAYERS.length
  return {
    width: 3,
    height: 3,
    winLength: 3,
    players: [...ROOM_PLAYERS.slice(shift), ...ROOM_PLAYERS.slice(0, shift)],
  }
}

/** Room codes are four consonants: no vowels, so they never spell a word, and easy to read out. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'
export const ROOM_CODE_LENGTH = 4
