import { useEffect, useState } from 'react'
import type { GameAnalysis, GameConfig, Move } from '../../shared/game/index.ts'
import type { Analyser } from './analyse.ts'

export type AnalysisState =
  | { readonly status: 'working' }
  | { readonly status: 'ready'; readonly analysis: GameAnalysis }
  /** The analysis could not be made: the game can't be read, or the analyser failed. */
  | { readonly status: 'failed' }

interface Done {
  config: GameConfig
  moves: readonly Move[]
  analyser: Analyser
  analysis: GameAnalysis | null | 'failed'
}

/**
 * The analysis of a finished game, worked out away from the page: `working` until it is there, and
 * again when another game is passed in. Nothing is kept anywhere, so the ranks are always those
 * of the analysis as it is now.
 */
export function useAnalysis(
  config: GameConfig,
  moves: readonly Move[],
  analyse: Analyser,
): AnalysisState {
  const [done, setDone] = useState<Done | null>(null)

  useEffect(() => {
    let current = true
    analyse(config, moves).then(
      (analysis) => {
        if (current) setDone({ config, moves, analyser: analyse, analysis })
      },
      () => {
        if (current) setDone({ config, moves, analyser: analyse, analysis: 'failed' })
      },
    )
    return () => {
      current = false
    }
  }, [config, moves, analyse])

  if (done?.config !== config || done.moves !== moves || done.analyser !== analyse) {
    return { status: 'working' }
  }
  return done.analysis === null || done.analysis === 'failed'
    ? { status: 'failed' }
    : { status: 'ready', analysis: done.analysis }
}
