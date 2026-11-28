/**
 * The computer player. `chooseMove` takes a position and answers with a cell, by the same rules as
 * everybody: it only returns a move the engine accepts, sees nothing a player can't see, and takes
 * its chance from the generator it is given, so that the same numbers give the same game. Pure,
 * like the rest of the engine. How strong each level is, and what the characters are, is written
 * down in docs/architecture/computer.md.
 */
import { EXACT_EMPTY_LIMIT, EXACT_FIELD_LIMIT, EXACT_NODE_LIMIT, Solver } from './analysis.ts'
import { boardOf, forcedWin, ranked, search } from './bot-search.ts'
import type { Board, Side } from './bot-search.ts'
import { cellValue, TASTES, windowsOf } from './bot-value.ts'
import type { BotCharacter, Taste } from './bot-value.ts'
import type { Cell, GameState, PlayerId } from './game.ts'
import { cellCount, hasCell } from './outline.ts'
import { cellAt, nearby, winningCells } from './tactics.ts'

/** How well the computer plays, from the weakest to the strongest. */
export const BOT_LEVELS = ['easy', 'medium', 'hard'] as const

export type BotLevel = (typeof BOT_LEVELS)[number]

/** A computer player: how well it plays and what it likes to do. */
export interface Bot {
  readonly level: BotLevel
  readonly character: BotCharacter
}

/** Gives numbers in [0, 1). */
export type Random = () => number

export interface BotOptions {
  /** A solver of the same field kept between moves, so that what it solved is not solved again. */
  readonly solver?: Solver
}

/** How often the easy level sees its own win, and a win of somebody else. */
const EASY_WINS = 0.8
const EASY_BLOCKS = 0.5
/** How often the easy level plays one of the cells it likes, instead of any cell near the marks. */
const EASY_LIKES = 0.5
/** The medium level plays its best, its second or its third choice. */
const MEDIUM_CHOICES = [0.6, 0.85] as const
/** How much two values may be apart and still count as the same, so that games differ. */
const JITTER = 0.05
/** What the hard level may spend on one move: moves tried for a forced win, positions searched. */
const FORCED_BUDGET = 3000
const SAFE_BUDGET = 800
const SEARCH_NODES = 1500

/**
 * The cell `player` should play, or null when it isn't their turn (or the game is over).
 */
export function chooseMove(
  state: GameState,
  player: PlayerId,
  bot: Bot,
  random: Random,
  options: BotOptions = {},
): Cell | null {
  if (state.status.kind !== 'playing' || state.status.next !== player) return null
  const { config } = state
  const { width, players } = config
  const board = boardOf(state, windowsOf(config))
  const taste = TASTES[bot.character]
  const moves = worthALook(state)

  /** The cells with what the character thinks of them, the best first, with a little chance. */
  const liked = (cells: readonly number[]): number[] =>
    cells
      .map((index) => ({
        index,
        value:
          (cellValue(state, board.windows, index, player, taste) + 0.001) * (1 + random() * JITTER),
      }))
      .sort((a, b) => b.value - a.value)
      .map(({ index }) => index)

  const answer = (index: number | undefined): Cell | null =>
    index === undefined ? null : cellAt(width, index)

  /** The cells where somebody would win at once, as indexes. */
  const threatsOf = (who: PlayerId): number[] =>
    winningCells(state, who).map(({ x, y }) => y * width + x)

  // The others in the order in which they move after this player.
  const at = players.indexOf(player)
  const others = [...players.slice(at + 1), ...players.slice(0, at)]

  const mine = threatsOf(player)
  if (mine.length > 0 && (bot.level !== 'easy' || random() < EASY_WINS)) return answer(mine[0])

  // The one who moves first and could win is the one to stop.
  let theirs: number[] = []
  for (const other of others) {
    theirs = threatsOf(other)
    if (theirs.length > 0) break
  }
  if (theirs.length > 0 && (bot.level !== 'easy' || random() < EASY_BLOCKS)) {
    return answer(liked(theirs)[0])
  }

  if (bot.level === 'easy') {
    const pool = random() < EASY_LIKES ? liked(moves).slice(0, 5) : moves
    return answer(pool[Math.floor(random() * pool.length)])
  }

  const choices = liked(moves)
  if (bot.level === 'medium') {
    const roll = random()
    const pick = roll < MEDIUM_CHOICES[0] ? 0 : roll < MEDIUM_CHOICES[1] ? 1 : 2
    return answer(choices[pick] ?? choices[0])
  }

  const [opponent] = others
  // With more players nobody can be counted on to answer a threat: no looking ahead.
  if (players.length !== 2 || opponent === undefined) return answer(choices[0])

  const solved = solve(state, options.solver)
  if (solved !== null) return answer(liked(solved)[0])

  const me: Side = { player, threats: mine }
  const them: Side = { player: opponent, threats: theirs }
  const win = forcedWin(board, me, them, 10, { left: FORCED_BUDGET })
  if (win !== null) return answer(win)

  const chosen = search(board, me, them, {
    moves,
    first: firstMoves(board, choices, player, taste),
    taste,
    nodes: SEARCH_NODES,
  })
  // Don't hand the opponent a forced win when another good move doesn't.
  const safe = (index: number): boolean => {
    board.cells[index] = player
    const lost = forcedWin(board, them, me, 8, { left: SAFE_BUDGET }) !== null
    board.cells[index] = null
    return !lost
  }
  if (theirs.length > 0 || safe(chosen)) return answer(chosen)
  return answer(choices.slice(0, 12).find((index) => safe(index)) ?? chosen)
}

/** The empty cells near the marks, as indexes; every empty cell when there are none near. */
function worthALook(state: GameState): number[] {
  const { width } = state.config
  const near = nearby(state).map(({ x, y }) => y * width + x)
  if (near.length > 0) return near
  return state.cells.flatMap((mark, index) => {
    const { x, y } = cellAt(width, index)
    return mark === null && hasCell(state.config, x, y) ? [index] : []
  })
}

/**
 * Where the search starts: the best cells for either side, and the ones the character likes. The
 * character's own come first, so that it decides between moves the search finds equally good.
 */
function firstMoves(
  board: Board,
  liked: readonly number[],
  player: PlayerId,
  taste: Taste,
): number[] {
  const own = liked.slice(0, 6)
  const sound = ranked(board, liked, player, TASTES.balanced)
    .slice(0, 8)
    .map(({ index }) => index)
  const likedBySound = ranked(board, sound, player, taste).map(({ index }) => index)
  return [...new Set([...own, ...likedBySound])]
}

/**
 * The best moves of a position that is small enough to solve completely, as indexes; null when it
 * isn't, or when the solver runs out of its budget.
 */
function solve(state: GameState, kept: Solver | undefined): number[] | null {
  const total = cellCount(state.config)
  if (total > EXACT_FIELD_LIMIT || total - state.moveCount > EXACT_EMPTY_LIMIT) return null
  const solver =
    kept?.fits(state.config) === true ? kept : new Solver(state.config, EXACT_NODE_LIMIT)
  solver.begin(EXACT_NODE_LIMIT)
  const scores = solver.scores(state)
  if (scores === null) return null
  const best = Math.max(...scores.values())
  return [...scores].filter(([, score]) => score === best).map(([index]) => index)
}
