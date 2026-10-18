import { replayGame } from './game/index.ts'
import type { Stats, StoredGame } from './protocol.ts'
import { shapeOfPlayer } from './shapes.ts'
import type { ShapeId } from './shapes.ts'

/** The family lives in the Netherlands: days, weeks and hours are counted there. */
export const TIME_ZONE = 'Europe/Amsterdam'
/** How many weeks the weekly numbers go back, this one included. */
export const WEEKS = 12
/** How many kinds of game get their own numbers and heat maps. */
export const MAX_KINDS = 6

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})

/** What the clock on the wall in the Netherlands showed at this moment. */
function wallClock(ms: number): { day: number; weekday: number; hour: number } {
  const parts = Object.fromEntries(clock.formatToParts(ms).map(({ type, value }) => [type, value]))
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS
  return { day, weekday: WEEKDAYS.indexOf(parts.weekday ?? ''), hour: Number(parts.hour) }
}

/** The date of a day number (days since 1970), as YYYY-MM-DD. */
function dateOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** The day number of the Monday of the week this moment is in. */
function mondayOf(ms: number): number {
  const { day, weekday } = wallClock(ms)
  return day - weekday
}

function spreadOf(values: readonly number[]): Stats['moves'] {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  return {
    games: sorted.length,
    average: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median,
    shortest: sorted[0] ?? 0,
    longest: sorted.at(-1) ?? 0,
  }
}

interface Outcomes {
  won: number
  drawn: number
}

function tally(into: Outcomes, game: StoredGame): void {
  if (game.result.kind === 'won') into.won++
  else into.drawn++
}

/** The shapes that sat at a game, each once; a player that is no shape (never happens) is left out. */
function shapesOf(game: StoredGame): ShapeId[] {
  const shapes = game.config.players.flatMap((player) => shapeOfPlayer(player) ?? [])
  return [...new Set(shapes)]
}

/**
 * Works out the statistics of finished games. Pure: the same games and the same `now` give the same
 * numbers, so it is tested on a made-up set and can always be rebuilt from the archive. `now` only
 * decides which weeks the weekly numbers show.
 */
export function computeStats(games: readonly StoredGame[], now: number): Stats {
  const ordered = [...games].sort(
    (a, b) => a.finishedAt - b.finishedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

  const total: Outcomes = { won: 0, drawn: 0 }
  const starter = { won: 0, lost: 0, drawn: 0 }
  const thisWeek = mondayOf(now)
  const weeks = Array.from({ length: WEEKS }, (_, index) => ({
    day: thisWeek - (WEEKS - 1 - index) * 7,
    won: 0,
    drawn: 0,
  }))
  const weekdays = Array.from({ length: 7 }, () => 0)
  const hours = Array.from({ length: 24 }, () => 0)
  const shapes = new Map<ShapeId, { games: number } & Outcomes>()
  const pairs = new Map<string, { shapes: [ShapeId, ShapeId]; games: number }>()
  const durations: number[] = []
  const moveCounts: number[] = []
  const kinds = new Map<string, KindTally>()
  const runs = new Map<ShapeId, { current: number }>()
  let fastestWin: Stats['fun']['fastestWin'] = null
  let longestGame: Stats['fun']['longestGame'] = null
  let longestRun: Stats['fun']['longestRun'] = null

  for (const game of ordered) {
    const { config, moves, result } = game
    tally(total, game)
    moveCounts.push(moves.length)

    const wall = wallClock(game.finishedAt)
    const week = weeks.find((candidate) => candidate.day === wall.day - wall.weekday)
    if (week) tally(week, game)
    weekdays[wall.weekday] = (weekdays[wall.weekday] ?? 0) + 1
    hours[wall.hour] = (hours[wall.hour] ?? 0) + 1

    const lasted = game.startedAt === undefined ? null : game.finishedAt - game.startedAt
    if (lasted !== null && lasted >= 0) durations.push(lasted)

    const first = moves[0]?.player
    if (first !== undefined) {
      if (result.kind === 'draw') starter.drawn++
      else if (result.winner === first) starter.won++
      else starter.lost++
    }

    const here = shapesOf(game)
    for (const shape of here) {
      const entry = shapes.get(shape) ?? { games: 0, won: 0, drawn: 0 }
      entry.games++
      if (result.kind === 'draw') entry.drawn++
      else if (shapeOfPlayer(result.winner) === shape) entry.won++
      shapes.set(shape, entry)

      // A run of wins counts the games a shape played: a game it sat out neither adds nor breaks.
      const run = runs.get(shape) ?? { current: 0 }
      run.current =
        result.kind === 'won' && shapeOfPlayer(result.winner) === shape ? run.current + 1 : 0
      runs.set(shape, run)
      if (run.current > (longestRun?.wins ?? 0)) longestRun = { shape, wins: run.current }
    }
    for (const [index, a] of here.entries()) {
      for (const b of here.slice(index + 1)) {
        const [one, two] = a < b ? [a, b] : [b, a]
        const pair = pairs.get(`${one}+${two}`) ?? { shapes: [one, two], games: 0 }
        pair.games++
        pairs.set(`${one}+${two}`, pair)
      }
    }

    if (result.kind === 'won' && lasted !== null && lasted >= 0) {
      const shape = shapeOfPlayer(result.winner)
      const quicker =
        fastestWin === null ||
        lasted < fastestWin.milliseconds ||
        (lasted === fastestWin.milliseconds && moves.length < fastestWin.moves)
      if (shape && quicker) fastestWin = { shape, milliseconds: lasted, moves: moves.length }
    }
    if (longestGame === null || moves.length > longestGame.moves) {
      longestGame = { moves: moves.length, width: config.width, height: config.height }
    }

    addToKind(kinds, game, first)
  }

  return {
    games: ordered.length,
    won: total.won,
    drawn: total.drawn,
    weeks: weeks.map(({ day, won, drawn }) => ({ start: dateOf(day), won, drawn })),
    duration: spreadOf(durations),
    moves: spreadOf(moveCounts),
    shapes: [...shapes]
      .map(([shape, entry]) => ({ shape, ...entry }))
      .sort((a, b) => b.games - a.games || (a.shape < b.shape ? -1 : 1)),
    starter,
    kinds: [...kinds.values()]
      .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key))
      .slice(0, MAX_KINDS)
      .map(({ key: _key, moves: kindMoves, ...kind }) => ({
        ...kind,
        averageMoves: kindMoves / kind.games,
      })),
    weekdays,
    hours,
    fun: {
      fastestWin,
      longestGame,
      longestRun,
      favouritePair:
        [...pairs.values()].sort(
          (a, b) => b.games - a.games || a.shapes.join().localeCompare(b.shapes.join()),
        )[0] ?? null,
    },
  }
}

type Kind = Stats['kinds'][number]
/** One kind of game while it is being counted: its numbers, its key, and its moves added up. */
type KindTally = Omit<Kind, 'averageMoves'> & { key: string; moves: number }

function addToKind(kinds: Map<string, KindTally>, game: StoredGame, first: string | undefined) {
  const { width, height, winLength, players } = game.config
  const key = `${width.toString()}x${height.toString()}x${winLength.toString()}x${players.length.toString()}`
  const kind = kinds.get(key) ?? {
    key,
    width,
    height,
    winLength,
    players: players.length,
    games: 0,
    won: 0,
    drawn: 0,
    starter: { won: 0, lost: 0, drawn: 0 },
    moves: 0,
    firstMoves: Array.from({ length: width * height }, () => 0),
    winningCells: Array.from({ length: width * height }, () => 0),
  }
  kinds.set(key, kind)

  kind.games++
  kind.moves += game.moves.length
  tally(kind, game)
  if (first !== undefined) {
    if (game.result.kind === 'draw') kind.starter.drawn++
    else if (game.result.winner === first) kind.starter.won++
    else kind.starter.lost++
  }

  const opening = game.moves[0]
  if (opening && opening.x >= 0 && opening.x < width && opening.y >= 0 && opening.y < height) {
    const index = opening.y * width + opening.x
    kind.firstMoves[index] = (kind.firstMoves[index] ?? 0) + 1
  }
  if (game.result.kind === 'won') countWinningCells(kind, game)
}

/** Adds the cells of the winning lines of a won game: each cell once, however many lines it is in. */
function countWinningCells(kind: KindTally, game: StoredGame): void {
  let replayed
  try {
    replayed = replayGame(game.config, game.moves)
  } catch {
    return // A config that can't make a game: nothing to count.
  }
  if (!replayed.ok || replayed.state.status.kind !== 'won') return
  const cells = new Set(
    replayed.state.status.lines.flatMap((line) => line.map(({ x, y }) => y * kind.width + x)),
  )
  for (const index of cells) kind.winningCells[index] = (kind.winningCells[index] ?? 0) + 1
}
