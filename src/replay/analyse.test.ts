import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameAnalysis, GameConfig, Move } from '../../shared/game/index.ts'
import type { AnalysisReply, AnalysisRequest } from './analysis.worker.ts'

const CLASSIC: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }
const MOVES: Move[] = [
  { player: 'X', x: 0, y: 0 },
  { player: 'O', x: 1, y: 0 },
]

/** A Web Worker that does nothing by itself: the test says what it answers, and when. */
class FakeWorker {
  static made: FakeWorker[] = []
  onmessage: ((event: MessageEvent<AnalysisReply>) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  readonly requests: AnalysisRequest[] = []
  readonly url: URL
  constructor(url: URL) {
    this.url = url
    FakeWorker.made.push(this)
  }
  postMessage(request: AnalysisRequest) {
    this.requests.push(request)
  }
  terminate() {
    this.terminated = true
  }
  reply(id: number, analysis: GameAnalysis | null) {
    this.onmessage?.({ data: { id, analysis } } as MessageEvent<AnalysisReply>)
  }
}

const analysis: GameAnalysis = { moves: [], certainty: 'exact' }

describe('analyseOffThread', () => {
  beforeEach(() => {
    vi.resetModules()
    FakeWorker.made = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('hands the game to a worker, so that the page is not held up, and gives back its answer', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { analyseOffThread } = await import('./analyse.ts')

    const answer = analyseOffThread(CLASSIC, MOVES)
    const [worker] = FakeWorker.made
    expect(worker?.requests).toHaveLength(1)
    expect(worker?.requests[0]?.config).toEqual(CLASSIC)
    expect(worker?.requests[0]?.moves).toEqual(MOVES)
    // Nothing has been worked out on the page: only the worker has the answer.
    worker?.reply(worker.requests[0]?.id ?? -1, analysis)
    await expect(answer).resolves.toBe(analysis)
  })

  it('uses one worker for every game, and keeps the answers apart', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { analyseOffThread } = await import('./analyse.ts')
    const first = analyseOffThread(CLASSIC, MOVES)
    const second = analyseOffThread(CLASSIC, MOVES.slice(0, 1))
    expect(FakeWorker.made).toHaveLength(1)
    const [worker] = FakeWorker.made
    const [one, two] = worker?.requests ?? []
    const other: GameAnalysis = { moves: [], certainty: 'tactical' }
    worker?.reply(two?.id ?? -1, other)
    worker?.reply(one?.id ?? -1, analysis)
    await expect(first).resolves.toBe(analysis)
    await expect(second).resolves.toBe(other)
  })

  it('analyses on the page when the worker fails, and starts a new worker for the next game', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.useFakeTimers()
    const { analyseOffThread } = await import('./analyse.ts')
    const answer = analyseOffThread(CLASSIC, MOVES)
    FakeWorker.made[0]?.onerror?.()
    await vi.runAllTimersAsync()
    const result = await answer
    expect(result?.moves).toHaveLength(2)
    expect(FakeWorker.made[0]?.terminated).toBe(true)

    void analyseOffThread(CLASSIC, MOVES)
    expect(FakeWorker.made).toHaveLength(2)
  })

  it('analyses on the page when there is no worker', async () => {
    vi.stubGlobal('Worker', undefined)
    vi.useFakeTimers()
    const { analyseOffThread } = await import('./analyse.ts')
    const answer = analyseOffThread(CLASSIC, MOVES)
    await vi.runAllTimersAsync()
    expect((await answer)?.moves).toHaveLength(2)
  })

  it('answers null for a game that can not be read', async () => {
    vi.stubGlobal('Worker', undefined)
    vi.useFakeTimers()
    const { analyseOffThread } = await import('./analyse.ts')
    const answer = analyseOffThread(CLASSIC, [{ player: 'O', x: 0, y: 0 }])
    await vi.runAllTimersAsync()
    expect(await answer).toBeNull()
  })
})
