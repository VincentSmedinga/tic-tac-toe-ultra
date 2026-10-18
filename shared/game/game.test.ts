import { describe, expect, it } from 'vitest'
import { applyMove, createGame, getCell } from './index.ts'
import type { Cell, GameConfig, GameState, MoveError } from './index.ts'

const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

/** Plays the cells in turn order and expects every move to be legal. */
function play(state: GameState, cells: readonly (readonly [number, number])[]): GameState {
  return cells.reduce((current, [x, y]) => {
    if (current.status.kind !== 'playing') throw new Error(`the game ended before (${x}, ${y})`)
    const result = applyMove(current, { player: current.status.next, x, y })
    if (!result.ok) throw new Error(`(${x}, ${y}) was refused: ${result.error}`)
    return result.state
  }, state)
}

function sorted(cells: readonly Cell[]): Cell[] {
  return [...cells].sort((a, b) => a.y - b.y || a.x - b.x)
}

function refusal(state: GameState, move: Parameters<typeof applyMove>[1]): MoveError {
  const result = applyMove(state, move)
  if (result.ok) throw new Error('the move was accepted')
  return result.error
}

describe('createGame', () => {
  it('starts on an empty field with the first player', () => {
    const game = createGame(classic)
    expect(game.cells).toEqual(Array<null>(9).fill(null))
    expect(game.moveCount).toBe(0)
    expect(game.status).toEqual({ kind: 'playing', next: 'X' })
  })

  it.each<[string, Partial<GameConfig>]>([
    ['a width of zero', { width: 0 }],
    ['a fractional height', { height: 2.5 }],
    ['a winLength of 1', { winLength: 1 }],
    ['a winLength that does not fit', { winLength: 4 }],
    ['one player', { players: ['X'] }],
    ['the same player twice', { players: ['X', 'X'] }],
  ])('refuses %s', (_name, change) => {
    expect(() => createGame({ ...classic, ...change })).toThrow(RangeError)
  })

  it('does not follow later changes to the players it was given', () => {
    const players = ['X', 'O']
    const game = createGame({ ...classic, players })
    players.push('Z')
    expect(game.config.players).toEqual(['X', 'O'])
  })
})

describe('applyMove', () => {
  it('puts the mark on the field and hands the turn on', () => {
    const result = applyMove(createGame(classic), { player: 'X', x: 2, y: 1 })
    if (!result.ok) throw new Error(result.error)
    expect(getCell(result.state, { x: 2, y: 1 })).toBe('X')
    expect(result.state.cells[5]).toBe('X')
    expect(result.state.moveCount).toBe(1)
    expect(result.state.status).toEqual({ kind: 'playing', next: 'O' })
  })

  it('does not change the state it was given', () => {
    const before = createGame(classic)
    applyMove(before, { player: 'X', x: 0, y: 0 })
    expect(before.cells.every((cell) => cell === null)).toBe(true)
    expect(before.status).toEqual({ kind: 'playing', next: 'X' })
  })

  describe('refuses', () => {
    const started = play(createGame(classic), [[1, 1]])

    it.each<[number, number]>([
      [-1, 0],
      [0, -1],
      [3, 0],
      [0, 3],
      [1.5, 1],
      [Number.NaN, 0],
    ])('a move outside the field at (%s, %s)', (x, y) => {
      expect(refusal(started, { player: 'O', x, y })).toBe('out-of-bounds')
    })

    it('a move on a cell that is taken', () => {
      expect(refusal(started, { player: 'O', x: 1, y: 1 })).toBe('cell-taken')
    })

    it('a move out of turn', () => {
      expect(refusal(started, { player: 'X', x: 0, y: 0 })).toBe('not-your-turn')
    })

    it('a move from someone who is not playing', () => {
      expect(refusal(started, { player: 'Z', x: 0, y: 0 })).toBe('not-your-turn')
    })

    it('a move after the game has been won', () => {
      const won = play(createGame(classic), [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
      ])
      expect(refusal(won, { player: 'O', x: 2, y: 2 })).toBe('game-over')
    })
  })
})

describe('winning on 3×3', () => {
  const lines: readonly (readonly [string, readonly Cell[]])[] = [
    [
      'the top row',
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    ],
    [
      'the middle row',
      [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    ],
    [
      'the bottom row',
      [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ],
    ],
    [
      'the left column',
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    ],
    [
      'the middle column',
      [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
    ],
    [
      'the right column',
      [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
    ],
    [
      'the diagonal',
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    ],
    [
      'the other diagonal',
      [
        { x: 2, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 2 },
      ],
    ],
  ]

  it.each(lines)('X wins with %s', (_name, line) => {
    // O fills in the first two cells that are not on the line, which can't make a line of three.
    const others = Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3) })).filter(
      (cell) => !line.some(({ x, y }) => x === cell.x && y === cell.y),
    )
    const [x1, x2, x3] = line
    const [o1, o2] = others
    if (!x1 || !x2 || !x3 || !o1 || !o2) throw new Error('not enough cells')

    const game = play(
      createGame(classic),
      [x1, o1, x2, o2, x3].map(({ x, y }) => [x, y] as const),
    )
    if (game.status.kind !== 'won') throw new Error('the game is not won')
    expect(game.status.winner).toBe('X')
    expect(game.status.lines).toHaveLength(1)
    expect(sorted(game.status.lines[0] ?? [])).toEqual(sorted(line))
  })

  it('O can win as well', () => {
    const game = play(createGame(classic), [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 2],
      [2, 0],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'O' })
  })

  it('does not see a win in two marks and a gap', () => {
    const game = play(createGame(classic), [
      [0, 0],
      [0, 1],
      [2, 0],
    ])
    expect(game.status).toEqual({ kind: 'playing', next: 'O' })
  })
})

describe('a draw', () => {
  const drawn = [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
    [0, 1],
    [2, 1],
    [1, 2],
    [0, 2],
    [2, 2],
  ] as const

  it('is declared when the field is full and nobody has won', () => {
    const almost = play(createGame(classic), drawn.slice(0, 8))
    expect(almost.status).toEqual({ kind: 'playing', next: 'X' })
    expect(play(almost, drawn.slice(8)).status).toEqual({ kind: 'draw' })
  })

  it('does not stop a win with the very last move', () => {
    const game = play(createGame(classic), [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [0, 2],
      [2, 2],
    ])
    expect(game.moveCount).toBe(9)
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
  })

  it('refuses a move once the game is a draw', () => {
    const game = play(createGame(classic), drawn)
    expect(refusal(game, { player: 'O', x: 0, y: 0 })).toBe('game-over')
  })
})

describe('every game of classic tic-tac-toe', () => {
  it('ends the way the known counts say', () => {
    // 255,168 games are possible: 131,184 won by X, 77,904 by O and 46,080 drawn.
    const counts = { games: 0, X: 0, O: 0, draws: 0 }
    const explore = (state: GameState): void => {
      if (state.status.kind === 'won') {
        counts.games++
        counts[state.status.winner === 'X' ? 'X' : 'O']++
        return
      }
      if (state.status.kind === 'draw') {
        counts.games++
        counts.draws++
        return
      }
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const result = applyMove(state, { player: state.status.next, x, y })
          if (result.ok) explore(result.state)
        }
      }
    }
    explore(createGame(classic))
    expect(counts).toEqual({ games: 255_168, X: 131_184, O: 77_904, draws: 46_080 })
  })
})

describe('more players', () => {
  const three: GameConfig = { width: 5, height: 5, winLength: 3, players: ['A', 'B', 'C'] }

  it('goes round in turn order', () => {
    const next = (cells: readonly (readonly [number, number])[]) =>
      play(createGame(three), cells).status
    expect(next([])).toEqual({ kind: 'playing', next: 'A' })
    expect(next([[0, 0]])).toEqual({ kind: 'playing', next: 'B' })
    expect(
      next([
        [0, 0],
        [1, 0],
      ]),
    ).toEqual({ kind: 'playing', next: 'C' })
    expect(
      next([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toEqual({ kind: 'playing', next: 'A' })
  })

  it('lets the third player win', () => {
    const game = play(createGame(three), [
      [0, 0], // A
      [4, 4], // B
      [0, 2], // C
      [1, 0], // A
      [3, 4], // B
      [1, 2], // C
      [3, 0], // A
      [0, 4], // B
      [2, 2], // C: row 2
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'C' })
  })
})

describe('a bigger field', () => {
  const gomoku: GameConfig = { width: 15, height: 15, winLength: 5, players: ['X', 'O'] }
  const scatter: readonly (readonly [number, number])[] = [
    [0, 0],
    [2, 0],
    [4, 0],
    [6, 0],
    [8, 0],
  ]

  /** X plays `xs` and O plays the scattered cells; the last X move comes last. */
  function race(xs: readonly (readonly [number, number])[]): GameState {
    const moves: (readonly [number, number])[] = []
    xs.forEach((x, i) => {
      moves.push(x)
      const o = scatter[i]
      if (i < xs.length - 1 && o) moves.push(o)
    })
    return play(createGame(gomoku), moves)
  }

  it('needs five in a row, not four', () => {
    const game = race([
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
    ])
    expect(game.status).toEqual({ kind: 'playing', next: 'O' })
  })

  it('is won by five on a diagonal', () => {
    const game = race([
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
  })

  it('is won by five on an anti-diagonal in the far corner', () => {
    const game = race([
      [14, 10],
      [13, 11],
      [12, 12],
      [11, 13],
      [10, 14],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
  })

  it('is won by a move in the middle that joins two groups, and the line holds all of them', () => {
    const game = race([
      [2, 2],
      [3, 2],
      [5, 2],
      [6, 2],
      [4, 2],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
    if (game.status.kind !== 'won') throw new Error('not won')
    expect(game.status.lines).toEqual([[2, 3, 4, 5, 6].map((x) => ({ x, y: 2 }))])
  })

  it('works on a field that is wider than it is high', () => {
    const wide: GameConfig = { width: 5, height: 3, winLength: 4, players: ['X', 'O'] }
    const game = play(createGame(wide), [
      [1, 2],
      [0, 0],
      [2, 2],
      [0, 1],
      [3, 2],
      [4, 0],
      [4, 2],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
    expect(getCell(game, { x: 4, y: 2 })).toBe('X')
    expect(getCell(game, { x: 5, y: 2 })).toBeUndefined()
  })
})

describe('a move that completes more than one line', () => {
  const cells = (list: readonly (readonly [number, number])[]) => list.map(([x, y]) => ({ x, y }))

  /** The lines of a won game, each with its cells sorted, for comparing. */
  function linesOf(game: GameState): Cell[][] {
    if (game.status.kind !== 'won') throw new Error('the game is not won')
    return game.status.lines.map((line) => sorted(line))
  }

  /** The cells that are on any of the lines, each once. */
  function cellsOf(game: GameState): Cell[] {
    return sorted(
      linesOf(game)
        .flat()
        .filter((cell, i, all) => all.findIndex(({ x, y }) => x === cell.x && y === cell.y) === i),
    )
  }

  /** X plays `xs` and O plays `os` in turn, and then X plays `last`. */
  function race(
    config: GameConfig,
    xs: readonly (readonly [number, number])[],
    os: readonly (readonly [number, number])[],
    last: readonly [number, number],
  ): GameState {
    const turns = xs.flatMap((cell, i) => [cell, os[i] ?? [-1, -1]]).filter(([x]) => x >= 0)
    return play(createGame(config), [...turns, last] as (readonly [number, number])[])
  }

  it('wins the row and the column at once from a corner: five cells, not three', () => {
    // X has the top row and the right column; the corner (2, 0) completes both.
    const game = play(createGame(classic), [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
      [0, 2],
      [2, 2],
      [1, 2],
      [2, 0],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
    expect(linesOf(game)).toEqual([
      sorted(
        cells([
          [0, 0],
          [1, 0],
          [2, 0],
        ]),
      ),
      sorted(
        cells([
          [2, 0],
          [2, 1],
          [2, 2],
        ]),
      ),
    ])
    expect(cellsOf(game)).toHaveLength(5)
  })

  it('wins both diagonals at once from the middle: five cells, with the middle once', () => {
    // X has the four corners, O the four edges, and X's last move is the middle.
    const game = play(createGame(classic), [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [0, 2],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ])
    expect(linesOf(game)).toEqual([
      sorted(
        cells([
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
      ),
      sorted(
        cells([
          [2, 0],
          [1, 1],
          [0, 2],
        ]),
      ),
    ])
    expect(cellsOf(game)).toHaveLength(5)
  })

  it('wins a row, a column and both diagonals at once on a bigger field: four lines', () => {
    const config: GameConfig = { width: 7, height: 7, winLength: 4, players: ['X', 'O'] }
    // Around (3, 3) X has three cells on each of the four lines, with a gap where the move will be.
    const xs: [number, number][] = [
      [1, 3],
      [2, 3],
      [4, 3],
      [3, 1],
      [3, 2],
      [3, 4],
      [1, 1],
      [2, 2],
      [4, 4],
      [5, 1],
      [4, 2],
      [2, 4],
    ]
    // O keeps to cells that are two apart, so that it never has two next to each other.
    const os: [number, number][] = [
      [0, 0],
      [0, 2],
      [0, 4],
      [0, 6],
      [2, 0],
      [4, 0],
      [6, 0],
      [6, 2],
      [6, 4],
      [6, 6],
      [2, 6],
      [4, 6],
    ]
    const game = race(config, xs, os, [3, 3])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
    expect(linesOf(game)).toHaveLength(4)
    expect(cellsOf(game)).toHaveLength(13)
  })

  it('has one line for a longer run, next to the line of the other direction', () => {
    const config: GameConfig = { width: 7, height: 7, winLength: 4, players: ['X', 'O'] }
    // The move at (3, 3) joins a row of six and a column of five.
    const xs: [number, number][] = [
      [0, 3],
      [1, 3],
      [2, 3],
      [4, 3],
      [5, 3],
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 4],
    ]
    const os: [number, number][] = [
      [6, 0],
      [6, 2],
      [6, 4],
      [6, 6],
      [0, 6],
      [2, 6],
      [4, 6],
      [0, 0],
      [0, 5],
    ]
    const game = race(config, xs, os, [3, 3])
    expect(linesOf(game).map((line) => line.length)).toEqual([6, 5])
  })

  it('wins only one line when only one is complete', () => {
    const game = play(createGame(classic), [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [2, 2],
    ])
    expect(linesOf(game)).toEqual([
      sorted(
        cells([
          [0, 0],
          [1, 1],
          [2, 2],
        ]),
      ),
    ])
  })
})
