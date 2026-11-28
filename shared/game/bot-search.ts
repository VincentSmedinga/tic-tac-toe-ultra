/**
 * Looking ahead for the strongest computer player, in a game of two: a forced win by threats, and
 * a search with pruning over the most promising moves. Both stop after a fixed number of moves
 * tried, never after a time: the same position and the same random numbers give the same move on
 * a slow phone and on a fast computer. Who wins is asked of the engine (`completesLine`, through
 * `threatsAround`).
 */
import { cellValue, ownerOf, TASTES, worth } from './bot-value.ts'
import type { Taste, Windows } from './bot-value.ts'
import type { GameState, PlayerId } from './game.ts'
import { cellAt, threatsAround } from './tactics.ts'

/** A position to try moves on: a copy of the cells, on which a mark is put and taken off again. */
export interface Board {
  /** For the engine to look at; its `cells` are the array below, which changes. */
  readonly state: GameState
  readonly cells: (PlayerId | null)[]
  readonly windows: Windows
}

export function boardOf(state: GameState, windows: Windows): Board {
  const cells = [...state.cells]
  return { state: { ...state, cells }, cells, windows }
}

/** A player in the search: who, and the empty cells where they would win at their next turn. */
export interface Side {
  readonly player: PlayerId
  readonly threats: readonly number[]
}

/** Puts a mark and returns where both would win after it. The caller takes the mark off again. */
function put(board: Board, index: number, mover: Side, other: Side): [Side, Side] {
  const { width } = board.state.config
  board.cells[index] = mover.player
  const made = threatsAround(
    board.state,
    { player: mover.player, ...cellAt(width, index) },
    mover.player,
  ).map(({ x, y }) => y * width + x)
  const mine = [...new Set([...mover.threats, ...made])].filter((cell) => cell !== index)
  return [
    { player: mover.player, threats: mine },
    { player: other.player, threats: other.threats.filter((cell) => cell !== index) },
  ]
}

/** The empty cells where a mark of `player` makes a new threat: in a window two marks short. */
function threatMoves(board: Board, player: PlayerId): number[] {
  const { winLength } = board.state.config
  const found = new Set<number>()
  for (const window of board.windows.all) {
    const line = ownerOf(board.cells, window)
    if (line?.owner !== player || line.marks !== winLength - 2) continue
    for (const index of window) if (board.cells[index] === null) found.add(index)
  }
  return [...found]
}

/**
 * The first move of a win by threats only: every move threatens to win at once, so the opponent
 * has to answer it, until there are two threats. Null when none is found within `budget` moves.
 */
export function forcedWin(
  board: Board,
  mover: Side,
  other: Side,
  depth: number,
  budget: { left: number },
): number | null {
  const [now] = mover.threats
  if (now !== undefined) return now
  if (depth === 0 || other.threats.length > 0) return null
  for (const index of threatMoves(board, mover.player)) {
    if (--budget.left < 0) return null
    const [me, them] = put(board, index, mover, other)
    let found = false
    const [block, second] = me.threats
    if (second !== undefined) found = true
    else if (block !== undefined) {
      const [theirs, mine] = put(board, block, them, me)
      // A block that threatens in turn has to be answered first, which this search leaves alone.
      found =
        theirs.threats.length === 0 && forcedWin(board, mine, theirs, depth - 1, budget) !== null
      board.cells[block] = null
    }
    board.cells[index] = null
    if (found) return index
  }
  return null
}

/** The values of the empty cells among `moves`, the best first. */
export function ranked(
  board: Board,
  moves: readonly number[],
  player: PlayerId,
  taste: Taste,
): { index: number; value: number }[] {
  return moves
    .filter((index) => board.cells[index] === null)
    .map((index) => ({
      index,
      value: cellValue(board.state, board.windows, index, player, taste),
    }))
    .sort((a, b) => b.value - a.value)
}

/** What the whole position is worth to `player`, with this taste for its own and the other lines. */
function evaluate(board: Board, player: PlayerId, taste: Taste): number {
  const { winLength } = board.state.config
  let value = 0
  for (const window of board.windows.all) {
    const line = ownerOf(board.cells, window)
    if (line === undefined || line.owner === null) continue
    value +=
      line.owner === player
        ? worth(line.marks, winLength) * taste.attack
        : -worth(line.marks, winLength) * taste.defend * 1.2
  }
  return value
}

const WIN = 1e12
/** How many moves of a position the search looks into. */
const WIDTH = 8
const DEPTH = 6

class OutOfNodes extends Error {}

export interface SearchOptions {
  /** The empty cells worth looking at. */
  readonly moves: readonly number[]
  /** The moves to try at the first step, in the order that decides between moves that are equal. */
  readonly first: readonly number[]
  readonly taste: Taste
  /** The most positions to look at. */
  readonly nodes: number
}

/**
 * The best of the `first` moves: alpha-beta, one step deeper each round, until the positions run
 * out; the answer is that of the last round that was finished.
 */
export function search(board: Board, mover: Side, other: Side, options: SearchOptions): number {
  const { moves, first, taste } = options
  const me = mover.player
  let left = options.nodes

  const near = (index: number): number[] => {
    // The cells next to a new mark are worth a look too, further down.
    const { width } = board.state.config
    return [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1]
      .map((step) => index + step)
      .filter((cell) => (board.windows.through[cell]?.length ?? 0) > 0)
  }

  const negamax = (
    side: Side,
    against: Side,
    cells: ReadonlySet<number>,
    depth: number,
    alpha: number,
    beta: number,
  ): number => {
    if (--left < 0) throw new OutOfNodes()
    if (side.threats.length > 0) return WIN + depth
    const [block] = against.threats
    if (depth <= 0) {
      const value = evaluate(board, me, taste)
      return side.player === me ? value : -value
    }
    const next =
      block !== undefined
        ? [block]
        : ranked(board, [...cells], side.player, TASTES.balanced)
            .slice(0, WIDTH)
            .map(({ index }) => index)
    if (next.length === 0) return 0
    let best = -Infinity
    for (const index of next) {
      const [mine, theirs] = put(board, index, side, against)
      let value: number
      try {
        const wider = new Set([...cells, ...near(index)])
        value = -negamax(theirs, mine, wider, depth - 1, -beta, -Math.max(alpha, best))
      } finally {
        board.cells[index] = null
      }
      if (value > best) best = value
      if (best >= beta) break
    }
    return best
  }

  let order = [...first]
  const [start] = order
  if (start === undefined) throw new RangeError('nothing to search')
  let choice: number = start
  const open = new Set(moves)
  try {
    for (let depth = 1; depth <= DEPTH; depth++) {
      let best = -Infinity
      let found: number = choice
      for (const index of order) {
        const [mine, theirs] = put(board, index, mover, other)
        let value: number
        try {
          const wider = new Set([...open, ...near(index)])
          value = -negamax(theirs, mine, wider, depth - 1, -Infinity, -best)
        } finally {
          board.cells[index] = null
        }
        if (value > best) {
          best = value
          found = index
        }
      }
      choice = found
      order = [found, ...order.filter((index) => index !== found)]
    }
  } catch (error) {
    if (!(error instanceof OutOfNodes)) throw error
  }
  return choice
}
