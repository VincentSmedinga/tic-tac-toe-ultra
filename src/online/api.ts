import { z } from 'zod'
import { roomCodeSchema } from '../../shared/protocol.ts'

/** The HTTP side of the rooms: making one and asking whether one exists. */
export interface RoomApi {
  createRoom: () => Promise<string>
  roomExists: (code: string) => Promise<boolean>
}

const createdSchema = z.object({ code: roomCodeSchema })
const existsSchema = z.object({ exists: z.boolean() })

export const roomApi: RoomApi = {
  async createRoom() {
    const response = await fetch('/api/rooms', { method: 'POST' })
    if (!response.ok) throw new Error(`Making a room failed with ${response.status.toString()}`)
    return createdSchema.parse(await response.json()).code
  },

  async roomExists(code) {
    const response = await fetch(`/api/rooms/${code}`)
    if (!response.ok) throw new Error(`Asking for a room failed with ${response.status.toString()}`)
    return existsSchema.parse(await response.json()).exists
  },
}
