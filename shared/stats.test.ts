import { describe, expect, it } from 'vitest'
import { replayGame } from './game/index.ts'
import type { Stats, StoredGame } from './protocol.ts'
import { statsSchema } from './protocol.ts'
import { WEEKS, computeOwnStats, computeStats } from './stats.ts'

// Dutch time is two hours ahead of UTC until the clocks change on 25 October 2026.
const at = (day: number, hour: number, minute = 0): number =>
  Date.UTC(2026, 9, day, hour - 2, minute)
const NOW = at(18, 12) // Sunday 18 October 2026, noon

type Cells = readonly (readonly [number, number])[]

/** A finished game: the players move in turn through `cells`, and the engine says how it ended. */
function game(
  id: string,
  players: readonly string[],
  cells: Cells,
  finishedAt: number,
  extra: { startedAfter?: number; width?: number; height?: number; winLength?: number } = {},
): StoredGame {
  const config = {
    width: extra.width ?? 3,
    height: extra.height ?? 3,
    winLength: extra.winLength ?? 3,
    players: [...players],
  }
  const moves = cells.map(([x, y], index) => ({
    player: players[index % players.length] ?? '',
    x,
    y,
  }))
  const replayed = replayGame(config, moves)
  if (!replayed.ok) throw new Error(`the made-up game ${id} is not legal`)
  const { status } = replayed.state
  return {
    id: id.padEnd(16, '-'),
    finishedAt,
    ...(extra.startedAfter === undefined ? {} : { startedAt: finishedAt - extra.startedAfter }),
    config,
    moves,
    players: players.map((player) => ({ id: player })),
    result: status.kind === 'won' ? { kind: 'won', winner: status.winner } : { kind: 'draw' },
  }
}

// X wins the top row in five moves; the players X and O are the cross and the circle.
const TOP_ROW = game(
  'top-row',
  ['X', 'O'],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
  ],
  at(18, 10),
  { startedAfter: 60_000 },
)
// Nine moves, nobody wins; no start time was kept.
const DRAW = game(
  'draw',
  ['heart', 'star'],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [2, 1],
    [2, 2],
    [1, 2],
  ],
  at(17, 21, 30),
)
// The circle wins the diagonal. It ended at half past midnight on Monday, Dutch time (Sunday in UTC).
const DIAGONAL = game(
  'diagonal',
  ['cross', 'circle'],
  [
    [1, 0],
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 1],
    [2, 2],
  ],
  at(12, 0, 30),
)
// Three in a row on a field of 5 × 5.
const BIG = game(
  'big',
  ['heart', 'star'],
  [
    [2, 2],
    [0, 0],
    [3, 2],
    [0, 1],
    [4, 2],
  ],
  at(18, 11),
  { width: 5, height: 5, startedAfter: 40_000 },
)
const GAMES = [TOP_ROW, DRAW, DIAGONAL, BIG]

describe('statistics', () => {
  it('are valid for what the schema allows', () => {
    expect(statsSchema.safeParse(computeStats(GAMES, NOW)).success).toBe(true)
    expect(statsSchema.safeParse(computeStats([], NOW)).success).toBe(true)
  })

  it('count nothing when there are no games', () => {
    const stats = computeStats([], NOW)
    expect(stats).toMatchObject({ games: 0, won: 0, drawn: 0, duration: null, moves: null })
    expect(stats.weeks).toHaveLength(WEEKS)
    expect(stats.kinds).toEqual([])
    expect(stats.fun).toEqual({
      fastestWin: null,
      longestGame: null,
      longestRun: null,
      favouritePair: null,
    })
  })

  it('count the games, how many were won and how many drawn', () => {
    expect(computeStats(GAMES, NOW)).toMatchObject({ games: 4, won: 3, drawn: 1 })
  })

  it('count the games per week, the last twelve, in Dutch time', () => {
    const { weeks } = computeStats(GAMES, NOW)
    expect(weeks[0]?.start).toBe('2026-07-27')
    expect(weeks.at(-1)).toEqual({ start: '2026-10-12', won: 3, drawn: 1 })
    expect(weeks.slice(0, -1).every(({ won, drawn }) => won + drawn === 0)).toBe(true)
  })

  it('leave out games older than the weeks they show, but still count them', () => {
    const old = game(
      'old',
      ['cross', 'circle'],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
      ],
      at(1, 12) - 200 * 86_400_000,
    )
    const stats = computeStats([old], NOW)
    expect(stats.games).toBe(1)
    expect(stats.weeks.every(({ won, drawn }) => won + drawn === 0)).toBe(true)
  })

  it('work out how long games take from the games that have a start time only', () => {
    expect(computeStats(GAMES, NOW).duration).toEqual({
      games: 2,
      average: 50_000,
      median: 50_000,
      shortest: 40_000,
      longest: 60_000,
    })
  })

  it('ignore a start time that comes after the end', () => {
    const wrong = { ...TOP_ROW, startedAt: TOP_ROW.finishedAt + 1 }
    expect(computeStats([wrong], NOW).duration).toBeNull()
  })

  it('work out how many moves games take', () => {
    expect(computeStats(GAMES, NOW).moves).toEqual({
      games: 4,
      average: 6.25,
      median: 5.5,
      shortest: 5,
      longest: 9,
    })
  })

  it('count how often each shape played, won and drew, reading X and O as cross and circle', () => {
    expect(computeStats(GAMES, NOW).shapes).toEqual([
      { shape: 'circle', games: 2, won: 1, drawn: 0 },
      { shape: 'cross', games: 2, won: 1, drawn: 0 },
      { shape: 'heart', games: 2, won: 1, drawn: 1 },
      { shape: 'star', games: 2, won: 0, drawn: 1 },
    ])
  })

  it('say whether starting wins', () => {
    expect(computeStats(GAMES, NOW).starter).toEqual({ won: 2, lost: 1, drawn: 1 })
  })

  it('keep the numbers of each kind of game, with where it starts and where it is won', () => {
    const { kinds } = computeStats(GAMES, NOW)
    expect(kinds).toHaveLength(2)
    expect(kinds[0]).toMatchObject({
      width: 3,
      height: 3,
      winLength: 3,
      players: 2,
      games: 3,
      won: 2,
      drawn: 1,
      starter: { won: 1, lost: 1, drawn: 1 },
      firstMoves: [2, 1, 0, 0, 0, 0, 0, 0, 0],
      winningCells: [2, 1, 1, 0, 1, 0, 0, 0, 1],
    })
    expect(kinds[0]?.averageMoves).toBeCloseTo(20 / 3)
    expect(kinds[1]).toMatchObject({
      width: 5,
      height: 5,
      games: 1,
      starter: { won: 1, lost: 0, drawn: 0 },
    })
    expect(kinds[1]?.firstMoves[12]).toBe(1)
    expect(kinds[1]?.winningCells.flatMap((count, index) => (count > 0 ? [index] : []))).toEqual([
      12, 13, 14,
    ])
  })

  it('count the rooms and the rounds of each, from the rooms that are known', () => {
    expect(computeStats(GAMES, NOW, { made: 6, rounds: [1, 3, 1, 7] }).rooms).toEqual({
      made: 6,
      played: 4,
      rematches: 2,
      averageRounds: 3,
      mostRounds: 7,
      rounds: [2, 0, 1, 0, 1],
    })
  })

  it('say no rooms when none were counted, and never fewer made than played', () => {
    expect(computeStats(GAMES, NOW).rooms).toEqual({
      made: 0,
      played: 0,
      rematches: 0,
      averageRounds: 0,
      mostRounds: 0,
      rounds: [0, 0, 0, 0, 0],
    })
    expect(computeStats(GAMES, NOW, { made: 1, rounds: [2, 1] }).rooms.made).toBe(2)
  })

  it('count the days of the week (Monday first) and the hours of the day, in Dutch time', () => {
    const { weekdays, hours } = computeStats(GAMES, NOW)
    expect(weekdays).toEqual([1, 0, 0, 0, 0, 1, 2])
    expect(hours[0]).toBe(1)
    expect(hours[10]).toBe(1)
    expect(hours[11]).toBe(1)
    expect(hours[21]).toBe(1)
    expect(hours.reduce((sum, count) => sum + count, 0)).toBe(4)
  })

  it('pick the fun ones', () => {
    expect(computeStats(GAMES, NOW).fun).toEqual({
      fastestWin: { shape: 'heart', milliseconds: 40_000, moves: 5 },
      longestGame: { moves: 9, width: 3, height: 3 },
      longestRun: { shape: 'circle', wins: 1 },
      favouritePair: { shapes: ['circle', 'cross'], games: 2 },
    })
  })

  it('find the longest run of wins of a shape, in the order the games ended', () => {
    const win = (id: string, finishedAt: number) =>
      game(
        id,
        ['cross', 'circle'],
        [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
          [2, 0],
        ],
        finishedAt,
      )
    const lose = (id: string, finishedAt: number) =>
      game(
        id,
        ['cross', 'circle'],
        [
          [1, 0],
          [0, 0],
          [2, 0],
          [1, 1],
          [0, 1],
          [2, 2],
        ],
        finishedAt,
      )
    // The games are given out of order on purpose.
    const run = (stats: Stats) => stats.fun.longestRun
    expect(run(computeStats([win('c', 3), lose('b', 2), win('a', 1), win('d', 4)], NOW))).toEqual({
      shape: 'cross',
      wins: 2,
    })
    expect(run(computeStats([win('a', 1), win('b', 2), lose('c', 3), win('d', 4)], NOW))).toEqual({
      shape: 'cross',
      wins: 2,
    })
    expect(run(computeStats([win('a', 1), lose('b', 2), win('c', 3)], NOW))?.wins).toBe(1)
  })
})

describe('the statistics of one browser', () => {
  it('count nothing when it played nothing', () => {
    expect(computeOwnStats([])).toEqual({
      games: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      unknown: 0,
      favourite: null,
    })
  })

  it('count the games it won, lost and drew, as the player it was in each', () => {
    // TOP_ROW: X wins; DIAGONAL: the circle wins; DRAW: nobody; BIG: the heart wins.
    expect(
      computeOwnStats([
        { game: TOP_ROW, player: 'X' },
        { game: DIAGONAL, player: 'cross' },
        { game: DRAW, player: 'star' },
        { game: BIG, player: 'heart' },
      ]),
    ).toEqual({
      games: 4,
      won: 2,
      lost: 1,
      drawn: 1,
      unknown: 0,
      // The X of the old game is the cross, which is the shape it played most.
      favourite: { shape: 'cross', games: 2 },
    })
  })

  it('count a game of which the player is not known as played, not as won or lost', () => {
    const stats = computeOwnStats([
      { game: TOP_ROW, player: null },
      { game: DIAGONAL, player: 'circle' },
    ])
    expect(stats).toMatchObject({ games: 2, won: 1, lost: 0, unknown: 1 })
    expect(stats.favourite).toEqual({ shape: 'circle', games: 1 })
  })

  it('find the shape it played most, reading X as the cross', () => {
    const stats = computeOwnStats([
      { game: TOP_ROW, player: 'X' },
      { game: DIAGONAL, player: 'cross' },
      { game: DRAW, player: 'star' },
    ])
    expect(stats.favourite).toEqual({ shape: 'cross', games: 2 })
  })
})
