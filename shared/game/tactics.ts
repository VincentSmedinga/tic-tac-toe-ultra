/**
 * Looking at a position for what one mark can do: the cells where somebody would win, the double
 * threats, and the cells near the marks. The analysis of a finished game and the computer player
 * share it. Every question of who wins goes to `completesLine`: nothing here decides a rule.
 */
import { completesLine } from './game.ts'
import type { Cell, GameState, Move, PlayerId } from './game.ts'
import { cellCount, hasCell } from './outline.ts'

/** Right, down, down-right and down-left: the four directions a line of marks can run in. */
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

/** How far from a mark a move on a big field can matter. */
const NEAR = 2
/** A field of at most this many cells is looked at everywhere. */
const SMALL_FIELD = 36

export function cellAt(width: number, index: number): Cell {
  return { x: index % width, y: Math.floor(index / width) }
}

/** The empty cells where `player` completes a line, whoever's turn it is. */
export function winningCells(state: GameState, player: PlayerId): Cell[] {
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
export function threatsAround(state: GameState, move: Move, player: PlayerId): Cell[] {
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
export function place(state: GameState, cell: Cell, player: PlayerId): GameState {
  const { width } = state.config
  return {
    ...state,
    cells: state.cells.with(cell.y * width + cell.x, player),
    moves: [...state.moves, { player, ...cell }],
    moveCount: state.moveCount + 1,
  }
}

/** The empty cells near a mark (or the middle of an empty field): where a move can matter. */
export function nearby(state: GameState): Cell[] {
  const { width, height } = state.config
  const middle = { x: Math.floor(width / 2), y: Math.floor(height / 2) }
  if (state.moveCount === 0 && hasCell(state.config, middle.x, middle.y)) return [middle]
  const small = cellCount(state.config) <= SMALL_FIELD
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
export function forksOf(state: GameState, player: PlayerId): Cell[] {
  return nearby(state).filter(
    (cell) => threatsAround(place(state, cell, player), { player, ...cell }, player).length >= 2,
  )
}
