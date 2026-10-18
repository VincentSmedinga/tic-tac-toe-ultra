import { gamesPageSchema, storedGameSchema } from '../../shared/protocol.ts'
import type { GamesPage, StoredGame } from '../../shared/protocol.ts'

/** The HTTP side of the kept games: the ones this browser played, and one game by its id. */
export interface GamesApi {
  /** A page of the games of the browser with this token, newest first; `before` is a `next`. */
  listGames: (token: string, before?: string) => Promise<GamesPage>
  /** A game, or null when there is none with this id. */
  getGame: (id: string) => Promise<StoredGame | null>
}

export const gamesApi: GamesApi = {
  async listGames(token, before) {
    const query = before === undefined ? '' : `?before=${encodeURIComponent(before)}`
    // The token goes in a header, never in the address: addresses end up in histories and logs.
    const response = await fetch(`/api/games${query}`, { headers: { 'X-Player-Token': token } })
    if (!response.ok)
      throw new Error(`Asking for the games failed with ${response.status.toString()}`)
    return gamesPageSchema.parse(await response.json())
  },

  async getGame(id) {
    const response = await fetch(`/api/games/${encodeURIComponent(id)}`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Asking for a game failed with ${response.status.toString()}`)
    return storedGameSchema.parse(await response.json())
  },
}
