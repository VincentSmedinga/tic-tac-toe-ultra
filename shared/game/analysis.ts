/**
 * The analysis of a finished game: a rank for every move, the way chess marks them (`!!`, `!`, `?!`,
 * `?`, `??`), worked out from the stored `config` and `moves` and never stored itself, so a better
 * analysis later improves the games that are already played. Pure and immutable, like the rest of
 * the engine: it plays through `applyMove` and looks through `completesLine`, and never decides
 * a rule of its own. The decisions are in docs/plan.md, Ranking the moves of a game.
 *
 * Two kinds of answer, and every move says which one it has:
 *
 * - **exact**: two players and a position with few enough empty cells (`EXACT_EMPTY_LIMIT`) to be
 *   solved completely, within a budget of positions. A move is judged by what the position was
 *   worth before and after it (win, draw or loss for whoever moved), like a chess engine does.
 * - **tactical**: whatever can be shown from the position without solving it: a win in one move
 *   that was missed, a win of the next player that was not blocked, a double threat that was made,
 *   and (two players only) a double threat that was handed to the opponent. A move whose rank can't
 *   be told gets none. This is all there is for several players and for fields that are too big.
 */
import { applyMove, completesLine } from './game.ts'
import type { Cell, GameConfig, GameState, Move, PlayerId } from './game.ts'
import { cellCount, hasCell } from './outline.ts'
import { replayStates } from './replay.ts'

export type Rank = 'brilliant' | 'good' | 'dubious' | 'mistake' | 'blunder'

/** The ranks from the best to the worst. */
export const RANKS: readonly Rank[] = ['brilliant', 'good', 'dubious', 'mistake', 'blunder']

/** The symbols of the ranks, as in chess. They are never the only way to tell a rank. */
export const RANK_SYMBOLS: Readonly<Record<Rank, string>> = {
  brilliant: '!!',
  good: '!',
  dubious: '?!',
  mistake: '?',
  blunder: '??',
}

/** How sure a rank is: `exact` comes from solving the position, `tactical` from what can be shown. */
export type Certainty = 'exact' | 'tactical'

/** What a position is worth to the player to move, with best play from both. */
export type PositionValue = 'win' | 'draw' | 'loss'

export interface MoveAnalysis {
  /** The rank of the move; null for an ordinary move, and for one that can't be judged. */
  readonly rank: Rank | null
  /** How the answer was found. Without a rank it says how far the move was checked. */
  readonly certainty: Certainty
  /** What the position was worth to the player who moved, before the move: known when exact. */
  readonly value: PositionValue | null
  /** The cells that were better, for a mistake or a blunder when it is known which. */
  readonly better: readonly Cell[]
}

export interface GameAnalysis {
  /** One entry per move of the game, in order. */
  readonly moves: readonly MoveAnalysis[]
  /** `exact` when every move that could be judged was solved, `tactical` when some was not. */
  readonly certainty: Certainty
}

export interface AnalysisLimits {
  /** How many moves the solver may try in all, for a whole game. */
  readonly nodes?: number
  /**
   * A solver of the same field kept from an earlier game: what it solved is not solved again, so
   * after the first game on a field every other one is instant. Without it each game has its own.
   */
  readonly solver?: Solver
}

/** A position with more empty cells than this is not solved, whatever the field. */
export const EXACT_EMPTY_LIMIT = 12
/** A field with more cells than this is not solved, since a move costs too much there. */
export const EXACT_FIELD_LIMIT = 36
/** The most positions the solver may try for one game before it gives up and leaves it to the tactics. */
export const EXACT_NODE_LIMIT = 250_000
/** How many solved positions a kept solver holds on to between games. */
const MEMO_LIMIT = 300_000
/** How far from a mark the tactical search looks for a move on a big field. */
const NEAR = 2
/** Alternatives looked at when checking that a move could have been better. */
const ALTERNATIVES = 40

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

/**
 * Ranks every move of a game. Null when the game can't be read (a move breaks a rule): the same
 * games `replayGame` refuses. A move played after the game was already a draw (a game stored
 * before dead positions ended it) is not judged.
 */
export function analyseGame(
  config: GameConfig,
  moves: readonly Move[],
  limits: AnalysisLimits = {},
): GameAnalysis | null {
  const along = replayStates(config, moves)
  if (!along.ok) return null
  const { states } = along

  const results: MoveAnalysis[] = []
  const solver =
    config.players.length === 2 && cellCount(config) <= EXACT_FIELD_LIMIT
      ? solverFor(config, limits)
      : null
  // From the last move to the first, so that the positions solved late in the game are there, in
  // the table, for the earlier positions that lead to them.
  let exactPossible = solver !== null
  let tactical = false
  for (let index = moves.length - 1; index >= 0; index--) {
    const before = states[index]
    const after = states[index + 1]
    const move = moves[index]
    if (before === undefined || after === undefined || move === undefined) continue
    if (before.status.kind !== 'playing') {
      results[index] = { rank: null, certainty: 'tactical', value: null, better: [] }
      continue
    }
    if (exactPossible && solver !== null) {
      if (cellCount(before.config) - before.moveCount > EXACT_EMPTY_LIMIT) exactPossible = false
      else {
        const judged = judgeExactly(solver, before, after, move)
        if (judged) {
          results[index] = judged
          continue
        }
        exactPossible = false
      }
    }
    tactical = true
    results[index] = judgeTactically(before, after, move)
  }
  return { moves: results, certainty: tactical ? 'tactical' : 'exact' }
}

/* ----------------------------------------------------------------------------------------------
 * Exact: two players, solved completely.
 * -------------------------------------------------------------------------------------------- */

class OutOfNodes extends Error {}

function solverFor(config: GameConfig, limits: AnalysisLimits): Solver {
  const budget = limits.nodes ?? EXACT_NODE_LIMIT
  const { solver } = limits
  // A kept solver is for the same field: a position is read with the first player of its own game
  // as `a`, so the players may be other shapes.
  if (solver?.fits(config) === true) {
    solver.begin(budget)
    return solver
  }
  return new Solver(config, budget)
}

/**
 * Solves positions of a two-player game by looking at every move, once per position, however a
 * position was reached and also when it is turned or mirrored. A score is for the player to move:
 * above 0 is a win and is higher the sooner it comes, 0 is a draw, below 0 is a loss and is lower
 * the sooner it comes.
 */
export class Solver {
  private readonly memo = new Map<string, number>()
  private readonly symmetries: readonly (readonly number[])[]
  private readonly config: GameConfig
  private limit: number
  private nodes = 0

  constructor(config: GameConfig, limit: number) {
    this.config = config
    this.limit = limit
    this.symmetries = symmetriesOf(config)
  }

  /** Whether this solver was made for a field like this one: the same cells and the same line. */
  fits({ width, height, winLength, outline }: GameConfig): boolean {
    const own = this.config
    return (
      own.width === width &&
      own.height === height &&
      own.winLength === winLength &&
      own.outline === outline
    )
  }

  /** Starts a new game: the budget is for that game, what is solved stays. */
  begin(limit: number): void {
    this.limit = limit
    this.nodes = 0
    // A kept solver may not grow without end: a field that is almost too big to solve fills it.
    if (this.memo.size > MEMO_LIMIT) this.memo.clear()
  }

  /** The score of each empty cell, for the player to move; null when the budget ran out. */
  scores(state: GameState): Map<number, number> | null {
    try {
      return this.scoresOf(state)
    } catch (error) {
      if (error instanceof OutOfNodes) return null
      throw error
    }
  }

  private scoresOf(state: GameState): Map<number, number> {
    const { width } = this.config
    const player = this.toMove(state)
    const empty = cellCount(this.config) - state.moveCount
    const scores = new Map<number, number>()
    for (const [index, mark] of state.cells.entries()) {
      const { x, y } = cellAt(width, index)
      if (mark !== null || !hasCell(this.config, x, y)) continue
      if (++this.nodes > this.limit) throw new OutOfNodes()
      const result = applyMove(state, { player, x, y })
      if (!result.ok) throw new Error('unreachable: an empty cell is a legal move')
      const { status } = result.state
      scores.set(
        index,
        status.kind === 'won' ? empty : status.kind === 'draw' ? 0 : -this.solve(result.state),
      )
    }
    return scores
  }

  private solve(state: GameState): number {
    const key = this.keyOf(state)
    const known = this.memo.get(key)
    if (known !== undefined) return known
    let best = -Infinity
    for (const score of this.scoresOf(state).values()) best = Math.max(best, score)
    this.memo.set(key, best)
    return best
  }

  private toMove(state: GameState): PlayerId {
    if (state.status.kind !== 'playing')
      throw new Error('unreachable: only a game in play is solved')
    return state.status.next
  }

  /** The same string for a position and for each way of turning or mirroring it. */
  private keyOf(state: GameState): string {
    // The first player of the game being read, not of the game the solver was made for.
    const [first] = state.config.players
    const marks = state.cells.map((mark) => (mark === null ? '.' : mark === first ? 'a' : 'b'))
    let key: string | undefined
    for (const order of this.symmetries) {
      const turned = order.map((from) => marks[from]).join('')
      if (key === undefined || turned < key) key = turned
    }
    return key ?? ''
  }
}

/**
 * Where each cell comes from under the turns and mirrors that keep the field itself: four for a
 * rectangle that is wider than it is high (or the other way round), eight for a square one. Of
 * those, an outline keeps the ones that put every cell of the field on a cell of the field: two for
 * the pyramid, all eight for the plus.
 */
export function symmetriesOf(config: GameConfig): number[][] {
  const { width, height } = config
  const orders: number[][] = []
  const maps: ((x: number, y: number) => [number, number])[] = [
    (x, y) => [x, y],
    (x, y) => [width - 1 - x, y],
    (x, y) => [x, height - 1 - y],
    (x, y) => [width - 1 - x, height - 1 - y],
  ]
  if (width === height) {
    maps.push(
      (x, y) => [y, x],
      (x, y) => [height - 1 - y, x],
      (x, y) => [y, width - 1 - x],
      (x, y) => [height - 1 - y, width - 1 - x],
    )
  }
  for (const map of maps) {
    const order: number[] = []
    let keeps = true
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [fromX, fromY] = map(x, y)
        keeps &&= hasCell(config, x, y) === hasCell(config, fromX, fromY)
        order.push(fromY * width + fromX)
      }
    }
    if (keeps) orders.push(order)
  }
  return orders
}

const sign = (score: number): number => Math.sign(score)
const valueOf = (score: number): PositionValue => (score > 0 ? 'win' : score < 0 ? 'loss' : 'draw')

function judgeExactly(
  solver: Solver,
  before: GameState,
  after: GameState,
  move: Move,
): MoveAnalysis | null {
  const scores = solver.scores(before)
  if (scores === null) return null
  const { width } = before.config
  const played = scores.get(move.y * width + move.x)
  if (played === undefined) return null

  const best = Math.max(...scores.values())
  const value = valueOf(best)
  const keepers = [...scores.values()].filter((score) => sign(score) === sign(best)).length

  let rank: Rank | null = null
  let better: Cell[] = []
  if (sign(played) < sign(best)) {
    rank = best > 0 && played === 0 ? 'mistake' : 'blunder'
    better = [...scores]
      .filter(([, score]) => score === best)
      .map(([index]) => cellAt(width, index))
  } else if (after.status.kind === 'won') {
    rank = null
  } else if (keepers === 1 && scores.size >= 2) {
    rank = value === 'win' && makesFork(after, move) ? 'brilliant' : 'good'
  } else if (value === 'win' && played < best) {
    rank = 'dubious'
  }
  return { rank, certainty: 'exact', value, better }
}

function cellAt(width: number, index: number): Cell {
  return { x: index % width, y: Math.floor(index / width) }
}

/* ----------------------------------------------------------------------------------------------
 * Tactical: what can be shown from the position, for any number of players and any field.
 * -------------------------------------------------------------------------------------------- */

function judgeTactically(before: GameState, after: GameState, move: Move): MoveAnalysis {
  const { players } = before.config
  const none: MoveAnalysis = { rank: null, certainty: 'tactical', value: null, better: [] }
  if (after.status.kind === 'won') return none

  const mover = move.player
  const next = players[(players.indexOf(mover) + 1) % players.length]
  if (next === undefined) return none
  const result = (rank: Rank | null, better: readonly Cell[] = []): MoveAnalysis => ({
    rank,
    certainty: 'tactical',
    value: null,
    better,
  })

  // A win in one move that was not taken. It is a blunder when the next player wins at once.
  const mine = winningCells(before, mover)
  if (mine.length > 0) {
    return result(winningCells(after, next).length > 0 ? 'blunder' : 'mistake', mine)
  }

  // A win of the next player in one move: with one cell there is a block, and with more there is none.
  const theirs = winningCells(before, next)
  if (theirs.length === 1) {
    const [block] = theirs
    return block?.x === move.x && block.y === move.y ? result('good') : result('blunder', theirs)
  }
  if (theirs.length > 1) return none

  if (threatsAround(after, move, mover).length >= 2) {
    // With two players a double threat can't be stopped: it wins. It is brilliant when it was the
    // only way to make one. With more players the others may stop it between two turns of the mover.
    if (players.length === 2)
      return result(forksOf(before, mover).length === 1 ? 'brilliant' : 'good')
    return result('good')
  }

  if (players.length === 2 && allowsFork(after, next, mover) && hasSafeAlternative(before, move)) {
    return result('blunder')
  }
  return none
}

/** The empty cells where `player` completes a line, whoever's turn it is. */
function winningCells(state: GameState, player: PlayerId): Cell[] {
  const { width } = state.config
  const cells: Cell[] = []
  for (const [index, mark] of state.cells.entries()) {
    if (mark !== null) continue
    const cell = cellAt(width, index)
    if (completesLine(state, cell, player)) cells.push(cell)
  }
  return cells
}

/**
 * The cells where `move.player` wins next, that the mark of `move` made possible: only on the four
 * lines through the move can a new win have appeared, so this is cheap on a big field.
 */
function threatsAround(state: GameState, move: Move, player: PlayerId): Cell[] {
  const reach = state.config.winLength - 1
  const found: Cell[] = []
  for (const [dx, dy] of DIRECTIONS) {
    for (let step = -reach; step <= reach; step++) {
      if (step === 0) continue
      const cell = { x: move.x + dx * step, y: move.y + dy * step }
      if (completesLine(state, cell, player)) found.push(cell)
    }
  }
  return found.filter(
    (cell, index) => found.findIndex(({ x, y }) => x === cell.x && y === cell.y) === index,
  )
}

/** Puts a mark on a copy of the position, for looking ahead: nothing but the cells is checked. */
function place(state: GameState, cell: Cell, player: PlayerId): GameState {
  const { width } = state.config
  return {
    ...state,
    cells: state.cells.with(cell.y * width + cell.x, player),
    moves: [...state.moves, { player, ...cell }],
    moveCount: state.moveCount + 1,
  }
}

/** The empty cells near a mark (or the middle of an empty field): where a move can matter. */
function nearby(state: GameState): Cell[] {
  const { width, height } = state.config
  const middle = { x: Math.floor(width / 2), y: Math.floor(height / 2) }
  if (state.moveCount === 0 && hasCell(state.config, middle.x, middle.y)) return [middle]
  const small = cellCount(state.config) <= 36
  const found: Cell[] = []
  for (const [index, mark] of state.cells.entries()) {
    if (mark !== null) continue
    const cell = cellAt(width, index)
    if (!hasCell(state.config, cell.x, cell.y)) continue
    if (small || isNearMark(state, cell)) found.push(cell)
  }
  return found
}

function isNearMark(state: GameState, { x, y }: Cell): boolean {
  const { width, height } = state.config
  for (let dy = -NEAR; dy <= NEAR; dy++) {
    for (let dx = -NEAR; dx <= NEAR; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      if (state.cells[ny * width + nx] !== null) return true
    }
  }
  return false
}

/** The moves of `player` that make a double threat. */
function forksOf(state: GameState, player: PlayerId): Cell[] {
  return nearby(state).filter(
    (cell) => threatsAround(place(state, cell, player), { player, ...cell }, player).length >= 2,
  )
}

/** Whether makes a double threat in a position that is already won, for a mover who has no win yet. */
function makesFork(after: GameState, move: Move): boolean {
  return threatsAround(after, move, move.player).length >= 2
}

/**
 * Whether the opponent can make a double threat that the mover can't answer: then the opponent wins
 * two moves later, since the mover can't win at once (checked) and stops only one of the two.
 */
function allowsFork(state: GameState, opponent: PlayerId, mover: PlayerId): boolean {
  if (winningCells(state, mover).length > 0) return false
  return forksOf(state, opponent).some(
    (cell) => winningCells(place(state, cell, opponent), mover).length === 0,
  )
}

/** Whether some other move would not have handed the opponent a double threat. */
function hasSafeAlternative(before: GameState, move: Move): boolean {
  const { players } = before.config
  const opponent = players.find((player) => player !== move.player)
  if (opponent === undefined) return false
  const alternatives = nearby(before)
    .filter(({ x, y }) => x !== move.x || y !== move.y)
    .slice(0, ALTERNATIVES)
  return alternatives.some(
    (cell) => !allowsFork(place(before, cell, move.player), opponent, move.player),
  )
}
