import { describe, expect, it } from 'vitest'
import {
  applyMove,
  canStillWin,
  cellCount,
  createGame,
  getCell,
  hasCell,
  OUTLINE_IDS,
  OUTLINES,
  replayGame,
  stateAfter,
} from './index.ts'
import type { Cell, GameConfig, GameState, OutlineId, PlayerId } from './index.ts'

function configOf(outline: OutlineId, winLength = 5): GameConfig {
  const { width, height } = OUTLINES[outline]
  return { width, height, winLength, players: ['A', 'B'], outline }
}

const pyramid = configOf('pyramid')
const plus = configOf('plus')

/** The field as rows of text: `#` is a cell, `.` is not. */
function drawing(config: GameConfig): string[] {
  return Array.from({ length: config.height }, (_, y) =>
    Array.from({ length: config.width }, (_, x) => (hasCell(config, x, y) ? '#' : '.')).join(''),
  )
}

/** The cells of a position: what `mark` says on the cells of the field, nothing beside them. */
function position(
  config: GameConfig,
  mark: (x: number, y: number) => PlayerId | null,
): (PlayerId | null)[] {
  return Array.from({ length: config.width * config.height }, (_, index) => {
    const x = index % config.width
    const y = Math.floor(index / config.width)
    return hasCell(config, x, y) ? mark(x, y) : null
  })
}

/** Plays the cells, the players taking turns; every move must be allowed. */
function play(config: GameConfig, cells: readonly (readonly [number, number])[]): GameState {
  return cells.reduce((state, [x, y]) => {
    if (state.status.kind !== 'playing') throw new Error('the game ended too soon')
    const result = applyMove(state, { player: state.status.next, x, y })
    if (!result.ok) throw new Error(`(${x.toString()}, ${y.toString()}): ${result.error}`)
    return result.state
  }, createGame(config))
}

describe('the outlines', () => {
  it('draws the pyramid as seven rows, wider towards the bottom, with 49 cells', () => {
    expect(drawing(pyramid)).toEqual([
      '......#......',
      '.....###.....',
      '....#####....',
      '...#######...',
      '..#########..',
      '.###########.',
      '#############',
    ])
    expect(cellCount(pyramid)).toBe(49)
  })

  it('draws the plus as two bars of three across, with 45 cells', () => {
    expect(drawing(plus)).toEqual([
      '...###...',
      '...###...',
      '...###...',
      '#########',
      '#########',
      '#########',
      '...###...',
      '...###...',
      '...###...',
    ])
    expect(cellCount(plus)).toBe(45)
  })

  it('has every cell of the box without an outline, and none beside the box', () => {
    const rectangle: GameConfig = { width: 7, height: 5, winLength: 5, players: ['A', 'B'] }
    expect(cellCount(rectangle)).toBe(35)
    expect(hasCell(rectangle, 6, 4)).toBe(true)
    for (const [x, y] of [
      [-1, 0],
      [7, 0],
      [0, 5],
      [0.5, 0],
    ] as const) {
      expect(hasCell(rectangle, x, y)).toBe(false)
      expect(hasCell(pyramid, x - 100, y)).toBe(false)
    }
  })

  // `createGame` only checks that a row fits in the box. A new outline that breaks this needs a
  // check of its own there, or a game on it could be made that nobody can win.
  it.each(OUTLINE_IDS)(
    'has a line on the %s for every row that fits the box around it',
    (outline) => {
      const { width, height } = OUTLINES[outline]
      for (let winLength = 2; winLength <= Math.max(width, height); winLength++) {
        const config = configOf(outline, winLength)
        expect(
          canStillWin(
            config,
            position(config, () => null),
            'A',
          ),
          `${winLength}`,
        ).toBe(true)
      }
    },
  )
})

describe('a game on an outline', () => {
  it('keeps the outline in its config, and a rectangle has none', () => {
    expect(createGame(pyramid).config).toStrictEqual(pyramid)
    const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['A', 'B'] }
    expect(createGame(classic).config).toStrictEqual(classic)
  })

  it('can not be made with a size that is not the outlines, or a name nobody knows', () => {
    expect(() => createGame({ ...pyramid, width: 11 })).toThrow(RangeError)
    expect(() => createGame({ ...plus, height: 7 })).toThrow(RangeError)
    expect(() => createGame({ ...plus, outline: 'ring' as OutlineId })).toThrow(RangeError)
    expect(() => createGame({ ...plus, outline: 'toString' as OutlineId })).toThrow(RangeError)
  })

  it('has no cell where the outline leaves one out, and refuses a move there', () => {
    const state = createGame(plus)
    expect(getCell(state, { x: 0, y: 0 })).toBeUndefined()
    expect(getCell(state, { x: 4, y: 0 })).toBeNull()
    expect(applyMove(state, { player: 'A', x: 0, y: 0 })).toEqual({
      ok: false,
      error: 'out-of-bounds',
    })
  })

  const wins: [string, GameConfig, readonly (readonly [number, number])[], Cell[]][] = [
    [
      'along a bar of the plus',
      plus,
      [
        [0, 4],
        [3, 0],
        [1, 4],
        [3, 1],
        [2, 4],
        [3, 2],
        [3, 4],
        [4, 0],
        [4, 4],
      ],
      [0, 1, 2, 3, 4].map((x) => ({ x, y: 4 })),
    ],
    [
      'along the sloping side of the pyramid',
      pyramid,
      [
        [6, 0],
        [6, 6],
        [5, 1],
        [7, 6],
        [4, 2],
        [8, 6],
        [3, 3],
        [9, 6],
        [2, 4],
      ],
      [2, 3, 4, 5, 6].map((x) => ({ x, y: 6 - x })),
    ],
  ]

  it.each(wins)('is won %s', (_name, config, cells, line) => {
    const { status } = play(config, cells)
    expect(status).toEqual({ kind: 'won', winner: 'A', lines: [line] })
  })

  it('does not count a line across a hole', () => {
    // (0, 3) and (3, 0) are on one diagonal, with two cells that don't exist between them.
    const state = play({ ...plus, winLength: 2 }, [
      [0, 3],
      [8, 5],
      [3, 0],
    ])
    expect(state.status.kind).toBe('playing')
  })

  it('is drawn when every row that exists is closed, however empty the box looks', () => {
    // Nine in a row only fits on the three rows and three columns through the middle of the plus.
    // The diagonals of the box are empty, but they run over cells that don't exist.
    const cells = [
      [3, 3],
      [3, 4],
      [4, 4],
      [4, 5],
      [5, 5],
      [5, 3],
    ] as const
    const onPlus = { ...plus, winLength: 9 }
    expect(play(onPlus, cells.slice(0, 5)).status.kind).toBe('playing')
    expect(play(onPlus, cells).status.kind).toBe('draw')
    const rectangle: GameConfig = { width: 9, height: 9, winLength: 9, players: ['A', 'B'] }
    expect(play(rectangle, cells).status.kind).toBe('playing')
  })

  it('gives turns for the empty cells of the field only', () => {
    // Nine or more in a row: on a pyramid, thirteen is only the bottom row. Everything else is
    // taken, except two cells of that row.
    const config = { ...pyramid, winLength: 13 }
    const twoLeft = position(config, (x, y) => (y < 6 ? 'B' : x < 11 ? 'A' : null))
    expect(canStillWin(config, twoLeft, 'A')).toBe(false)
    const oneLeft = position(config, (x, y) => (y < 6 ? 'B' : x < 12 ? 'A' : null))
    expect(canStillWin(config, oneLeft, 'A')).toBe(true)
  })

  it('is full when every cell of the field is taken, with the corners still empty', () => {
    // Pairs that move on every row: nowhere five alike.
    const cells = position(plus, (x, y) =>
      x === 4 && y === 0 ? null : (x + 2 * y) % 4 < 2 ? 'A' : 'B',
    )
    const state: GameState = { ...createGame(plus), cells, moveCount: cellCount(plus) - 1 }
    const result = applyMove(state, { player: 'A', x: 4, y: 0 })
    expect(result.ok && result.state.status).toEqual({ kind: 'draw' })
    expect(result.ok && result.state.cells[0]).toBeNull()
  })

  it('is read back from its config and moves, on the same outline', () => {
    const played = play(pyramid, [
      [6, 0],
      [6, 6],
      [5, 1],
    ])
    const replayed = replayGame(played.config, played.moves)
    expect(replayed.ok && replayed.state).toEqual(played)
    expect(stateAfter(played, 1).config).toStrictEqual(pyramid)
  })
})
