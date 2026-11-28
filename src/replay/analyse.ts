import type { GameAnalysis, GameConfig, Move } from '../../shared/game/index.ts'
import type { AnalysisReply, AnalysisRequest } from './analysis.worker.ts'
import { analyseKept } from './keptSolver.ts'

/**
 * Ranks the moves of a game: null when the game can't be read. It is a promise because the real
 * one works in a Web Worker, so that a long game on a big field never holds the replay up.
 */
export type Analyser = (config: GameConfig, moves: readonly Move[]) => Promise<GameAnalysis | null>

interface Pending {
  resolve: (analysis: GameAnalysis | null) => void
  reject: (error: unknown) => void
}

let worker: Worker | undefined
let counter = 0
const pending = new Map<number, Pending>()

function startWorker(): Worker {
  const made = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
  made.onmessage = ({ data }: MessageEvent<AnalysisReply>) => {
    pending.get(data.id)?.resolve(data.analysis)
    pending.delete(data.id)
  }
  // A worker that fails (or can't start) answers nothing more: the games waiting for it are
  // analysed on the page instead, and the next one starts a new worker.
  made.onerror = () => {
    worker = undefined
    made.terminate()
    for (const waiting of pending.values()) waiting.reject(new Error('the analysis worker failed'))
    pending.clear()
  }
  return made
}

/** Here when there is no worker (a test, an old browser); in the worker otherwise. */
const inline: Analyser = (config, moves) =>
  new Promise((resolve) => {
    // After the page has painted what it has, so that "Zetten beoordelen…" shows first.
    setTimeout(() => {
      resolve(analyseKept(config, moves))
    }, 0)
  })

export const analyseOffThread: Analyser = (config, moves) => {
  if (typeof Worker === 'undefined') return inline(config, moves)
  let started: Worker
  try {
    worker ??= startWorker()
    started = worker
  } catch {
    return inline(config, moves)
  }
  const id = ++counter
  return new Promise<GameAnalysis | null>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    started.postMessage({ id, config, moves } satisfies AnalysisRequest)
  }).catch(() => inline(config, moves))
}
