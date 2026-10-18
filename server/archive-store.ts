import { gamesCursorSchema, storedGameSchema } from '../shared/protocol.ts'
import type { GamesPage, GameSummary, StoredGame } from '../shared/protocol.ts'

/** The part of Durable Object SQL storage the store uses, so it can run on any SQLite in tests. */
export interface Sql {
  exec(query: string, ...bindings: (string | number)[]): { toArray(): Record<string, unknown>[] }
}

/** A game to keep, as the room hands it over; the store adds the time. */
export type NewGame = Omit<StoredGame, 'finishedAt'> & {
  /** Who sat at the game: tokens from a room, hashes in the store, never sent back out. */
  owners: readonly string[]
}

/**
 * Where finished games are kept: one table of games, as JSON (a game is its config plus its moves,
 * which the engine reads back), and one table of who sat at them, by the hash of their token, so a
 * browser can find "its" games again without a token ever being stored or sent back.
 */
export class ArchiveStore {
  private readonly sql: Sql

  constructor(sql: Sql) {
    this.sql = sql
    sql.exec(`CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      finished_at INTEGER NOT NULL,
      data TEXT NOT NULL
    )`)
    sql.exec(`CREATE TABLE IF NOT EXISTS players (
      owner TEXT NOT NULL,
      game_id TEXT NOT NULL,
      finished_at INTEGER NOT NULL,
      PRIMARY KEY (owner, game_id)
    )`)
    sql.exec('CREATE INDEX IF NOT EXISTS players_by_time ON players (owner, finished_at DESC)')
  }

  /** Keeps a game. Keeping the same id again changes nothing, so a repeated call is harmless. */
  save({ owners, ...game }: NewGame, finishedAt: number): void {
    const stored: StoredGame = { ...game, finishedAt }
    this.sql.exec(
      'INSERT OR IGNORE INTO games (id, finished_at, data) VALUES (?, ?, ?)',
      stored.id,
      finishedAt,
      JSON.stringify(stored),
    )
    for (const owner of new Set(owners)) {
      this.sql.exec(
        'INSERT OR IGNORE INTO players (owner, game_id, finished_at) VALUES (?, ?, ?)',
        owner,
        stored.id,
        finishedAt,
      )
    }
  }

  /** A stored game, or null when there is none with this id (or it can't be read any more). */
  get(id: string): StoredGame | null {
    const [row] = this.sql.exec('SELECT data FROM games WHERE id = ?', id).toArray()
    return typeof row?.data === 'string' ? parseGame(row.data) : null
  }

  /**
   * The games these players sat at, newest first, `limit` at a time. `before` is the `next` of the
   * page before: the list goes on after that game, even when new games have been played since.
   */
  list(owner: string, limit: number, before?: string): GamesPage {
    const cursor = before === undefined ? null : parseCursor(before)
    const rows = this.sql
      .exec(
        `SELECT g.data FROM players p JOIN games g ON g.id = p.game_id
         WHERE p.owner = ?${cursor ? ' AND (p.finished_at < ? OR (p.finished_at = ? AND p.game_id < ?))' : ''}
         ORDER BY p.finished_at DESC, p.game_id DESC LIMIT ?`,
        ...(cursor
          ? [owner, cursor.finishedAt, cursor.finishedAt, cursor.id, limit + 1]
          : [owner, limit + 1]),
      )
      .toArray()
    const games = rows.flatMap(({ data }) => {
      const game = typeof data === 'string' ? parseGame(data) : null
      return game ? [summaryOf(game)] : []
    })
    const page = games.slice(0, limit)
    const last = page.at(-1)
    return rows.length > limit && last
      ? { games: page, next: `${last.finishedAt.toString()}.${last.id}` }
      : { games: page }
  }
}

/** A game as it was stored; null when what is in storage is no game (broken JSON, wrong shape). */
function parseGame(data: string): StoredGame | null {
  let json: unknown
  try {
    json = JSON.parse(data)
  } catch {
    return null
  }
  const parsed = storedGameSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

function parseCursor(cursor: string): { finishedAt: number; id: string } | null {
  if (!gamesCursorSchema.safeParse(cursor).success) return null
  const [finishedAt = '', id = ''] = cursor.split('.')
  return { finishedAt: Number(finishedAt), id }
}

function summaryOf(game: StoredGame): GameSummary {
  const { id, finishedAt, players, result, config, moves } = game
  return {
    id,
    finishedAt,
    players,
    result,
    width: config.width,
    height: config.height,
    moves: moves.length,
  }
}
