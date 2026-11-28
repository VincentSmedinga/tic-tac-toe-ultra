/**
 * Whether anybody can still win. Pure and immutable like the rest of the engine, and optimistic on
 * purpose: it ignores that the other players *must* put their marks somewhere, so it can be late
 * (somebody "can" win when only a forced fill would stop it) but is never early. A game is a draw
 * when it says no: the position is dead, whatever anyone plays.
 */
import type { GameConfig, PlayerId } from './game.ts'
import { cellCount, hasCell } from './outline.ts'

/** Right, down, down-right and down-left: the four directions a line of marks can run in. */
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

/**
 * Whether some player can still complete a line of `config.winLength`, given the marks in `cells`
 * and who is to move. A *window* is `winLength` cells in a row, all of them on the field; a player
 * can still win through it when no other player's mark is in it and the number of empty cells in it
 * is no more than the turns that player still gets (the order is fixed and nobody can pass, so the
 * turns left come from the number of empty cells in the whole field and who is to move).
 */
export function canStillWin(
  config: GameConfig,
  cells: readonly (PlayerId | null)[],
  toMove: PlayerId,
): boolean {
  const { width, height, winLength, players, outline } = config
  const start = players.indexOf(toMove)
  if (start < 0) return false

  // The cells an outline leaves out are null too, so the marks are counted, not the nulls.
  const marks = cells.reduce((count, cell) => (cell === null ? count : count + 1), 0)
  const empty = cellCount(config) - marks
  const turns = new Map<PlayerId, number>()
  for (const [index, player] of players.entries()) {
    const behind = (index - start + players.length) % players.length
    turns.set(
      player,
      Math.floor(empty / players.length) + (behind < empty % players.length ? 1 : 0),
    )
  }
  const mostTurns = Math.max(...turns.values())

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const [dx, dy] of DIRECTIONS) {
        const endX = x + dx * (winLength - 1)
        const endY = y + dy * (winLength - 1)
        if (endX < 0 || endX >= width || endY < 0 || endY >= height) continue

        let owner: PlayerId | null = null
        let open = 0
        let alive = true
        for (let step = 0; step < winLength; step++) {
          if (outline !== undefined && !hasCell(config, x + dx * step, y + dy * step)) {
            alive = false
            break
          }
          const mark = cells[(y + dy * step) * width + (x + dx * step)]
          if (mark === null || mark === undefined) {
            open++
          } else if (owner === null) {
            owner = mark
          } else if (owner !== mark) {
            alive = false
            break
          }
        }
        if (!alive) continue
        // A window of one player's marks is alive for that player only; an empty one for anybody.
        const available = owner === null ? mostTurns : (turns.get(owner) ?? 0)
        if (open <= available) return true
      }
    }
  }
  return false
}
