import { chooseMove, Solver } from '../../shared/game/index.ts'
import type { Bot, Cell, GameState, PlayerId } from '../../shared/game/index.ts'
import { createRandom } from '../motion/random.ts'
import type { BotReply, BotRequest } from './bot.worker.ts'

/**
 * Asks the computer for its move: null when it isn't its turn. A promise because the real one works
 * in a Web Worker, so that thinking about a big field never holds the page up.
 */
export type Thinker = (
  state: GameState,
  player: PlayerId,
  bot: Bot,
  seed: number,
) => Promise<Cell | null>

/** The solver of the field that was played last, so that a position is solved once. */
let kept: Solver | undefined

/** The move itself, wherever it is worked out: here for a test or without a worker. */
export function thinkHere(state: GameState, player: PlayerId, bot: Bot, seed: number): Cell | null {
  if (kept?.fits(state.config) !== true) kept = new Solver(state.config, 0)
  return chooseMove(state, player, bot, createRandom(seed), { solver: kept })
}

interface Pending {
  resolve: (cell: Cell | null) => void
  reject: (error: unknown) => void
}

let worker: Worker | undefined
let counter = 0
const pending = new Map<number, Pending>()

function startWorker(): Worker {
  const made = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' })
  made.onmessage = ({ data }: MessageEvent<BotReply>) => {
    pending.get(data.id)?.resolve(data.cell)
    pending.delete(data.id)
  }
  // A worker that fails (or can't start) answers nothing more: the moves waiting for it are
  // worked out on the page instead, and the next one starts a new worker.
  made.onerror = () => {
    worker = undefined
    made.terminate()
    for (const waiting of pending.values())
      waiting.reject(new Error('the computer’s worker failed'))
    pending.clear()
  }
  return made
}

/** After the page has painted what it has, so that "Computer denkt na…" shows first. */
const inline: Thinker = (state, player, bot, seed) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(thinkHere(state, player, bot, seed))
    }, 0)
  })

export const thinkOffThread: Thinker = (state, player, bot, seed) => {
  if (typeof Worker === 'undefined') return inline(state, player, bot, seed)
  let started: Worker
  try {
    worker ??= startWorker()
    started = worker
  } catch {
    return inline(state, player, bot, seed)
  }
  const id = ++counter
  return new Promise<Cell | null>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    started.postMessage({ id, state, player, bot, seed } satisfies BotRequest)
  }).catch(() => inline(state, player, bot, seed))
}
