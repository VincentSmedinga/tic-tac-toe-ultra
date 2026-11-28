/**
 * What a mark is worth to the computer player, and the characters, which are nothing but different
 * weights for it. This is taste, not a rule: who wins is only ever asked of the engine.
 */
import type { GameConfig, GameState, PlayerId } from './game.ts'
import { hasCell } from './outline.ts'
import { cellAt, DIRECTIONS } from './tactics.ts'

/** What the computer likes to do, next to how well it does it (its level). */
export const BOT_CHARACTERS = ['balanced', 'defender', 'attacker', 'wild'] as const

export type BotCharacter = (typeof BOT_CHARACTERS)[number]

export interface Taste {
  /** How much a line that is its own, or still free, counts. */
  readonly attack: number
  /** How much cutting off a line of somebody else counts. */
  readonly defend: number
  /** A bonus for a mark that threatens to win at the next turn. */
  readonly threat: number
  /** A bonus for every mark of somebody else right next to the cell. */
  readonly crowd: number
}

/** A line that is one mark short of winning, whatever `winLength` is. */
const ALMOST = 12 ** 4

export const TASTES: Readonly<Record<BotCharacter, Taste>> = {
  balanced: { attack: 1.1, defend: 1, threat: 0, crowd: 0 },
  defender: { attack: 0.3, defend: 1, threat: 0, crowd: 0 },
  attacker: { attack: 1, defend: 0.3, threat: 0, crowd: 0 },
  wild: { attack: 1, defend: 0.4, threat: ALMOST, crowd: 60 },
}

/** What a window with this many marks of one player is worth: twelve times more for every mark. */
export function worth(marks: number, winLength: number): number {
  return 12 ** (marks + 5 - winLength)
}

/**
 * Every run of `winLength` cells that are all on the field, as indexes into `cells`, and for each
 * cell the runs it is in. Worked out once for a move.
 */
export interface Windows {
  readonly all: readonly (readonly number[])[]
  readonly through: readonly (readonly (readonly number[])[])[]
}

export function windowsOf(config: GameConfig): Windows {
  const { width, height, winLength } = config
  const all: number[][] = []
  const through: number[][][] = Array.from({ length: width * height }, () => [])
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const [dx, dy] of DIRECTIONS) {
        const cells: number[] = []
        for (let step = 0; step < winLength; step++) {
          if (!hasCell(config, x + dx * step, y + dy * step)) break
          cells.push((y + dy * step) * width + x + dx * step)
        }
        if (cells.length < winLength) continue
        all.push(cells)
        for (const cell of cells) through[cell]?.push(cells)
      }
    }
  }
  return { all, through }
}

/** Whose marks a window holds: null while empty, undefined when two players are in it (dead). */
export function ownerOf(
  cells: readonly (PlayerId | null)[],
  window: readonly number[],
): { owner: PlayerId | null; marks: number } | undefined {
  let owner: PlayerId | null = null
  let marks = 0
  for (const index of window) {
    const mark = cells[index] ?? null
    if (mark === null) continue
    if (owner !== null && owner !== mark) return undefined
    owner = mark
    marks++
  }
  return { owner, marks }
}

/**
 * What the empty cell `index` is worth to `player` with this taste: the lines it makes longer, the
 * lines of others it cuts off (the sooner their owner moves again the more urgent), and what the
 * character adds.
 */
export function cellValue(
  state: GameState,
  windows: Windows,
  index: number,
  player: PlayerId,
  taste: Taste,
): number {
  const { config, cells } = state
  const { players, winLength, width } = config
  const me = players.indexOf(player)
  let value = 0
  let threatens = false
  for (const window of windows.through[index] ?? []) {
    const line = ownerOf(cells, window)
    if (line === undefined) continue
    if (line.owner === null || line.owner === player) {
      value += worth(line.marks, winLength) * taste.attack
      threatens ||= line.marks === winLength - 2
    } else {
      const wait = (players.indexOf(line.owner) - me + players.length) % players.length
      value += (worth(line.marks, winLength) * taste.defend) / (1 + 0.35 * (wait - 1))
    }
  }
  if (threatens) value += taste.threat
  if (taste.crowd > 0) value += taste.crowd * neighbours(cells, cellAt(width, index), width, player)
  return value
}

/** How many marks of other players touch a cell, corners included. */
function neighbours(
  cells: readonly (PlayerId | null)[],
  { x, y }: { x: number; y: number },
  width: number,
  player: PlayerId,
): number {
  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue
      const mark = cells[(y + dy) * width + nx]
      if (mark !== undefined && mark !== null && mark !== player) count++
    }
  }
  return count
}
