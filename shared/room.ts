import type { GameConfig, PlayerId } from './game/index.ts'

/**
 * The seats of a room, in the order people join: the first to join has the first seat. A seat is
 * not a player of the game: the player is the shape that whoever sits there has chosen.
 */
export const ROOM_SEATS: readonly string[] = ['X', 'O']

/**
 * The game of a round: classic tic-tac-toe, played with the shapes the seats have chosen (`shapes`,
 * in seat order). The player who starts alternates every round, so after a rematch the other one
 * starts.
 */
export function roomConfig(round: number, shapes: readonly PlayerId[]): GameConfig {
  const shift = round % Math.max(shapes.length, 1)
  return {
    width: 3,
    height: 3,
    winLength: 3,
    players: [...shapes.slice(shift), ...shapes.slice(0, shift)],
  }
}

/** Room codes are four consonants: no vowels, so they never spell a word, and easy to read out. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'
export const ROOM_CODE_LENGTH = 4
