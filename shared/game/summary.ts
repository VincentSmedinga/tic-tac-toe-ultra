/**
 * The summary of an analysed game: per player how many moves of each rank, how many of the moves
 * kept what the position was worth, the best move and the biggest mistake. Pure, and derived like
 * the analysis it comes from: nothing of it is stored.
 */
import type { GameAnalysis, Rank } from './analysis.ts'
import type { GameConfig, Move, PlayerId } from './game.ts'

export interface PlayerSummary {
  readonly player: PlayerId
  /** The moves this player made. */
  readonly moves: number
  /** How many of those moves have each rank. */
  readonly counts: Readonly<Record<Rank, number>>
  /**
   * The share of the moves that kept the value of the position (all but the mistakes and blunders),
   * from 0 to 1, of the moves that were solved exactly; null when none were.
   */
  readonly accuracy: number | null
  /** How many moves the accuracy is based on. */
  readonly judged: number
  /** The position in the game (from 0) of the best move: the first brilliant one, else the first good one. */
  readonly best: number | null
  /** The position of the biggest mistake: the first blunder, else the first mistake. */
  readonly worst: number | null
}

export interface GameSummary {
  /** The players that moved, in turn order. */
  readonly players: readonly PlayerSummary[]
  /** `tactical` when the ranks rest on what can be shown, not on a complete solution. */
  readonly certainty: GameAnalysis['certainty']
}

const empty = (): Record<Rank, number> => ({
  brilliant: 0,
  good: 0,
  dubious: 0,
  mistake: 0,
  blunder: 0,
})

/** Sums up a game; `moves` and `analysis` are those of the same game. */
export function summariseGame(
  config: GameConfig,
  moves: readonly Move[],
  analysis: GameAnalysis,
): GameSummary {
  const players: PlayerSummary[] = []
  for (const player of config.players) {
    const counts = empty()
    let made = 0
    let judged = 0
    let kept = 0
    const first: Partial<Record<Rank, number>> = {}
    for (const [index, move] of moves.entries()) {
      const judgement = analysis.moves[index]
      if (move.player !== player || judgement === undefined) continue
      made++
      const { rank } = judgement
      if (rank !== null) {
        counts[rank]++
        first[rank] ??= index
      }
      if (judgement.certainty === 'exact') {
        judged++
        if (rank !== 'mistake' && rank !== 'blunder') kept++
      }
    }
    if (made === 0) continue
    players.push({
      player,
      moves: made,
      counts,
      accuracy: judged === 0 ? null : kept / judged,
      judged,
      best: first.brilliant ?? first.good ?? null,
      worst: first.blunder ?? first.mistake ?? null,
    })
  }
  return { players, certainty: analysis.certainty }
}

/** How many of a player's moves were a mistake or a blunder. */
export function slips({ counts }: PlayerSummary): number {
  return counts.mistake + counts.blunder
}
