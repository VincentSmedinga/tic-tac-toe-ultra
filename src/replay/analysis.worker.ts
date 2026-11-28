/// <reference lib="webworker" />
import type { GameAnalysis, GameConfig, Move } from '../../shared/game/index.ts'
import { analyseKept } from './keptSolver.ts'

/** What the page asks of the worker, and what the worker answers: the analysis of one game. */
export interface AnalysisRequest {
  id: number
  config: GameConfig
  moves: readonly Move[]
}

export interface AnalysisReply {
  id: number
  analysis: GameAnalysis | null
}

// The analysis of a long game on a big field takes a while: here it holds nothing else up.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null
  postMessage: (reply: AnalysisReply) => void
}

scope.onmessage = ({ data }) => {
  scope.postMessage({ id: data.id, analysis: analyseKept(data.config, data.moves) })
}
