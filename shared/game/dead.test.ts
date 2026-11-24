import { describe, expect, it } from 'vitest'
import { applyMove, canStillWin, createGame, replayGame } from './index.ts'
import type { GameConfig, GameState, PlayerId } from './index.ts'

/** Builds a field from rows of text: `.` is empty, any other letter is that player. */
function field(...rows: string[]): (PlayerId | null)[] {
  return rows.flatMap((row) => [...row].map((letter) => (letter === '.' ? null : letter)))
}

describe('canStillWin', () => {
  const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

  it.each<[string, string[], PlayerId, boolean]>([
    ['an empty field', ['...', '...', '...'], 'X', true],
    // Every one of the eight lines holds both an X and an O.
    ['a classic draw with a cell left', ['XOX', 'XOO', 'OX.'], 'X', false],
    ['the same draw one move earlier', ['XOX', 'XOO', '...'], 'O', true],
    // Only the top row is still open, and O has no mark in it: O can still win with two more turns.
    ['one line left for the player to move', ['...', 'OXX', 'XOO'], 'X', true],
    ['a line one move from won for the other player', ['XX.', 'OOX', 'XOO'], 'X', true],
  ])('says %s', (_name, rows, toMove, expected) => {
    expect(canStillWin(classic, field(...rows), toMove)).toBe(expected)
  })

  it('counts the turns a player still gets', () => {
    // Two cells are left, in the same line, and X to move: X gets one of them, O the other. Neither
    // can fill both, so nobody can win, although the line holds only marks of X.
    const config: GameConfig = { width: 4, height: 1, winLength: 4, players: ['X', 'O'] }
    expect(canStillWin(config, field('XX..'), 'X')).toBe(false)
    expect(canStillWin(config, field('XXX.'), 'X')).toBe(true)
    // One cell left and O to move: only the one whose marks fill the line can win, and X has no turn.
    expect(canStillWin(config, field('XXX.'), 'O')).toBe(false)
  })

  it('is alive for one player only when a line holds only that players marks', () => {
    const config: GameConfig = { width: 3, height: 1, winLength: 3, players: ['A', 'B', 'C'] }
    expect(canStillWin(config, field('A..'), 'B')).toBe(false)
    expect(canStillWin(config, field('AA.'), 'A')).toBe(true)
    expect(canStillWin(config, field('AA.'), 'B')).toBe(false)
    expect(canStillWin(config, field('AB.'), 'C')).toBe(false)
  })

  it('works when winLength is the side of the field', () => {
    const config: GameConfig = { width: 4, height: 4, winLength: 4, players: ['X', 'O'] }
    expect(canStillWin(config, field('....', '....', '....', '....'), 'X')).toBe(true)
    // Every row, column and diagonal holds both players.
    expect(canStillWin(config, field('XXOO', 'OOXX', 'XXOO', 'OOX.'), 'X')).toBe(false)
  })

  it('is false for a player who is not in the game', () => {
    expect(canStillWin(classic, field('...', '...', '...'), 'Z')).toBe(false)
  })

  it('is fast on a big field with many players', () => {
    const players = Array.from({ length: 12 }, (_, index) => `P${index.toString()}`)
    const config: GameConfig = { width: 19, height: 19, winLength: 5, players }
    // A dead field is the slowest case: every window has to be looked at. Fill it so that each
    // window of five holds two players.
    const cells = Array.from({ length: 19 * 19 }, (_, index) => players[index % 2] ?? null)
    cells[0] = null
    const runs = 200
    const startedAt = performance.now()
    for (let run = 0; run < runs; run++) canStillWin(config, cells, 'P0')
    const perCall = (performance.now() - startedAt) / runs
    expect(perCall).toBeLessThan(1)
  })
})

describe('a game that ends in a dead position', () => {
  const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

  function play(config: GameConfig, cells: readonly (readonly [number, number])[]): GameState {
    let state = createGame(config)
    for (const [x, y] of cells) {
      if (state.status.kind !== 'playing') throw new Error(`the game ended before (${x}, ${y})`)
      const result = applyMove(state, { player: state.status.next, x, y })
      if (!result.ok) throw new Error(`(${x}, ${y}) was refused: ${result.error}`)
      state = result.state
    }
    return state
  }

  // After these seven moves no line is open to anybody any more, with (1, 1) and (0, 2) still empty.
  const early = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [2, 2],
    [1, 2],
  ] as const

  it('is a draw as soon as no line can be completed, with cells left', () => {
    const game = play(classic, early.slice(0, 6))
    expect(game.status.kind).toBe('playing')
    const drawn = play(classic, early)
    expect(drawn.status).toEqual({ kind: 'draw' })
    expect(drawn.moveCount).toBe(7)
    expect(drawn.cells.filter((cell) => cell === null)).toHaveLength(2)
  })

  it('refuses moves once the game is drawn', () => {
    const drawn = play(classic, early)
    expect(applyMove(drawn, { player: 'O', x: 0, y: 2 })).toEqual({ ok: false, error: 'game-over' })
  })

  it('still lets a win on the last move win', () => {
    // The dead-position check only runs when the move did not win.
    const game = play(classic, [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ])
    expect(game.status).toMatchObject({ kind: 'won', winner: 'X' })
  })

  it('reads back a game that was played on to a full field, and keeps it drawn', () => {
    const full = [...early, [0, 2], [1, 1]] as const
    const replayed = replayGame(
      classic,
      full.map(([x, y], index) => ({ player: index % 2 === 0 ? 'X' : 'O', x, y })),
    )
    expect(replayed.ok).toBe(true)
    if (replayed.ok) {
      expect(replayed.state.status).toEqual({ kind: 'draw' })
      expect(replayed.state.moveCount).toBe(9)
    }
  })

  it('still checks the rules of the moves played on after the draw', () => {
    const moves = early.map(([x, y], index) => ({ player: index % 2 === 0 ? 'X' : 'O', x, y }))
    const wrongTurn = replayGame(classic, [...moves, { player: 'X', x: 0, y: 2 }])
    expect(wrongTurn).toEqual({ ok: false, index: 7, error: 'not-your-turn' })
    const taken = replayGame(classic, [...moves, { player: 'O', x: 0, y: 0 }])
    expect(taken).toEqual({ ok: false, index: 7, error: 'cell-taken' })
    const offField = replayGame(classic, [...moves, { player: 'O', x: 3, y: 0 }])
    expect(offField).toEqual({ ok: false, index: 7, error: 'out-of-bounds' })
    const tooMany = replayGame(classic, [
      ...moves,
      { player: 'O', x: 0, y: 2 },
      { player: 'X', x: 1, y: 1 },
      { player: 'O', x: 0, y: 0 },
    ])
    expect(tooMany).toEqual({ ok: false, index: 9, error: 'game-over' })
  })
})

/**
 * The brute-force check. `reference` plays every possible continuation with its own rules (not the
 * engine's), so it is independent of `canStillWin`: it says whether any sequence of the remaining
 * moves ends in a win for somebody.
 */
function lineWins(config: GameConfig, cells: readonly (PlayerId | null)[], index: number): boolean {
  const { width, height, winLength } = config
  const player = cells[index]
  const x = index % width
  const y = Math.floor(index / width)
  return [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ].some(([dx = 0, dy = 0]) => {
    let length = 1
    for (const sign of [1, -1]) {
      for (let step = 1; ; step++) {
        const cx = x + dx * step * sign
        const cy = y + dy * step * sign
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) break
        if (cells[cy * width + cx] !== player) break
        length++
      }
    }
    return length >= winLength
  })
}

function exploreAll(config: GameConfig): { positions: number; late: number } {
  const { players } = config
  const wins = new Map<string, boolean>()
  const seen = new Set<string>()
  let positions = 0
  let late = 0

  /** Whether any continuation from here wins, for anybody. */
  const reference = (cells: (PlayerId | null)[], turn: number): boolean => {
    const key = `${cells.map((cell) => cell ?? '.').join('')}|${turn.toString()}`
    const known = wins.get(key)
    if (known !== undefined) return known
    let result = false
    for (let index = 0; index < cells.length && !result; index++) {
      if (cells[index] !== null) continue
      cells[index] = players[turn] ?? null
      result = lineWins(config, cells, index) || reference(cells, (turn + 1) % players.length)
      cells[index] = null
    }
    wins.set(key, result)
    return result
  }

  const visit = (cells: (PlayerId | null)[], turn: number): void => {
    const key = `${cells.map((cell) => cell ?? '.').join('')}|${turn.toString()}`
    if (seen.has(key)) return
    seen.add(key)
    const toMove = players[turn]
    if (toMove === undefined) throw new Error('turn out of range')
    if (cells.every((cell) => cell !== null)) return
    positions++
    const says = canStillWin(config, cells, toMove)
    const really = reference(cells, turn)
    // Never early: when the check says nobody can win, there must be no continuation that wins.
    if (!says && really) throw new Error(`early: ${key}`)
    if (says && !really) late++
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] !== null) continue
      cells[index] = toMove
      if (!lineWins(config, cells, index)) visit(cells, (turn + 1) % players.length)
      cells[index] = null
    }
  }
  visit(Array<PlayerId | null>(config.width * config.height).fill(null), 0)
  return { positions, late }
}

describe('canStillWin against every continuation', () => {
  it.each<[string, GameConfig]>([
    ['3 × 3, two players', { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }],
    ['3 × 3, three players', { width: 3, height: 3, winLength: 3, players: ['X', 'O', 'A'] }],
    [
      '4 × 3, two players, three in a row',
      { width: 4, height: 3, winLength: 3, players: ['X', 'O'] },
    ],
  ])('is never early on %s', (_name, config) => {
    const { positions, late } = exploreAll(config)
    expect(positions).toBeGreaterThan(0)
    // It is allowed to be late, but it should not be silly about it.
    expect(late).toBeLessThan(positions)
  })
})
