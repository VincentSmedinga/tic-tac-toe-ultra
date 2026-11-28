import { analyseGame, Solver } from '../../shared/game/index.ts'
import type { GameAnalysis, GameConfig, Move } from '../../shared/game/index.ts'

/**
 * The solvers kept for the fields that were analysed, one per field and winning length. Solving a
 * 3 × 3 once is enough: the next game on it, and every game after, finds its positions in the table.
 * It lives where the analysis runs (the worker, or the page when there is no worker).
 */
const kept = new Map<string, Solver>()

/** Analyses a game with the solver kept for its field. Null when the game can't be read. */
export function analyseKept(config: GameConfig, moves: readonly Move[]): GameAnalysis | null {
  const { width, height, winLength, outline } = config
  const key = `${width.toString()}x${height.toString()}k${winLength.toString()}${outline ?? ''}`
  let solver = kept.get(key)
  if (solver === undefined && config.players.length === 2) {
    solver = new Solver(config, 0)
    kept.set(key, solver)
  }
  return analyseGame(config, moves, solver === undefined ? {} : { solver })
}
