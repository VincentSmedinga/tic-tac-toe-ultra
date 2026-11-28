/**
 * The surface of a field with an outline: the board's see-through patch in the colour of the page,
 * cut to the form of the field instead of the box around it.
 */
import { hasCell } from '../../shared/game/index.ts'
import type { GameConfig } from '../../shared/game/index.ts'

/** A corner of the form, in cells, and which way is out of it there (-1, 0 or 1 each way). */
export interface Corner {
  x: number
  y: number
  outX: number
  outY: number
}

/**
 * The corners of a field's form, going round it clockwise. The cells of a field hang together in one
 * piece without holes and never touch by a corner only (`surface.test.ts` checks every outline).
 */
export function outlineCorners(config: Pick<GameConfig, 'width' | 'height' | 'outline'>): Corner[] {
  // Every side of a cell with no cell beside it, walked clockwise, by where it starts.
  const sides = new Map<string, { x: number; y: number; dx: number; dy: number }>()
  const add = (x: number, y: number, dx: number, dy: number) => {
    sides.set(`${x.toString()},${y.toString()}`, { x, y, dx, dy })
  }
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (!hasCell(config, x, y)) continue
      if (!hasCell(config, x, y - 1)) add(x, y, 1, 0)
      if (!hasCell(config, x + 1, y)) add(x + 1, y, 0, 1)
      if (!hasCell(config, x, y + 1)) add(x + 1, y + 1, -1, 0)
      if (!hasCell(config, x - 1, y)) add(x, y + 1, 0, -1)
    }
  }

  const corners: Corner[] = []
  const [first] = sides.values()
  let side = first
  let before =
    first && [...sides.values()].find((s) => s.x + s.dx === first.x && s.y + s.dy === first.y)
  for (let step = 0; step < sides.size && side && before; step++) {
    // Where the walk turns there is a corner. Out of a side walked clockwise is to its left.
    if (side.dx !== before.dx || side.dy !== before.dy) {
      corners.push({
        x: side.x,
        y: side.y,
        outX: before.dy + side.dy,
        outY: -before.dx - side.dx,
      })
    }
    before = side
    side = sides.get(`${(side.x + side.dx).toString()},${(side.y + side.dy).toString()}`)
  }
  return corners
}

/**
 * The form as a `clip-path` for an element that reaches `--rim` round the grid on every side, so the
 * surface reaches that far round the cells, as it does round a rectangle.
 */
export function surfaceShape(config: Pick<GameConfig, 'width' | 'height' | 'outline'>): string {
  const along = (at: number, size: number, out: number) =>
    `calc((100% - 2 * var(--rim)) * ${(at / size).toFixed(4)} + ${(1 + out).toString()} * var(--rim))`
  const points = outlineCorners(config).map(
    ({ x, y, outX, outY }) => `${along(x, config.width, outX)} ${along(y, config.height, outY)}`,
  )
  return `polygon(${points.join(', ')})`
}
