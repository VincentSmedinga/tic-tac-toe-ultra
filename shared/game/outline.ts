/**
 * Fields that are not a rectangle. An outline is a name for a set of cells inside a box of
 * `width` × `height`; a config without one is a plain rectangle, every cell of the box. A stored
 * game keeps only the name, so the cells of a name never change once games are stored with it: a
 * different form is a new name.
 */
import type { GameConfig } from './game.ts'

export const OUTLINE_IDS = ['pyramid', 'plus'] as const

export type OutlineId = (typeof OUTLINE_IDS)[number]

export interface Outline {
  /** The size of the box around the outline, which a config with it must have. */
  readonly width: number
  readonly height: number
  /** Whether the cell at (x, y), inside the box, is a cell of the field. */
  readonly has: (x: number, y: number) => boolean
}

export const OUTLINES: Readonly<Record<OutlineId, Outline>> = {
  /** Seven rows, 1, 3, 5, … 13 cells wide, centred: 49 cells with the point at the top. */
  pyramid: { width: 13, height: 7, has: (x, y) => Math.abs(x - 6) <= y },
  /** Two bars, 3 cells wide, across a 9 × 9: 45 cells, without the four corners. */
  plus: { width: 9, height: 9, has: (x, y) => (x >= 3 && x <= 5) || (y >= 3 && y <= 5) },
}

type Box = Pick<GameConfig, 'width' | 'height' | 'outline'>

/** Whether (x, y) is a cell of the field: inside the box, and not left out by its outline. */
export function hasCell({ width, height, outline }: Box, x: number, y: number): boolean {
  const inside =
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height
  return inside && (outline === undefined || OUTLINES[outline].has(x, y))
}

/** How many cells the field has: the most moves a game on it can take. */
export function cellCount(config: Box): number {
  const { width, height, outline } = config
  if (outline === undefined) return width * height
  let count = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (hasCell(config, x, y)) count++
  }
  return count
}
