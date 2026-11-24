export { applyMove, createGame, getCell } from './game.ts'
export type {
  Cell,
  GameConfig,
  GameState,
  GameStatus,
  Move,
  MoveError,
  MoveResult,
  PlayerId,
} from './game.ts'
export { canStillWin } from './dead.ts'
export { replayGame, stateAfter } from './replay.ts'
export type { ReplayResult } from './replay.ts'
