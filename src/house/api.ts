import { z } from 'zod'
import { houseCodeSchema } from '../../shared/house-protocol.ts'

/** The HTTP side of the houses: making one and asking whether one exists. */
export interface HouseApi {
  createHouse: () => Promise<string>
  houseExists: (code: string) => Promise<boolean>
}

const createdSchema = z.object({ code: houseCodeSchema })
const existsSchema = z.object({ exists: z.boolean() })

export const houseApi: HouseApi = {
  async createHouse() {
    const response = await fetch('/api/houses', { method: 'POST' })
    if (!response.ok) throw new Error(`Making a house failed with ${response.status.toString()}`)
    return createdSchema.parse(await response.json()).code
  },

  async houseExists(code) {
    const response = await fetch(`/api/houses/${code}`)
    if (!response.ok)
      throw new Error(`Asking for a house failed with ${response.status.toString()}`)
    return existsSchema.parse(await response.json()).exists
  },
}
