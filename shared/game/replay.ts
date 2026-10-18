import { applyMove, createGame } from './game.ts'
import type { GameConfig, GameState, Move, MoveError } from './game.ts'

export type ReplayResult =
  | { readonly ok: true; readonly state: GameState }
  /** `index` is the position in the list of the first move that broke a rule. */
  | { readonly ok: false; readonly index: number; readonly error: MoveError }

/**
 * Plays `moves` from an empty field and returns the state they lead to, or the first move that is
 * refused, with its position in the list. This is how a stored game (its config plus its moves) is
 * read back. Throws a `RangeError` when the config can't make a game, like `createGame`.
 */
export function replayGame(config: GameConfig, moves: readonly Move[]): ReplayResult {
  let state = createGame(config)
  for (const [index, move] of moves.entries()) {
    const result = applyMove(state, move)
    if (!result.ok) return { ok: false, index, error: result.error }
    state = result.state
  }
  return { ok: true, state }
}

/**
 * The state after the first `count` moves of a game, for stepping through it: 0 is the empty field
 * and `state.moves.length` is the game as it is. `state` itself is never changed. Throws a
 * `RangeError` when `count` isn't a whole number from 0 up to the number of moves played.
 */
export function stateAfter(state: GameState, count: number): GameState {
  if (!Number.isInteger(count) || count < 0 || count > state.moves.length) {
    throw new RangeError(`count must be a whole number from 0 to ${state.moves.length.toString()}`)
  }
  if (count === state.moves.length) return state

  const result = replayGame(state.config, state.moves.slice(0, count))
  if (!result.ok) throw new Error('unreachable: the moves of a game are all legal')
  return result.state
}
