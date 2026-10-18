import { ownStatsSchema, statsSchema } from '../../shared/protocol.ts'
import type { OwnStats, Stats } from '../../shared/protocol.ts'

/** The HTTP side of the statistics: the numbers of all finished games together. */
export interface StatsApi {
  getStats: () => Promise<Stats>
}

/** The statistics of one browser: its own games, counted. */
export interface OwnStatsApi {
  getOwnStats: (token: string) => Promise<OwnStats>
}

export const statsApi: StatsApi & OwnStatsApi = {
  async getStats() {
    const response = await fetch('/api/stats')
    if (!response.ok)
      throw new Error(`Asking for the statistics failed with ${response.status.toString()}`)
    return statsSchema.parse(await response.json())
  },
  async getOwnStats(token) {
    // The token goes in a header, never in the address: addresses end up in histories and logs.
    const response = await fetch('/api/stats/mine', { headers: { 'X-Player-Token': token } })
    if (!response.ok)
      throw new Error(`Asking for your statistics failed with ${response.status.toString()}`)
    return ownStatsSchema.parse(await response.json())
  },
}
