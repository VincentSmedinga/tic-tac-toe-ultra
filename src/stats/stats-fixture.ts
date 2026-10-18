import type { Stats } from '../../shared/protocol.ts'
import { computeStats } from '../../shared/stats.ts'

/** The statistics of no games, and of 9 classic games with a few of a bigger field, for the tests. */
export const EMPTY = computeStats([], Date.UTC(2026, 9, 18, 12))

/** The numbers of 9 classic games, as the server would count them. */
export const NINE: Stats = {
  ...EMPTY,
  games: 9,
  won: 7,
  drawn: 2,
  weeks: EMPTY.weeks.map((week, index) =>
    index === 11
      ? { ...week, won: 7, drawn: 2 }
      : index === 10
        ? { ...week, won: 0, drawn: 0 }
        : week,
  ),
  duration: { games: 6, average: 125_000, median: 90_000, shortest: 40_000, longest: 300_000 },
  moves: { games: 9, average: 6.25, median: 5, shortest: 5, longest: 9 },
  shapes: [
    { shape: 'cross', games: 9, won: 4, drawn: 2 },
    { shape: 'circle', games: 7, won: 3, drawn: 2 },
    { shape: 'heart', games: 2, won: 0, drawn: 0 },
  ],
  starter: { won: 5, lost: 2, drawn: 2 },
  rooms: {
    made: 5,
    played: 4,
    rematches: 3,
    averageRounds: 2.25,
    mostRounds: 6,
    rounds: [1, 1, 1, 0, 1],
  },
  kinds: [
    {
      width: 3,
      height: 3,
      winLength: 3,
      players: 2,
      games: 9,
      won: 7,
      drawn: 2,
      starter: { won: 5, lost: 2, drawn: 2 },
      averageMoves: 6.25,
      firstMoves: [4, 0, 0, 0, 5, 0, 0, 0, 0],
      winningCells: [3, 1, 2, 0, 7, 0, 2, 1, 3],
    },
    {
      width: 7,
      height: 7,
      winLength: 5,
      players: 3,
      games: 1,
      won: 1,
      drawn: 0,
      starter: { won: 1, lost: 0, drawn: 0 },
      averageMoves: 20,
      firstMoves: Array.from({ length: 49 }, () => 0),
      winningCells: Array.from({ length: 49 }, () => 0),
    },
  ],
  weekdays: [0, 1, 0, 0, 2, 5, 1],
  hours: Array.from({ length: 24 }, (_, hour) => (hour === 20 ? 6 : hour === 14 ? 3 : 0)),
  fun: {
    fastestWin: { shape: 'heart', milliseconds: 40_000, moves: 5 },
    longestGame: { moves: 9, width: 3, height: 3 },
    longestRun: { shape: 'cross', wins: 3 },
    favouritePair: { shapes: ['circle', 'cross'], games: 7 },
  },
}
