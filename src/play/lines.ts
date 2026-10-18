/**
 * The lines of the field: the # of tic-tac-toe. Lines run *between* the cells and none around the
 * field, so a 3 × 3 has two lines across and two down. They are drawn in units of one cell (a field
 * of `width` × `height` cells is `width` × `height` units), so the lines stay between the cells
 * whatever size the board gets.
 */
export interface BoardLine {
  /** `vertical` lines separate columns, `horizontal` lines separate rows. */
  axis: 'vertical' | 'horizontal'
  /** Between which cells: the line runs after this many columns (or rows), counted from 1. */
  after: number
  /** A straight line from one side of the field to the other. */
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

/** A line at `at` that runs from 0 to `length`, as a marker would draw it, from a seed. */
function handLine(axis: BoardLine['axis'], at: number, length: number, seed: number) {
  const next = random(seed)
  // How far the pen strays from the ruler, in cells: enough to see, not enough to enter a cell.
  const sway = () => (next() - 0.5) * 0.05
  // The pen starts a little before the edge or after it and does not stop where the ruler would.
  const start = (next() - 0.5) * 0.08
  const end = length + (next() - 0.5) * 0.08
  const steps = Math.max(3, Math.round(length / 2.5))
  const points: string[] = []
  const lean = sway()
  for (let step = 0; step <= steps; step++) {
    const along = step === 0 ? start : step === steps ? end : (length * step) / steps
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

/** The lines between the cells of a field: one between every two columns and every two rows. */
export function boardLines(width: number, height: number): BoardLine[] {
  const lines: BoardLine[] = []
  for (let after = 1; after < width; after++) {
    lines.push({
      axis: 'vertical',
      after,
      straight: `M${after.toString()} 0 L${after.toString()} ${height.toString()}`,
      hand: handLine('vertical', after, height, after * 7919 + width * 31 + height),
      weight: round(0.85 + random(after * 131 + 1)() * 0.4),
    })
  }
  for (let after = 1; after < height; after++) {
    lines.push({
      axis: 'horizontal',
      after,
      straight: `M0 ${after.toString()} L${width.toString()} ${after.toString()}`,
      hand: handLine('horizontal', after, width, after * 104729 + width * 17 + height * 3),
      weight: round(0.85 + random(after * 977 + 5)() * 0.4),
    })
  }
  return lines
}
