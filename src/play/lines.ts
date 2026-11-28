/**
 * The lines of the field: the # of tic-tac-toe. Lines run *between* the cells and none around the
 * field, so a 3 × 3 has two lines across and two down. A field with an outline has a line around it
 * as well, or the cells at its edge would be hard to see. They are drawn in units of one cell (a
 * field of `width` × `height` cells is `width` × `height` units), so the lines stay between the
 * cells whatever size the board gets.
 */
import { hasCell } from '../../shared/game/index.ts'
import type { OutlineId } from '../../shared/game/index.ts'

export interface BoardLine {
  /** `vertical` lines separate columns, `horizontal` lines separate rows. */
  axis: 'vertical' | 'horizontal'
  /**
   * Between which cells: the line runs after this many columns (or rows). 0 and the width (or the
   * height) are the edge of the box, which only an outline draws.
   */
  after: number
  /** Where the line starts and ends, in cells along it. */
  from: number
  to: number
  /** A straight line from `from` to `to`. */
  straight: string
  /** The same line as a marker would draw it: a little crooked, and never like the next one. */
  hand: string
  /** How heavy the pen pressed, around 1: a look that draws by hand lets lines differ in weight. */
  weight: number
}

/** A small, repeatable random sequence (mulberry32): the same field is drawn the same way each time. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (value: number) => Number(value.toFixed(3))

/** A line at `at` that runs from `from` to `to`, as a marker would draw it, from a seed. */
function handLine(axis: BoardLine['axis'], at: number, from: number, to: number, seed: number) {
  const next = random(seed)
  // How far the pen strays from the ruler, in cells: enough to see, not enough to enter a cell.
  const sway = () => (next() - 0.5) * 0.05
  // The pen starts a little before the edge or after it and does not stop where the ruler would.
  const start = from + (next() - 0.5) * 0.08
  const end = to + (next() - 0.5) * 0.08
  const steps = Math.max(3, Math.round((to - from) / 2.5))
  const points: string[] = []
  const lean = sway()
  for (let step = 0; step <= steps; step++) {
    const along = step === 0 ? start : step === steps ? end : from + ((to - from) * step) / steps
    // The hand drifts to one side over the whole stroke and wobbles on top of it.
    const across = at + lean * (step / steps - 0.5) * 2 + sway() * 0.5
    points.push(
      axis === 'vertical'
        ? `${round(across).toString()} ${round(along).toString()}`
        : `${round(along).toString()} ${round(across).toString()}`,
    )
  }
  return `M${points.join(' L')}`
}

function boardLine(
  axis: BoardLine['axis'],
  after: number,
  from: number,
  to: number,
  width: number,
  height: number,
): BoardLine {
  const vertical = axis === 'vertical'
  const a = after.toString()
  // A piece that starts further on gets a seed of its own.
  const seed = vertical
    ? after * 7919 + width * 31 + height + from * 613
    : after * 104729 + width * 17 + height * 3 + from * 389
  return {
    axis,
    after,
    from,
    to,
    straight: vertical
      ? `M${a} ${from.toString()} L${a} ${to.toString()}`
      : `M${from.toString()} ${a} L${to.toString()} ${a}`,
    hand: handLine(axis, after, from, to, seed),
    weight: round(0.85 + random(vertical ? after * 131 + 1 : after * 977 + 5)() * 0.4),
  }
}

/**
 * The lines of a field. A rectangle has one between every two columns and every two rows, from one
 * side to the other. An outline has a line along every side of every one of its cells, so between
 * them and around them, and none where there is no cell.
 */
export function boardLines(width: number, height: number, outline?: OutlineId): BoardLine[] {
  const lines: BoardLine[] = []
  const config = { width, height, ...(outline === undefined ? {} : { outline }) }
  for (const axis of ['vertical', 'horizontal'] as const) {
    const vertical = axis === 'vertical'
    const across = vertical ? width : height
    const length = vertical ? height : width
    if (outline === undefined) {
      for (let after = 1; after < across; after++) {
        lines.push(boardLine(axis, after, 0, length, width, height))
      }
      continue
    }
    for (let after = 0; after <= across; after++) {
      // Whether a cell lies on either side of the line at this place along it.
      const borders = (along: number) =>
        [after - 1, after].some((side) =>
          vertical ? hasCell(config, side, along) : hasCell(config, along, side),
        )
      let from: number | null = null
      for (let along = 0; along <= length; along++) {
        if (along < length && borders(along)) from ??= along
        else if (from !== null) {
          lines.push(boardLine(axis, after, from, along, width, height))
          from = null
        }
      }
    }
  }
  return lines
}
