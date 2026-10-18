import { statsSchema } from '../../shared/protocol.ts'
import type { Stats } from '../../shared/protocol.ts'

/** The HTTP side of the statistics: the numbers of all finished games together. */
export interface StatsApi {
  getStats: () => Promise<Stats>
}

export const statsApi: StatsApi = {
  async getStats() {
    const response = await fetch('/api/stats')
    if (!response.ok)
      throw new Error(`Asking for the statistics failed with ${response.status.toString()}`)
    return statsSchema.parse(await response.json())
  },
}
