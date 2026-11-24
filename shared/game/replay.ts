import { applyMove, applyMoveAfterDraw, createGame } from './game.ts'
import type { GameConfig, GameState, Move, MoveError } from './game.ts'

export type ReplayResult =
  | { readonly ok: true; readonly state: GameState }
  /** `index` is the position in the list of the first move that broke a rule. */
  | { readonly ok: false; readonly index: number; readonly error: MoveError }

/**
 * Plays `moves` from an empty field and returns the state they lead to, or the first move that is
 * refused, with its position in the list. This is how a stored game (its config plus its moves) is
 * read back, also one that was played on after the point where nobody could win any more. Throws a `RangeError` when the config can't make a game, like `createGame`.
 */
export function replayGame(config: GameConfig, moves: readonly Move[]): ReplayResult {
  const along = replayStates(config, moves)
  if (!along.ok) return along
  const state = along.states.at(-1)
  if (state === undefined) throw new Error('unreachable: a game has at least its empty field')
  return { ok: true, state }
}

export type StatesResult =
  | { readonly ok: true; readonly states: readonly GameState[] }
  | { readonly ok: false; readonly index: number; readonly error: MoveError }

/**
 * Every state along a game: `states[i]` is the game after the first `i` moves, so `states[0]` is the
 * empty field and the last one is the game as it is. The same as `stateAfter` for every `i`, in one
 * pass instead of one replay each, for what looks at every position of a game (the analysis).
 */
export function replayStates(config: GameConfig, moves: readonly Move[]): StatesResult {
  let state = createGame(config)
  const states = [state]
  for (const [index, move] of moves.entries()) {
    // A game stored before a dead position ended the game was played on to a full field: its moves
    // after the draw are read back as they were, and the game stays drawn.
    const result =
      state.status.kind === 'draw' ? applyMoveAfterDraw(state, move) : applyMove(state, move)
    if (!result.ok) return { ok: false, index, error: result.error }
    state = result.state
    states.push(state)
  }
  return { ok: true, states }
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
