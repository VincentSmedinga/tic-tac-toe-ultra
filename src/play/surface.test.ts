import { describe, expect, it } from 'vitest'
import { cellCount, hasCell, OUTLINE_IDS, OUTLINES } from '../../shared/game/index.ts'
import { outlineCorners, surfaceShape } from './surface.ts'

const configOf = (outline: (typeof OUTLINE_IDS)[number]) => ({
  width: OUTLINES[outline].width,
  height: OUTLINES[outline].height,
  outline,
})

describe('the surface of a field with an outline', () => {
  it('goes round the twelve corners of the plus, clockwise', () => {
    const corners = outlineCorners(configOf('plus')).map(({ x, y }) => [x, y])
    expect(corners).toHaveLength(12)
    const start = corners.findIndex(([x, y]) => x === 3 && y === 0)
    expect([...corners.slice(start), ...corners.slice(0, start)]).toEqual([
      [3, 0],
      [6, 0],
      [6, 3],
      [9, 3],
      [9, 6],
      [6, 6],
      [6, 9],
      [3, 9],
      [3, 6],
      [0, 6],
      [0, 3],
      [3, 3],
    ])
  })

  // One walk round the edge only gives the whole form when it is one piece without holes whose cells
  // never touch by a corner only. A new outline that breaks this needs more than one polygon.
  it.each(OUTLINE_IDS)('holds exactly the cells of the %s', (outline) => {
    const config = configOf(outline)
    const corners = outlineCorners(config)
    // The area inside the walk (shoelace) is the number of cells.
    const area = corners.reduce((sum, { x, y }, index) => {
      const next = corners[(index + 1) % corners.length] ?? { x, y }
      return sum + (x * next.y - next.x * y) / 2
    }, 0)
    expect(area).toBe(cellCount(config))
  })

  it.each(OUTLINE_IDS)('reaches outwards at every corner of the %s', (outline) => {
    const config = configOf(outline)
    for (const { x, y, outX, outY } of outlineCorners(config)) {
      // The place diagonally outwards from a corner is never a cell.
      if (outX === 0 || outY === 0) continue
      expect(hasCell(config, outX > 0 ? x : x - 1, outY > 0 ? y : y - 1)).toBe(false)
    }
  })

  it('is a polygon that keeps its rim round the cells', () => {
    const shape = surfaceShape(configOf('plus'))
    expect(shape).toMatch(/^polygon\(/)
    expect(shape.split(', ')).toHaveLength(12)
    expect(shape).toContain('var(--rim)')
  })
})
