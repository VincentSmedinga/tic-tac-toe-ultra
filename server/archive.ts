import { DurableObject } from 'cloudflare:workers'
import type { GamesPage, StoredGame } from '../shared/protocol.ts'
import { ArchiveStore } from './archive-store.ts'
import type { NewGame } from './archive-store.ts'
import type { Env } from './env.ts'

/** The name of the one archive: every finished game of every room is kept in it. */
export const ARCHIVE_NAME = 'games'

/**
 * The finished games of all rooms, in the SQLite storage of one Durable Object, which outlives the
 * rooms (a room is deleted a day after its last move). One object is plenty for a family game: it
 * holds about 10 GB, and a game is a few hundred bytes. The queries are in archive-store.ts.
 */
export class Archive extends DurableObject<Env> {
  private readonly store: ArchiveStore

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = new ArchiveStore(ctx.storage.sql)
  }

  /**
   * Keeps a finished game, as it ended at `finishedAt` (not when it got here: a save can be tried
   * again later); `owners` are the tokens of its players, which are stored as hashes.
   */
  async save(game: NewGame, finishedAt: number): Promise<void> {
    const owners = await Promise.all(game.owners.map(hashToken))
    this.store.save({ ...game, owners }, finishedAt)
  }

  get(id: string): StoredGame | null {
    return this.store.get(id)
  }

  /** The games of the browser with this token, newest first (see `ArchiveStore.list`). */
  async list(token: string, limit: number, before?: string): Promise<GamesPage> {
    return this.store.list(await hashToken(token), limit, before)
  }
}

/** SHA-256 of a token as hex: what is stored of a player, so the archive holds nothing to log in with. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
